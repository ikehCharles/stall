set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.admin_approve_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR NOT has_permission(v_user_id, 'bookings.manage') THEN
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
END;$function$
;

CREATE OR REPLACE FUNCTION public.admin_decline_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR NOT has_permission(v_user_id, 'bookings.manage') THEN
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
END;$function$
;

create or replace function public.profile_checks(p_phone text)
returns jsonb
language plpgsql
security definer
as $$
begin
  if exists (select 1 from public.profiles where phone_number = p_phone) then
    raise exception using
      errcode = 'PT400',                    
      message = 'Phone number already in use',
      detail  = 'phone_taken';
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'message', 'Phone number is available'
  );
end;
$$;

grant execute on function public.profile_checks(text) to anon;
