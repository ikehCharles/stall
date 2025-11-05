-- Complete stall booking system fix
-- 1. Add unique constraints to prevent double-booking
ALTER TABLE public.booking_dates DROP CONSTRAINT IF EXISTS unique_stall_booking_date;
ALTER TABLE public.booking_dates 
ADD CONSTRAINT unique_stall_booking_date UNIQUE (stall_instance_id, booking_date);

-- 2. Restructure stall_holds table for individual date rows
-- Add hold_date column for individual date tracking
ALTER TABLE public.stall_holds DROP COLUMN IF EXISTS hold_date;
ALTER TABLE public.stall_holds ADD COLUMN hold_date DATE;

-- Add unique constraint for holds
ALTER TABLE public.stall_holds 
ADD CONSTRAINT unique_stall_hold_date UNIQUE (stall_instance_id, hold_date);

-- 3. Drop existing function and recreate with JSON response
DROP FUNCTION IF EXISTS public.create_stall_hold(uuid,uuid,date[]);
CREATE OR REPLACE FUNCTION public.create_stall_hold(
  p_stall_id UUID,
  p_market_id UUID,
  p_dates DATE[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
    JOIN public.bookings b ON bd.booking_id = b.id
    WHERE bd.stall_instance_id = p_stall_id 
    AND bd.booking_date = requested_date.d
    AND b.status IN ('paid', 'pending', 'partial')
    AND b.market_id = p_market_id
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
  v_days_count := cardinality(p_dates);
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