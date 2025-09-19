-- Update some existing test bookings to use the new dual status system for testing
-- Set a few bookings to awaiting_admin status so we can test admin approval functionality

-- Update a few bookings to have awaiting_admin status and success payment status
UPDATE bookings 
SET 
  status = 'awaiting_admin',
  payment_status = 'success',
  updated_at = now()
WHERE id IN (
  SELECT id 
  FROM bookings 
  WHERE status IN ('completed', 'pending') 
  AND payment_status = 'pending'
  LIMIT 3
);

-- Update some bookings to have the correct payment status based on their paid amount
UPDATE bookings 
SET 
  payment_status = CASE 
    WHEN paid_amount >= total_amount THEN 'success'
    WHEN paid_amount > 0 THEN 'pending'
    ELSE 'pending'
  END,
  updated_at = now()
WHERE payment_status = 'pending';