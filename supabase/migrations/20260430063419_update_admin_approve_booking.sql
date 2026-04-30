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
IF (
    v_booking.payment_status IS NULL
    OR v_booking.payment_status = 'pending'
)
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