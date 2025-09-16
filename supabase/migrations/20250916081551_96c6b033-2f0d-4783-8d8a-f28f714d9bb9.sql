-- Fix the create_stall_hold function to properly reference the market_id parameter
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
BEGIN
  -- Check availability first
  IF NOT check_stall_date_availability(stall_id, market_id, dates) THEN
    RAISE EXCEPTION 'Stall dates not available for booking';
  END IF;
  
  -- Remove any existing holds by this user for this stall and market
  DELETE FROM public.stall_holds
  WHERE user_id = auth.uid()
  AND stall_instance_id = stall_id
  AND market_id = create_stall_hold.market_id;
  
  -- Create new hold (5 minute expiry)
  INSERT INTO public.stall_holds (
    user_id,
    stall_instance_id,
    market_id,
    selected_dates,
    expires_at
  ) VALUES (
    auth.uid(),
    stall_id,
    create_stall_hold.market_id,
    dates,
    now() + INTERVAL '5 minutes'
  ) RETURNING id INTO hold_id;
  
  RETURN hold_id;
END;
$$;