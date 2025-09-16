-- Create booking_dates table for daily stall bookings
CREATE TABLE public.booking_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  stall_instance_id UUID NOT NULL REFERENCES public.stall_instances(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(stall_instance_id, booking_date)
);

-- Create stall_holds table for temporary reservations (5 minute holds)
CREATE TABLE public.stall_holds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stall_instance_id UUID NOT NULL REFERENCES public.stall_instances(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  selected_dates DATE[] NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Update bookings table with date-related fields
ALTER TABLE public.bookings 
ADD COLUMN selected_dates DATE[],
ADD COLUMN days_count INTEGER DEFAULT 1,
ADD COLUMN price_per_day NUMERIC;

-- Enable RLS on new tables
ALTER TABLE public.booking_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stall_holds ENABLE ROW LEVEL SECURITY;

-- RLS policies for booking_dates
CREATE POLICY "Users can view booking dates for their own bookings" 
ON public.booking_dates FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.bookings 
  WHERE bookings.id = booking_dates.booking_id 
  AND bookings.user_id = auth.uid()
));

CREATE POLICY "Users can create booking dates for their own bookings" 
ON public.booking_dates FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.bookings 
  WHERE bookings.id = booking_dates.booking_id 
  AND bookings.user_id = auth.uid()
));

CREATE POLICY "Admins can view all booking dates" 
ON public.booking_dates FOR SELECT 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

-- RLS policies for stall_holds
CREATE POLICY "Users can manage their own holds" 
ON public.stall_holds FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all holds" 
ON public.stall_holds FOR SELECT 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

-- Function to check stall availability for specific dates
CREATE OR REPLACE FUNCTION public.check_stall_date_availability(
  stall_id UUID, 
  market_id UUID, 
  dates DATE[]
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if stall exists and is available
  IF NOT EXISTS (
    SELECT 1 FROM public.stall_instances si
    WHERE si.id = stall_id 
    AND si.market_id = market_id 
    AND si.status = 'AVAILABLE'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Check if any of the requested dates are already booked
  IF EXISTS (
    SELECT 1 FROM public.booking_dates bd
    JOIN public.bookings b ON bd.booking_id = b.id
    WHERE bd.stall_instance_id = stall_id
    AND bd.booking_date = ANY(dates)
    AND b.status IN ('paid', 'pending', 'partial')
    AND b.market_id = market_id
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Check if any dates are currently held by another user
  IF EXISTS (
    SELECT 1 FROM public.stall_holds sh
    WHERE sh.stall_instance_id = stall_id
    AND sh.market_id = market_id
    AND sh.selected_dates && dates
    AND sh.expires_at > now()
    AND sh.user_id != auth.uid()
  ) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function to create/update stall hold
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
  
  -- Remove any existing holds by this user for this stall
  DELETE FROM public.stall_holds
  WHERE user_id = auth.uid()
  AND stall_instance_id = stall_id
  AND market_id = market_id;
  
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
    market_id,
    dates,
    now() + INTERVAL '5 minutes'
  ) RETURNING id INTO hold_id;
  
  RETURN hold_id;
END;
$$;

-- Function to cleanup expired holds
CREATE OR REPLACE FUNCTION public.cleanup_expired_holds()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.stall_holds
  WHERE expires_at <= now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Create indexes for performance
CREATE INDEX idx_booking_dates_stall_date ON public.booking_dates(stall_instance_id, booking_date);
CREATE INDEX idx_stall_holds_expiry ON public.stall_holds(expires_at);
CREATE INDEX idx_stall_holds_user_stall ON public.stall_holds(user_id, stall_instance_id);

-- Add check constraint for booking days limit
ALTER TABLE public.bookings 
ADD CONSTRAINT check_days_count_limit 
CHECK (days_count >= 1 AND days_count <= 5);