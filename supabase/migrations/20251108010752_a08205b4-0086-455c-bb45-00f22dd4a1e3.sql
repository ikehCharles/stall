-- Add FCA tracking columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by_fca_id UUID REFERENCES auth.users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fca_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_created_by_fca ON bookings(created_by_fca_id) WHERE created_by_fca_id IS NOT NULL;

-- Function to lookup vendor by email
CREATE OR REPLACE FUNCTION lookup_vendor_by_email(p_email TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  phone_number TEXT,
  company_name TEXT,
  kyc_status TEXT,
  kyc_id UUID,
  has_unpaid_bookings BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    p.phone_number,
    p.company_name,
    COALESCE(k.status::TEXT, 'NONE') as kyc_status,
    k.id as kyc_id,
    EXISTS(
      SELECT 1 FROM bookings b 
      WHERE b.user_id = p.id 
      AND b.payment_status != 'success'
      AND b.status NOT IN ('cancelled', 'expired')
    ) as has_unpaid_bookings
  FROM profiles p
  LEFT JOIN kyc_applications k ON k.user_id = p.id
  WHERE LOWER(p.email) = LOWER(p_email)
  ORDER BY k.created_at DESC
  LIMIT 1;
END;
$$;

-- Function to get unpaid invoice for specific stall and vendor
CREATE OR REPLACE FUNCTION get_unpaid_invoice_for_stall(
  p_stall_id UUID,
  p_vendor_id UUID
)
RETURNS TABLE (
  booking_id UUID,
  invoice_number TEXT,
  total_amount NUMERIC,
  paid_amount NUMERIC,
  outstanding_amount NUMERIC,
  booking_dates DATE[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as booking_id,
    b.invoice_number,
    b.total_amount,
    b.paid_amount,
    (b.total_amount - b.paid_amount) as outstanding_amount,
    ARRAY_AGG(bd.booking_date ORDER BY bd.booking_date) as booking_dates
  FROM bookings b
  JOIN booking_stalls bs ON bs.booking_id = b.id
  JOIN booking_dates bd ON bd.booking_id = b.id AND bd.stall_instance_id = bs.stall_instance_id
  WHERE bs.stall_instance_id = p_stall_id
  AND b.user_id = p_vendor_id
  AND b.payment_status != 'success'
  AND b.status IN ('pending', 'approved')
  GROUP BY b.id
  ORDER BY b.created_at DESC
  LIMIT 1;
END;
$$;