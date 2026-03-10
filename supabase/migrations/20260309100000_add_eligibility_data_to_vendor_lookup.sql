-- ============================================================
-- Update lookup_vendor_in_market to include vendor eligibility
-- data (business_type_id + vendor_tags) so the FCA UI can check
-- stall eligibility before allowing booking.
-- ============================================================

CREATE OR REPLACE FUNCTION public.lookup_vendor_in_market(p_email text, p_market_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_user_id uuid;
  v_profile jsonb;
  v_bookings jsonb;
  v_business_type_id uuid;
  v_vendor_tag_ids jsonb;
BEGIN
  -------------------------------------------------------------------
  -- 1. Permission check
  -------------------------------------------------------------------
  IF NOT has_permission(auth.uid(), 'vendors.lookup') THEN
    RAISE EXCEPTION
      'Permission denied (%). Required: necessary permission',
      auth.uid() USING ERRCODE = 'P4030';
  END IF;

  -------------------------------------------------------------------
  -- 2. Fetch user profile + latest KYC in ONE query
  -------------------------------------------------------------------
  SELECT
    p.id,
    jsonb_build_object(
      'user_id',           p.id,
      'email',             p.email,
      'full_name',         p.full_name,
      'phone_number',      p.phone_number,
      'company_name',      p.company_name,
      'last_login_at',     p.last_login_at,
      'kyc_status',        k.status,
      'kyc_id',            k.id,
      'kyc_contact_email', k.contact_email,
      'business_type_id',  k.business_type_id
    )
  INTO v_user_id, v_profile
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT id, status, contact_email, business_type_id
    FROM public.kyc_applications
    WHERE user_id = p.id
    ORDER BY created_at DESC
    LIMIT 1
  ) k ON TRUE
  WHERE LOWER(p.email) = LOWER(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found for email %', p_email USING ERRCODE = 'P4040';
  END IF;

  -------------------------------------------------------------------
  -- 2b. Ensure the user has a vendor role
  -------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_user_id
      AND r.key = 'vendor'
  ) THEN
    RAISE EXCEPTION 'User % is not a vendor', p_email USING ERRCODE = 'P4031';
  END IF;

  -------------------------------------------------------------------
  -- 2c. Fetch vendor tag IDs from vendor_tags junction table
  -------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(vt.tag_id), '[]'::jsonb)
  INTO v_vendor_tag_ids
  FROM public.vendor_tags vt
  WHERE vt.user_id = v_user_id;

  -- Merge vendor_tag_ids into profile object
  v_profile := v_profile || jsonb_build_object('vendor_tag_ids', v_vendor_tag_ids);

  -------------------------------------------------------------------
  -- 3. Fetch all bookings for this market
  -------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'id',              b.id,
             'market_id',       b.market_id,
             'invoice_number',  b.invoice_number,
             'selected_dates',  b.selected_dates,
             'status',          b.status,
             'payment_status',  b.payment_status,
             'total_amount',    b.total_amount,
             'paid_amount',     b.paid_amount,
             'days_count',      b.days_count,
             'created_at',      b.created_at
           )
         ), '[]'::jsonb)
  INTO v_bookings
  FROM public.bookings b
  WHERE b.user_id = v_user_id
    AND b.market_id = p_market_id;

  -------------------------------------------------------------------
  -- 4. Return final JSON payload
  -------------------------------------------------------------------
  RETURN jsonb_build_object(
    'profile',  v_profile,
    'bookings', v_bookings
  );

END$function$;
