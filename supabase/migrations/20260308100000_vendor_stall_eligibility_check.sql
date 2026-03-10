-- ============================================================
-- Vendor ↔ Stall eligibility check based on category + tags
-- ============================================================
-- Rules:
--   1. Effective category: if category_overridden → instance.category_id as-is,
--      else COALESCE(instance.category_id, template.category_id).
--      Vendor's KYC business_type_id must match this effective category.
--   2. Effective tags: if tags_overridden → instance stall_instance_tags as-is
--      (even if empty), else instance tags if any → template stall_template_tags.
--      If the stall has tags, the vendor must have ALL of them (via vendor_tags).
--   3. Both category and tag fields can be NULL/empty. A NULL effective value
--      means the stall is open to everyone for that criterion.
-- ============================================================

-- Helper function: returns eligibility status for a vendor + stall
CREATE OR REPLACE FUNCTION check_vendor_stall_eligibility(
  p_user_id  uuid,
  p_stall_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_stall_category_id    uuid;
  v_category_overridden  boolean;
  v_tags_overridden      boolean;
  v_vendor_category_id   uuid;
  v_stall_tag_ids        uuid[];
  v_vendor_tag_ids       uuid[];
BEGIN
  -- 1. Get override flags and effective category
  SELECT
    si.category_overridden,
    si.tags_overridden,
    CASE
      WHEN si.category_overridden THEN si.category_id
      ELSE COALESCE(si.category_id, st.category_id)
    END
  INTO v_category_overridden, v_tags_overridden, v_stall_category_id
  FROM stall_instances si
  JOIN stall_templates st ON si.template_id = st.id
  WHERE si.id = p_stall_id;

  -- If stall has no category assigned, it's open to everyone
  IF v_stall_category_id IS NULL THEN
    RETURN jsonb_build_object('eligible', true);
  END IF;

  -- 2. Get the vendor's KYC business type (category)
  SELECT ka.business_type_id
  INTO v_vendor_category_id
  FROM kyc_applications ka
  WHERE ka.user_id = p_user_id
    AND ka.status = 'APPROVED'
  ORDER BY ka.submitted_at DESC
  LIMIT 1;

  -- Vendor has no approved KYC → not eligible
  IF v_vendor_category_id IS NULL THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'no_approved_kyc',
      'message', 'You need an approved KYC application to book this stall'
    );
  END IF;

  -- 3. Category match check
  IF v_vendor_category_id IS DISTINCT FROM v_stall_category_id THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'category_mismatch',
      'message', 'Your business category does not match this stall type'
    );
  END IF;

  -- 4. Tag match check: if tags_overridden, use only instance tags (even if empty)
  --    otherwise fall back: instance tags → template tags
  SELECT ARRAY_AGG(sit.tag_id)
  INTO v_stall_tag_ids
  FROM stall_instance_tags sit
  WHERE sit.stall_instance_id = p_stall_id;

  -- Fall back to template-level tags only when NOT overridden and instance has none
  IF NOT v_tags_overridden AND (v_stall_tag_ids IS NULL OR array_length(v_stall_tag_ids, 1) IS NULL) THEN
    SELECT ARRAY_AGG(stt.tag_id)
    INTO v_stall_tag_ids
    FROM stall_template_tags stt
    JOIN stall_instances si ON si.template_id = stt.stall_template_id
    WHERE si.id = p_stall_id;
  END IF;

  -- No effective tags → category match is sufficient
  IF v_stall_tag_ids IS NULL OR array_length(v_stall_tag_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('eligible', true);
  END IF;

  -- Get vendor's tags from vendor_tags junction table
  SELECT COALESCE(
    ARRAY_AGG(vt.tag_id),
    ARRAY[]::uuid[]
  )
  INTO v_vendor_tag_ids
  FROM vendor_tags vt
  WHERE vt.user_id = p_user_id;

  IF v_vendor_tag_ids IS NULL THEN
    v_vendor_tag_ids := ARRAY[]::uuid[];
  END IF;

  -- Check that vendor has at least one matching stall tag
  IF NOT (v_vendor_tag_ids && v_stall_tag_ids) THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'missing_tags',
      'message', 'You do not have any of the required tags for this stall'
    );
  END IF;

  RETURN jsonb_build_object('eligible', true);
END;
$$;

-- ============================================================
-- Update create_stall_hold to enforce eligibility
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_stall_hold(p_stall_id uuid, p_market_id uuid, p_dates date[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_price_per_day NUMERIC;
  v_conflict_count INT;
  v_current_user_id UUID;
  v_days_count INT;
  v_total NUMERIC;
  v_eligibility jsonb;
BEGIN
  -- Check if user is authenticated
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Authentication required to reserve a stall'
    );
  END IF;

  -- Validate 5-day maximum
  v_days_count := cardinality(p_dates);
  IF v_days_count > 5 THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Maximum 5 days can be selected per booking'
    );
  END IF;

  IF v_days_count < 1 THEN
    -- Remove any existing holds by this user for this stall (cleanup)
    DELETE FROM public.stall_holds
    WHERE stall_holds.user_id = v_current_user_id
      AND stall_holds.stall_instance_id = p_stall_id
      AND stall_holds.market_id = p_market_id;
    RETURN jsonb_build_object(
      'status', 'ok',
      'message', 'Stall holds successfully removed'
    );
  END IF;

  -- *** NEW: Check vendor eligibility (category + tags) ***
  v_eligibility := check_vendor_stall_eligibility(v_current_user_id, p_stall_id);
  IF NOT (v_eligibility->>'eligible')::boolean THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'reason', v_eligibility->>'reason',
      'message', v_eligibility->>'message'
    );
  END IF;

  -- Get stall price from stall_instances and stall_templates
  SELECT COALESCE(si.price_override, st.price)
  INTO v_price_per_day
  FROM public.stall_instances si
  JOIN public.stall_templates st ON si.template_id = st.id
  WHERE si.id = p_stall_id AND si.market_id = p_market_id AND si.status = 'AVAILABLE';

  IF v_price_per_day IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Stall not found or not available'
    );
  END IF;

  -- Check for conflicts against existing holds and bookings
  SELECT COUNT(*) INTO v_conflict_count
  FROM unnest(p_dates) AS requested_date(d)
  WHERE EXISTS (
    SELECT 1 FROM public.stall_holds sh
    WHERE sh.stall_instance_id = p_stall_id
    AND sh.hold_date = requested_date.d
    AND sh.expires_at > now()
    AND sh.user_id != v_current_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.booking_dates bd
    WHERE bd.stall_instance_id = p_stall_id
    AND bd.booking_date = requested_date.d
    AND bd.status IN ('reserved', 'booked')
  );

  IF v_conflict_count > 0 THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'One or more dates are already booked or held by another user'
    );
  END IF;

  -- Remove any existing holds by this user for this stall (cleanup)
  DELETE FROM public.stall_holds
  WHERE stall_holds.user_id = v_current_user_id
    AND stall_holds.stall_instance_id = p_stall_id
    AND stall_holds.market_id = p_market_id;

  -- Calculate totals
  v_total := v_price_per_day * v_days_count;

  -- Insert new holds for each date (idempotent)
  INSERT INTO public.stall_holds (
    user_id,
    stall_instance_id,
    market_id,
    selected_dates,
    hold_date,
    expires_at
  )
  SELECT
    v_current_user_id,
    p_stall_id,
    p_market_id,
    p_dates,
    d,
    now() + INTERVAL '5 minutes'
  FROM unnest(p_dates) AS d
  ON CONFLICT (stall_instance_id, hold_date) DO NOTHING;

  RETURN jsonb_build_object(
    'status', 'ok',
    'days', v_days_count,
    'price_per_day', v_price_per_day,
    'total', v_total,
    'message', 'Stall held successfully for ' || v_days_count || ' days'
  );
END;
$$;
