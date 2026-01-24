-- When expiring a booking, mark booking_dates as 'available' so those stall/date slots can be
-- rebooked, while keeping the rows for historical records of what was held for the expired booking.

CREATE OR REPLACE FUNCTION public.expire_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Authentication required');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id AND user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found or unauthorized');
  END IF;

  -- Check if booking is expired
  IF v_booking.hold_expires_at IS NULL OR v_booking.hold_expires_at > now() THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking is not expired');
  END IF;

  -- Check if already paid
  IF v_booking.payment_status = 'success' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Cannot expire a paid booking');
  END IF;

  -- Mark as expired and cancel payment
  UPDATE bookings 
  SET 
    status = 'expired',
    payment_status = 'cancelled',
    updated_at = now()
  WHERE id = p_booking_id;

  -- Mark booking_dates as 'available' so stall/date slots can be rebooked (keep rows for records)
  UPDATE booking_dates
  SET status = 'available'
  WHERE booking_id = p_booking_id;

  -- Remove all holds
  DELETE FROM stall_holds 
  WHERE user_id = v_user_id 
  AND stall_instance_id IN (
    SELECT bs.stall_instance_id 
    FROM booking_stalls bs 
    WHERE bs.booking_id = p_booking_id
  );

  RETURN jsonb_build_object('status', 'success', 'message', 'Booking expired and holds released');
END;
$function$;

-- Allow multiple booking_dates rows per (stall_instance_id, booking_date) when status = 'available',
-- so we can keep records from expired/cancelled bookings. Uniqueness still enforced for
-- status IN ('reserved', 'booked') to prevent double-booking.

-- Drop existing unique constraint(s) on (stall_instance_id, booking_date)
ALTER TABLE public.booking_dates
  DROP CONSTRAINT IF EXISTS booking_dates_stall_instance_id_booking_date_key;

ALTER TABLE public.booking_dates
  DROP CONSTRAINT IF EXISTS unique_stall_booking_date;

-- Enforce at most one reserved/booked per stall/date; allow multiple 'available' for history
CREATE UNIQUE INDEX booking_dates_stall_date_reserved_or_booked_key
  ON public.booking_dates (stall_instance_id, booking_date)
  WHERE status IN ('reserved', 'booked');
