-- Fix search_path for security functions
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix search_path for stall availability function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;