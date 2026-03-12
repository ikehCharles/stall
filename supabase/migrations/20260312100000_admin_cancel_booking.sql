-- ============================================================
-- admin_cancel_booking: lets admins/FCA cancel any booking
-- ============================================================
-- Unlike the vendor cancel_booking() which checks user_id = auth.uid(),
-- this checks has_permission(auth.uid(), 'bookings.manage').
-- Payment status stays unchanged (matching decline-booking edge function).
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_cancel_booking(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id  UUID;
  v_booking  bookings%ROWTYPE;
BEGIN
  -- 1. Auth check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Authentication required');
  END IF;

  -- 2. Permission check
  IF NOT has_permission(v_user_id, 'bookings.manage') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Permission denied: bookings.manage required');
  END IF;

  -- 3. Fetch booking (no user_id filter — admin can act on any booking)
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found');
  END IF;

  IF v_booking.status = 'cancelled' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking is already cancelled');
  END IF;

  -- 4. Cancel the booking — keep payment_status as-is
  UPDATE bookings
  SET status     = 'cancelled',
      updated_at = now()
  WHERE id = p_booking_id;

  -- 5. Release booking_dates
  DELETE FROM booking_dates WHERE booking_id = p_booking_id;

  -- 6. Release stall holds
  DELETE FROM stall_holds
  WHERE stall_instance_id IN (
    SELECT bs.stall_instance_id
    FROM booking_stalls bs
    WHERE bs.booking_id = p_booking_id
  );

  -- 7. Audit log
  PERFORM log_audit_entry(
    'bookings', p_booking_id, 'booking_cancelled', v_user_id,
    v_booking.status::TEXT, 'cancelled', 'Admin-initiated cancellation',
    jsonb_build_object(
      'payment_status', v_booking.payment_status::TEXT,
      'total_amount',   v_booking.total_amount::TEXT,
      'vendor_id',      v_booking.user_id::TEXT
    )
  );

  RETURN jsonb_build_object('status', 'success', 'message', 'Booking cancelled successfully');
END;
$$;
