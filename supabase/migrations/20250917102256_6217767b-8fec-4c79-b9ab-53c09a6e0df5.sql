-- Add hold_expires_at field to bookings table
ALTER TABLE public.bookings ADD COLUMN hold_expires_at timestamp with time zone;

-- Add new booking status values
ALTER TYPE booking_status ADD VALUE 'expired';
ALTER TYPE booking_status ADD VALUE 'completed';
ALTER TYPE booking_status ADD VALUE 'failed';

-- Create RPC function to simulate payment success
CREATE OR REPLACE FUNCTION public.simulate_payment_success(booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Authentication required');
  END IF;

  -- Get and verify booking ownership
  SELECT * INTO v_booking FROM bookings WHERE id = booking_id AND user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found or unauthorized');
  END IF;

  -- Update booking to completed status
  UPDATE bookings 
  SET 
    status = 'completed',
    paid_amount = total_amount,
    updated_at = now()
  WHERE id = booking_id;

  -- Remove any active holds for this booking
  DELETE FROM stall_holds 
  WHERE user_id = v_user_id 
  AND stall_instance_id IN (
    SELECT bs.stall_instance_id 
    FROM booking_stalls bs 
    WHERE bs.booking_id = booking_id
  );

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment processed successfully');
END;
$function$;

-- Create RPC function to simulate payment failure
CREATE OR REPLACE FUNCTION public.simulate_payment_failure(booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Authentication required');
  END IF;

  -- Get and verify booking ownership
  SELECT * INTO v_booking FROM bookings WHERE id = booking_id AND user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found or unauthorized');
  END IF;

  -- Update booking to failed status
  UPDATE bookings 
  SET 
    status = 'failed',
    updated_at = now()
  WHERE id = booking_id;

  -- Remove all holds associated with this booking to make dates available
  DELETE FROM stall_holds 
  WHERE user_id = v_user_id 
  AND stall_instance_id IN (
    SELECT bs.stall_instance_id 
    FROM booking_stalls bs 
    WHERE bs.booking_id = booking_id
  );

  RETURN jsonb_build_object('status', 'success', 'message', 'Booking marked as failed, holds released');
END;
$function$;

-- Create RPC function to expire old bookings
CREATE OR REPLACE FUNCTION public.expire_booking(booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Authentication required');
  END IF;

  -- Get and verify booking ownership
  SELECT * INTO v_booking FROM bookings WHERE id = booking_id AND user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found or unauthorized');
  END IF;

  -- Check if booking is expired
  IF v_booking.hold_expires_at IS NULL OR v_booking.hold_expires_at > now() THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking is not expired');
  END IF;

  -- Update booking to expired status
  UPDATE bookings 
  SET 
    status = 'expired',
    updated_at = now()
  WHERE id = booking_id;

  -- Remove all holds associated with this booking
  DELETE FROM stall_holds 
  WHERE user_id = v_user_id 
  AND stall_instance_id IN (
    SELECT bs.stall_instance_id 
    FROM booking_stalls bs 
    WHERE bs.booking_id = booking_id
  );

  RETURN jsonb_build_object('status', 'success', 'message', 'Booking expired and holds released');
END;
$function$;