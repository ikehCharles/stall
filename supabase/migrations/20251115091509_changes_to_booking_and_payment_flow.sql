alter table "public"."bookings" alter column "status" drop default;

alter type "public"."booking_status" rename to "booking_status__old_version_to_be_dropped";

create type "public"."booking_status" as enum ('pending', 'approved', 'completed', 'cancelled', 'expired', 'reserved');

alter type "public"."payment_status" rename to "payment_status__old_version_to_be_dropped";

create type "public"."payment_status" as enum ('pending', 'success', 'failed', 'cancelled', 'authorized');

alter table "public"."bookings" alter column payment_status type "public"."payment_status" using payment_status::text::"public"."payment_status";

alter table "public"."bookings" alter column status type "public"."booking_status" using status::text::"public"."booking_status";

alter table "public"."bookings" alter column "status" set default 'pending'::booking_status;

drop type "public"."booking_status__old_version_to_be_dropped";

drop type "public"."payment_status__old_version_to_be_dropped";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.simulate_payment_cancelled_admin(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$DECLARE
  v_booking bookings%ROWTYPE;
BEGIN

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found or unauthorized');
  END IF;

  -- Cancel booking and payment
  UPDATE bookings 
  SET 
    payment_status = 'cancelled',
    status = 'cancelled',
    updated_at = now()
  WHERE id = p_booking_id;

  -- Release all booking_dates
  DELETE FROM booking_dates
  WHERE booking_id = p_booking_id;

  -- Release all holds
  DELETE FROM stall_holds 
  WHERE user_id = v_booking.user_id 
  AND stall_instance_id IN (
    SELECT bs.stall_instance_id 
    FROM booking_stalls bs 
    WHERE bs.booking_id = p_booking_id
  );

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment marked as failed and booking cancelled');
END;$function$
;

CREATE OR REPLACE FUNCTION public.simulate_payment_failure_admin(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$DECLARE
  v_booking bookings%ROWTYPE;
BEGIN

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found or unauthorized');
  END IF;

  IF v_booking.payment_status = 'failed' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Payment marked as failed and booking cancelled');
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
  WHERE user_id = v_booking.user_id 
  AND stall_instance_id IN (
    SELECT bs.stall_instance_id 
    FROM booking_stalls bs 
    WHERE bs.booking_id = p_booking_id
  );

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment marked as failed and booking cancelled');
END;$function$
;

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
  IF v_booking.payment_status <> 'success' THEN
  raise exception using
      errcode = 'PT400',                    
      message = 'Payment not yet processed',
      detail  = 'no_payment';
  END IF;

  -- Simply complete the booking
  UPDATE bookings 
  SET 
    status = 'completed',
    updated_at = now()
  WHERE id = p_booking_id;
  
  RETURN jsonb_build_object(
    'status', 'success', 
    'message', 'Booking approved.',
    'booking_status', 'completed'
  );
END;$function$
;

CREATE OR REPLACE FUNCTION public.create_stall_hold(p_stall_id uuid, p_market_id uuid, p_dates date[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$DECLARE
  v_price_per_day NUMERIC;
  v_conflict_count INT;
  v_current_user_id UUID;
  v_days_count INT;
  v_total NUMERIC;
BEGIN
  -- Check if user is authenticated
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Authentication required to reserve a stall'
    );
  END IF;
  
  -- Validate 5-day maximum
  v_days_count := cardinality(p_dates);
  IF v_days_count > 5 THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Maximum 5 days can be selected per booking'
    );
  END IF;
  
  IF v_days_count < 1 THEN
   -- Remove any existing holds by this user for this stall (cleanup)
  DELETE FROM public.stall_holds
  WHERE stall_holds.user_id = v_current_user_id
  AND stall_holds.stall_instance_id = p_stall_id
  AND stall_holds.market_id = p_market_id;
    RETURN jsonb_build_object(
      'status', 'ok',
      'message', 'Stall holds successfully removed'
    );
  END IF;
  
  -- Get stall price from stall_instances and stall_templates
  SELECT COALESCE(si.price_override, st.price)
  INTO v_price_per_day
  FROM public.stall_instances si
  JOIN public.stall_templates st ON si.template_id = st.id
  WHERE si.id = p_stall_id AND si.market_id = p_market_id AND si.status = 'AVAILABLE';
  
  IF v_price_per_day IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Stall not found or not available'
    );
  END IF;
  
  -- Check for conflicts against existing holds and bookings
  SELECT COUNT(*) INTO v_conflict_count
  FROM unnest(p_dates) AS requested_date(d)
  WHERE EXISTS (
    SELECT 1 FROM public.stall_holds sh
    WHERE sh.stall_instance_id = p_stall_id 
    AND sh.hold_date = requested_date.d
    AND sh.expires_at > now()
    AND sh.user_id != v_current_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.booking_dates bd
    WHERE bd.stall_instance_id = p_stall_id 
    AND bd.booking_date = requested_date.d
    AND bd.status IN ('reserved', 'booked')
  );
  
  IF v_conflict_count > 0 THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'One or more dates are already booked or held by another user'
    );
  END IF;
  
  -- Remove any existing holds by this user for this stall (cleanup)
  DELETE FROM public.stall_holds
  WHERE stall_holds.user_id = v_current_user_id
  AND stall_holds.stall_instance_id = p_stall_id
  AND stall_holds.market_id = p_market_id;
  
  -- Calculate totals
  v_total := v_price_per_day * v_days_count;
  
  -- Insert new holds for each date (idempotent)
  INSERT INTO public.stall_holds (
    user_id,
    stall_instance_id, 
    market_id,
    selected_dates,
    hold_date,
    expires_at
  )
  SELECT 
    v_current_user_id,
    p_stall_id,
    p_market_id,
    p_dates,
    d,
    now() + INTERVAL '5 minutes'
  FROM unnest(p_dates) AS d
  ON CONFLICT (stall_instance_id, hold_date) DO NOTHING;
  
  RETURN jsonb_build_object(
    'status', 'ok',
    'days', v_days_count,
    'price_per_day', v_price_per_day,
    'total', v_total,
    'message', 'Stall held successfully for ' || v_days_count || ' days'
  );
END;$function$
;

CREATE OR REPLACE FUNCTION public.simulate_payment_confirmed_admin(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
  raise exception using
      errcode = 'PT400',                    
      message = 'Booking not found',
      detail  = 'booking_not_found';
  END IF;

  IF v_booking.status != 'reserved' THEN
  raise exception using
      errcode = 'PT400',                    
      message = 'Booking must be reserved before payment',
      detail  = 'booking_reserved_before_payment';
  END IF;

  UPDATE bookings 
  SET 
    payment_status = 'success',
    paid_amount = total_amount,
    status = 'completed',
    updated_at = now()
  WHERE id = p_booking_id;

  UPDATE booking_dates
  SET status = 'booked'
  WHERE booking_id = p_booking_id;

  RETURN jsonb_build_object('status', 'success', 'message','Payment processed successfully');


END;$function$
;

CREATE OR REPLACE FUNCTION public.simulate_payment_failure(p_booking_id uuid)
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

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id AND user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found or unauthorized');
  END IF;

   IF v_booking.payment_status = 'failed' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Payment marked as failed and booking cancelled');
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
END;$function$
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

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id AND user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found or unauthorized');
  END IF;


  -- Check if booking is approved
  IF v_booking.payment_status = 'success' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Payment processed successfully');
  END IF;

  IF v_booking.status != 'pending' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking must be pending before payment');
  END IF;

  -- Update payment status, paid amount, AND booking status
  UPDATE bookings 
  SET 
    payment_status = 'success',
    paid_amount = total_amount,
    updated_at = now()
  WHERE id = p_booking_id;

  -- Update all booking_dates to 'booked' status
  UPDATE booking_dates
  SET status = 'booked'
  WHERE booking_id = p_booking_id;

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
    status = 'completed',
    updated_at = now()
  WHERE id = p_booking_id;

  UPDATE booking_dates
  SET status = 'booked'
  WHERE booking_id = p_booking_id;

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment processed successfully');
END;$function$
;


-- Create storage bucket for market images
INSERT INTO storage.buckets (id, name, public) VALUES ('market', 'market', true);

CREATE POLICY "Users with manage market permission can create" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'market' AND
        public.has_permission(auth.uid(), 'markets.manage')
    );

CREATE POLICY "Users with manage market permission can update" ON storage.objects
    FOR UPDATE WITH CHECK (
        bucket_id = 'market' AND
        public.has_permission(auth.uid(), 'markets.manage')
    );

CREATE POLICY "Users with manage market permission can delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'market' AND
        public.has_permission(auth.uid(), 'markets.manage')
    );

CREATE POLICY "All Users can view market images" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'market' AND (auth.role() = 'anon'::text)
    );


    alter type "public"."payment_status" rename to "payment_status__old_version_to_be_dropped";

create type "public"."payment_status" as enum ('pending', 'success', 'failed', 'cancelled', 'authorized', 'refunded');

alter table "public"."bookings" alter column payment_status type "public"."payment_status" using payment_status::text::"public"."payment_status";

drop type "public"."payment_status__old_version_to_be_dropped";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.simulate_payment_refund(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id uuid;
  v_deleted_count int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Authentication required');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Booking not found: %', p_booking_id;
    raise exception using
      errcode = 'PT400',                    
      message = 'Booking not found or unauthorized',
      detail  = 'no_booking_or_unauthorized';
  END IF;

  IF v_booking.payment_status <> 'success' THEN
    RAISE NOTICE 'Booking % has payment_status = %', v_booking.id, v_booking.payment_status;
    raise exception using
      errcode = 'PT400',                    
      message = 'No payment marked for this booking',
      detail  = 'no_payment';
  END IF;

  IF v_booking.payment_status = 'refunded' THEN
    RAISE NOTICE 'Booking % is already refunded', v_booking.id;
    RETURN jsonb_build_object('status', 'success', 'message', 'Payment already refunded');
  END IF;

  -- Cancel booking and payment
  UPDATE bookings 
  SET 
    payment_status = 'refunded',
    status = 'cancelled',
    paid_amount = 0,
    updated_at = now()
  WHERE id = p_booking_id;

  -- Release all booking_dates
  DELETE FROM booking_dates
  WHERE booking_id = v_booking.id;
  

  -- Release all holds
  DELETE FROM stall_holds 
  WHERE user_id = v_booking.user_id
    AND stall_instance_id IN (
      SELECT bs.stall_instance_id 
      FROM booking_stalls bs 
      WHERE bs.booking_id = p_booking_id
    );
 

  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Payment refunded with booking cancelled'
  );
END;$function$
;

create policy "Users with booking.manage can delete bookings date"
on "public"."booking_dates"
as permissive
for delete
to public
using ((EXISTS ( SELECT 1
   FROM bookings
  WHERE ((bookings.id = booking_dates.booking_id) AND has_permission(auth.uid(), 'bookings.manage'::text)))));



