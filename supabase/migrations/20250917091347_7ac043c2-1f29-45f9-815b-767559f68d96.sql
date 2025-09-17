-- Fix ambiguous column reference in create_stall_hold function
CREATE OR REPLACE FUNCTION public.create_stall_hold(
  stall_id UUID,
  market_id UUID,
  dates DATE[]
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  hold_id UUID;
  current_user_id UUID;
BEGIN
  -- Check if user is authenticated
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to reserve a stall';
  END IF;
  
  -- Check availability first
  IF NOT check_stall_date_availability(stall_id, market_id, dates) THEN
    RAISE EXCEPTION 'Selected dates are not available for this stall';
  END IF;
  
  -- Remove any existing holds by this user for this stall and market
  -- Fix: Explicitly qualify the table column names to avoid ambiguity
  DELETE FROM public.stall_holds
  WHERE stall_holds.user_id = current_user_id
  AND stall_holds.stall_instance_id = stall_id
  AND stall_holds.market_id = create_stall_hold.market_id;
  
  -- Create new hold (5 minute expiry)
  INSERT INTO public.stall_holds (
    user_id,
    stall_instance_id,
    market_id,
    selected_dates,
    expires_at
  ) VALUES (
    current_user_id,
    stall_id,
    create_stall_hold.market_id,
    dates,
    now() + INTERVAL '5 minutes'
  ) RETURNING id INTO hold_id;
  
  RETURN hold_id;
END;
$$;