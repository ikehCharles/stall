-- Create booking status enum
CREATE TYPE public.booking_status AS ENUM ('pending', 'paid', 'partial', 'cancelled');

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  status booking_status NOT NULL DEFAULT 'pending',
  invoice_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create booking_stalls junction table
CREATE TABLE public.booking_stalls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  stall_instance_id UUID NOT NULL REFERENCES public.stall_instances(id) ON DELETE CASCADE,
  price_at_booking NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint to prevent double booking same stall in same booking
ALTER TABLE public.booking_stalls ADD CONSTRAINT unique_booking_stall 
UNIQUE (booking_id, stall_instance_id);

-- Enable RLS on bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Enable RLS on booking_stalls  
ALTER TABLE public.booking_stalls ENABLE ROW LEVEL SECURITY;

-- RLS policies for bookings
CREATE POLICY "Users can view their own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookings" ON public.bookings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bookings" ON public.bookings
  FOR SELECT USING (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can update all bookings" ON public.bookings
  FOR UPDATE USING (get_user_role(auth.uid()) = 'admin'::app_role);

-- RLS policies for booking_stalls
CREATE POLICY "Users can view stalls from their own bookings" ON public.booking_stalls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings 
      WHERE bookings.id = booking_stalls.booking_id 
      AND bookings.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create stalls for their own bookings" ON public.booking_stalls
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings 
      WHERE bookings.id = booking_stalls.booking_id 
      AND bookings.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all booking stalls" ON public.booking_stalls
  FOR SELECT USING (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can manage all booking stalls" ON public.booking_stalls
  FOR ALL USING (get_user_role(auth.uid()) = 'admin'::app_role);

-- Create trigger for updated_at
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  sequence_part TEXT;
BEGIN
  year_part := EXTRACT(YEAR FROM now())::TEXT;
  
  -- Get next sequence number for this year
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(invoice_number FROM 'INV-' || year_part || '-(.*)') AS INTEGER)), 
    0
  ) + 1 INTO sequence_part
  FROM public.bookings 
  WHERE invoice_number LIKE 'INV-' || year_part || '-%';
  
  RETURN 'INV-' || year_part || '-' || LPAD(sequence_part, 3, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to check if stall is available for booking
CREATE OR REPLACE FUNCTION public.is_stall_available(stall_id UUID, market_id UUID)
RETURNS BOOLEAN AS $$
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
  
  -- Check if stall is already booked (has any paid or pending bookings)
  IF EXISTS (
    SELECT 1 FROM public.booking_stalls bs
    JOIN public.bookings b ON bs.booking_id = b.id
    WHERE bs.stall_instance_id = stall_id
    AND b.status IN ('paid', 'pending', 'partial')
    AND b.market_id = market_id
  ) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;