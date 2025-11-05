-- Add payment_status enum
CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'cancelled');

-- Update booking_status enum to include admin workflow and remove payment-specific states
ALTER TYPE booking_status ADD VALUE 'awaiting_admin';
ALTER TYPE booking_status ADD VALUE 'approved';
ALTER TYPE booking_status ADD VALUE 'declined';

-- Add payment_status column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN payment_status payment_status NOT NULL DEFAULT 'pending';

-- Update existing bookings to map old statuses to new dual status system
UPDATE public.bookings 
SET 
  payment_status = CASE 
    WHEN status = 'paid' THEN 'success'::payment_status
    WHEN status = 'partial' THEN 'pending'::payment_status
    WHEN status = 'failed' THEN 'failed'::payment_status
    WHEN status = 'cancelled' THEN 'cancelled'::payment_status
    ELSE 'pending'::payment_status
  END,
  status = CASE 
    WHEN status = 'paid' THEN 'completed'::booking_status
    WHEN status = 'partial' THEN 'pending'::booking_status
    WHEN status = 'failed' THEN 'pending'::booking_status
    WHEN status = 'cancelled' THEN 'cancelled'::booking_status
    ELSE status
  END;

-- Update payment simulation functions to only handle payment_status
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

  -- Update payment status and paid amount
  UPDATE bookings 
  SET 
    payment_status = 'success',
    paid_amount = total_amount,
    updated_at = now()
  WHERE id = p_booking_id;

  -- If booking is approved and payment is now successful, mark as completed
  UPDATE bookings 
  SET status = 'completed'
  WHERE id = p_booking_id 
    AND status = 'approved' 
    AND payment_status = 'success';

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment processed successfully');
END;
$$;

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

  -- Update payment status to failed
  UPDATE bookings 
  SET 
    payment_status = 'failed',
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment marked as failed');
END;
$$;

-- Create admin confirmation functions
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

  -- Update booking status to approved
  UPDATE bookings 
  SET 
    status = 'approved',
    updated_at = now()
  WHERE id = p_booking_id;

  -- If payment is successful and booking is now approved, mark as completed
  UPDATE bookings 
  SET status = 'completed'
  WHERE id = p_booking_id 
    AND status = 'approved' 
    AND payment_status = 'success';

  RETURN jsonb_build_object('status', 'success', 'message', 'Booking approved successfully');
END;
$$;

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

  -- Release all holds associated with this booking
  DELETE FROM stall_holds 
  WHERE stall_instance_id IN (
    SELECT bs.stall_instance_id 
    FROM booking_stalls bs 
    WHERE bs.booking_id = p_booking_id
  );

  RETURN jsonb_build_object('status', 'success', 'message', 'Booking declined and holds released');
END;
$$;