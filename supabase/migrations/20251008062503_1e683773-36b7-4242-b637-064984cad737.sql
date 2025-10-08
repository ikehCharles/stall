-- Phase 5: Add server-side validation for 5-day booking limit

-- Update create_stall_hold to enforce 5-day maximum
CREATE OR REPLACE FUNCTION public.create_stall_hold(p_stall_id uuid, p_market_id uuid, p_dates date[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_price_per_day NUMERIC;
  v_conflict_count INT;
  v_current_user_id UUID;
  v_days_count INT;
  v_total NUMERIC;
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
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'At least 1 day must be selected'
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
$function$;