-- Fix RLS policies to allow vendors to view stall templates for published markets
DROP POLICY IF EXISTS "Vendors can view templates for published markets" ON public.stall_templates;

CREATE POLICY "Vendors can view templates for published markets" 
ON public.stall_templates 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.stall_instances si
    JOIN public.markets m ON si.market_id = m.id
    WHERE si.template_id = stall_templates.id 
    AND m.status = 'PUBLISHED'
  )
);

-- Improve create_stall_hold function with better authentication checks and error messages
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
  DELETE FROM public.stall_holds
  WHERE user_id = current_user_id
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
    current_user_id,
    stall_id,
    create_stall_hold.market_id,
    dates,
    now() + INTERVAL '5 minutes'
  ) RETURNING id INTO hold_id;
  
  RETURN hold_id;
END;
$$;