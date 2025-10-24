-- Phase 1 & 2: Fix Booking & Payment Workflow (Fixed)

-- Step 1: Migrate existing data to new status values
UPDATE public.bookings 
SET status = 'pending'::booking_status 
WHERE status = 'awaiting_admin'::booking_status;

UPDATE public.bookings 
SET status = 'cancelled'::booking_status 
WHERE status = 'declined'::booking_status;

-- Step 2: Remove obsolete booking_status enum values (fixed default handling)
ALTER TABLE bookings ALTER COLUMN status DROP DEFAULT;

ALTER TYPE booking_status RENAME TO booking_status_old;

CREATE TYPE booking_status AS ENUM ('pending', 'approved', 'completed', 'cancelled', 'expired');

ALTER TABLE bookings 
  ALTER COLUMN status TYPE booking_status USING status::text::booking_status;

ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'pending'::booking_status;

DROP TYPE booking_status_old;

-- Step 3: Update simulate_payment_success - marks booking as completed
DROP FUNCTION IF EXISTS public.simulate_payment_success(uuid);
CREATE OR REPLACE FUNCTION public.simulate_payment_success(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Check if booking is approved
  IF v_booking.status != 'approved' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking must be approved before payment');
  END IF;

  -- Update payment status, paid amount, AND booking status
  UPDATE bookings 
  SET 
    payment_status = 'success',
    paid_amount = total_amount,
    status = 'completed',
    updated_at = now()
  WHERE id = p_booking_id;

  -- Update all booking_dates to 'booked' status
  UPDATE booking_dates
  SET status = 'booked'
  WHERE booking_id = p_booking_id;

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment processed successfully');
END;
$$;

-- Step 4: Update simulate_payment_failure - cancels booking and releases stalls
DROP FUNCTION IF EXISTS public.simulate_payment_failure(uuid);
CREATE OR REPLACE FUNCTION public.simulate_payment_failure(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Cancel booking and payment
  UPDATE bookings 
  SET 
    payment_status = 'failed',
    status = 'cancelled',
    updated_at = now()
  WHERE id = p_booking_id;

  -- Release all booking_dates
  DELETE FROM booking_dates
  WHERE booking_id = p_booking_id;

  -- Release all holds
  DELETE FROM stall_holds 
  WHERE user_id = v_user_id 
  AND stall_instance_id IN (
    SELECT bs.stall_instance_id 
    FROM booking_stalls bs 
    WHERE bs.booking_id = p_booking_id
  );

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment marked as failed and booking cancelled');
END;
$$;

-- Step 5: Update admin_approve_booking - only approves, separate from payment
CREATE OR REPLACE FUNCTION public.admin_approve_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR get_user_role(v_user_id) != 'admin' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Admin access required');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found');
  END IF;

  -- Check if already paid
  IF v_booking.payment_status = 'success' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Payment already processed - booking is already completed');
  END IF;

  -- Simply approve the booking
  UPDATE bookings 
  SET 
    status = 'approved',
    updated_at = now()
  WHERE id = p_booking_id;
  
  RETURN jsonb_build_object(
    'status', 'success', 
    'message', 'Booking approved. Vendor can now proceed with payment.',
    'booking_status', 'approved'
  );
END;
$$;

-- Step 6: Update admin_decline_booking - fully cancels and releases
CREATE OR REPLACE FUNCTION public.admin_decline_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR get_user_role(v_user_id) != 'admin' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Admin access required');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found');
  END IF;

  -- Cancel booking and payment
  UPDATE bookings 
  SET 
    status = 'cancelled',
    payment_status = 'cancelled',
    updated_at = now()
  WHERE id = p_booking_id;

  -- Release all booking_dates
  DELETE FROM booking_dates
  WHERE booking_id = p_booking_id;

  -- Release all holds
  DELETE FROM stall_holds 
  WHERE stall_instance_id IN (
    SELECT bs.stall_instance_id 
    FROM booking_stalls bs 
    WHERE bs.booking_id = p_booking_id
  );

  RETURN jsonb_build_object('status', 'success', 'message', 'Booking declined and dates released');
END;
$$;

-- Step 7: Update expire_booking - also cancels payment
DROP FUNCTION IF EXISTS public.expire_booking(uuid);
CREATE OR REPLACE FUNCTION public.expire_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Step 8: Create NEW cancel_booking function for vendor-initiated cancellation
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Cannot cancel already paid bookings
  IF v_booking.payment_status = 'success' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Cannot cancel a paid booking');
  END IF;

  -- Cancel booking and payment
  UPDATE bookings 
  SET 
    status = 'cancelled',
    payment_status = 'cancelled',
    updated_at = now()
  WHERE id = p_booking_id;

  -- Release all booking_dates
  DELETE FROM booking_dates
  WHERE booking_id = p_booking_id;

  -- Release all holds
  DELETE FROM stall_holds 
  WHERE user_id = v_user_id 
  AND stall_instance_id IN (
    SELECT bs.stall_instance_id 
    FROM booking_stalls bs 
    WHERE bs.booking_id = p_booking_id
  );

  RETURN jsonb_build_object('status', 'success', 'message', 'Booking cancelled successfully');
END;
$$;