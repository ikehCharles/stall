-- Phase 3 & 6: Update RPC functions for proper status workflow

-- Update simulate_payment_success to ONLY update payment_status, not booking.status
CREATE OR REPLACE FUNCTION public.simulate_payment_success(p_booking_id uuid)
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
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id AND user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found or unauthorized');
  END IF;

  -- Update payment status and paid amount ONLY (don't touch booking.status)
  UPDATE bookings 
  SET 
    payment_status = 'success',
    paid_amount = total_amount,
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment processed successfully');
END;
$function$;

-- Update admin_approve_booking to handle booking_dates status transition
CREATE OR REPLACE FUNCTION public.admin_approve_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id uuid;
BEGIN
  -- Check if user is admin
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR get_user_role(v_user_id) != 'admin' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Admin access required');
  END IF;

  -- Get booking
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found');
  END IF;

  -- Check if payment is successful
  IF v_booking.payment_status = 'success' THEN
    -- Payment successful + Admin approval = Completed booking with booked dates
    UPDATE bookings 
    SET 
      status = 'completed',
      updated_at = now()
    WHERE id = p_booking_id;
    
    -- Update all booking_dates to 'booked' status
    UPDATE booking_dates
    SET status = 'booked'
    WHERE booking_id = p_booking_id;
    
    RETURN jsonb_build_object(
      'status', 'success', 
      'message', 'Booking approved and marked as completed (payment already received)',
      'booking_status', 'completed'
    );
  ELSE
    -- Payment not yet successful, just approve and wait for payment
    UPDATE bookings 
    SET 
      status = 'approved',
      updated_at = now()
    WHERE id = p_booking_id;
    
    RETURN jsonb_build_object(
      'status', 'success', 
      'message', 'Booking approved. Waiting for payment to complete.',
      'booking_status', 'approved'
    );
  END IF;
END;
$function$;

-- Update admin_decline_booking to update booking_dates status back to 'available'
CREATE OR REPLACE FUNCTION public.admin_decline_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id uuid;
BEGIN
  -- Check if user is admin
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR get_user_role(v_user_id) != 'admin' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Admin access required');
  END IF;

  -- Get booking
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found');
  END IF;

  -- Update booking status to declined
  UPDATE bookings 
  SET 
    status = 'declined',
    updated_at = now()
  WHERE id = p_booking_id;

  -- Release the booking_dates by deleting them (or set to 'available')
  DELETE FROM booking_dates
  WHERE booking_id = p_booking_id;

  -- Release all holds associated with this booking
  DELETE FROM stall_holds 
  WHERE stall_instance_id IN (
    SELECT bs.stall_instance_id 
    FROM booking_stalls bs 
    WHERE bs.booking_id = p_booking_id
  );

  RETURN jsonb_build_object('status', 'success', 'message', 'Booking declined and dates released');
END;
$function$;