set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.reserve_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id uuid;
BEGIN
  -- Authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      errcode = 'PT401',
      message = 'Authentication required',
      detail  = 'auth_required';
  END IF;

  -- Fetch booking for this user
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      errcode = 'PT404',
      message = 'Booking not found or unauthorized',
      detail  = 'booking_not_found';
  END IF;

  -- Booking must be unpaid
  IF v_booking.payment_status <> 'pending' THEN
    RAISE EXCEPTION USING
      errcode = 'PT409',
      message = 'Can only reserve an unpaid booking',
      detail  = 'invalid_state';
  END IF;

  -- Reserve booking
  UPDATE bookings
  SET status = 'reserved',
      updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Booking reserved successfully'
  );
END;$function$
;

CREATE OR REPLACE FUNCTION public.admin_approve_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$declare v_booking bookings % ROWTYPE;

v_user_id uuid;

begin v_user_id := auth.uid ();

-- Permission check
IF v_user_id is null
or not has_permission (v_user_id, 'bookings.manage') then RAISE EXCEPTION using ERRCODE = 'P4030',
MESSAGE = 'Admin access required',
DETAIL = 'forbidden';

end IF;

-- Fetch booking
select
  * into v_booking
from
  bookings
where
  id = p_booking_id;

IF not FOUND then RAISE EXCEPTION using ERRCODE = 'P4040',
MESSAGE = 'Booking not found',
DETAIL = 'not_found';

end IF;

-- PAY LATER: Pending payment + Reserved
IF v_booking.payment_status is null
and v_booking.status = 'reserved' then
update bookings
set
  status = 'approved',
  updated_at = NOW()
where
  id = p_booking_id;

-- Update all booking_dates to 'booked' status
update booking_dates
set
  status = 'booked'
where
  booking_id = p_booking_id;

RETURN jsonb_build_object(
  'status',
  'success',
  'message',
  'Booking approved.',
  'booking_status',
  'approved'
);

end IF;

-- Payment not successful
IF v_booking.payment_status <> 'success' then RAISE EXCEPTION using ERRCODE = 'P4020',
MESSAGE = 'Payment not yet processed',
DETAIL = 'payment_not_processed';

end IF;

-- Simply complete the booking
update bookings
set
  status = 'completed',
  updated_at = now()
where
  id = p_booking_id;

-- Update all booking_dates to 'booked' status
update booking_dates
set
  status = 'booked'
where
  booking_id = p_booking_id;

RETURN jsonb_build_object(
  'status',
  'success',
  'message',
  'Booking approved.',
  'booking_status',
  'completed'
);

end;$function$
;

CREATE OR REPLACE FUNCTION public.simulate_payment_success(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Authentication required');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found or unauthorized');
  END IF;


  -- Check if booking is approved
  IF v_booking.payment_status = 'success' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Payment processed successfully');
  END IF;

  -- Update payment status, paid amount, AND booking status
  UPDATE bookings 
  SET 
    payment_status = 'success',
    paid_amount = total_amount,
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment processed successfully');
END;$function$
;

CREATE OR REPLACE FUNCTION public.simulate_payment_success_admin(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found');
  END IF;

  -- Check if booking is approved
  IF v_booking.payment_status = 'success' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Payment processed successfully');
  END IF;


  UPDATE bookings 
  SET 
    payment_status = 'success',
    paid_amount = total_amount,
    updated_at = now()
  WHERE id = p_booking_id;

  UPDATE booking_dates
  SET status = 'booked'
  WHERE booking_id = p_booking_id;


  RETURN jsonb_build_object('status', 'success', 'message', 'Payment processed successfully');
END;$function$
;

CREATE OR REPLACE FUNCTION public.update_stall_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$BEGIN
  UPDATE stall_instances si
  SET status = CASE
    WHEN (
      SELECT COUNT(DISTINCT bd.booking_date)
      FROM booking_dates bd
      WHERE bd.stall_instance_id = si.id
    ) >= (
      SELECT COUNT(*)
      FROM generate_series(
        GREATEST((SELECT start_at::date FROM markets WHERE id = si.market_id), CURRENT_DATE),
        (SELECT end_at::date FROM markets WHERE id = si.market_id),
        '1 day'::interval
      )
    )
    THEN 'BOOKED'::public.stall_status
    ELSE 'AVAILABLE'::public.stall_status
  END
  WHERE si.id = COALESCE(NEW.stall_instance_id, OLD.stall_instance_id);

  RETURN NEW;
END;$function$
;


