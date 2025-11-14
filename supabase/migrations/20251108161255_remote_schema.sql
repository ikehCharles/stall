set check_function_bodies = off;

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
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION public.auto_generate_stall_label()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If label is not provided or is empty, generate one
  IF NEW.label IS NULL OR NEW.label = '' THEN
    NEW.label := generate_stall_label(NEW.market_id);
  -- If label is provided but already exists, generate a unique one
  ELSIF EXISTS (
    SELECT 1 FROM public.stall_instances 
    WHERE market_id = NEW.market_id 
    AND label = NEW.label 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
  ) THEN
    NEW.label := generate_stall_label(NEW.market_id);
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
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
$function$
;

CREATE OR REPLACE FUNCTION public.check_stall_date_availability(stall_id uuid, market_id uuid, dates date[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if stall exists and is available
  IF NOT EXISTS (
    SELECT 1 FROM public.stall_instances si
    WHERE si.id = stall_id 
    AND si.market_id = market_id 
    AND si.status = 'AVAILABLE'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Check if any of the requested dates are already reserved or booked
  IF EXISTS (
    SELECT 1 FROM public.booking_dates bd
    WHERE bd.stall_instance_id = stall_id
    AND bd.booking_date = ANY(dates)
    AND bd.status IN ('reserved', 'booked')
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Check if any dates are currently held by another user
  IF EXISTS (
    SELECT 1 FROM public.stall_holds sh
    WHERE sh.stall_instance_id = stall_id
    AND sh.market_id = market_id
    AND sh.selected_dates && dates
    AND sh.expires_at > now()
    AND sh.user_id != auth.uid()
  ) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_expired_holds()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.stall_holds
  WHERE expires_at <= now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_stall_hold(p_stall_id uuid, p_market_id uuid, p_dates date[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
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
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'At least 1 day must be selected'
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
END;
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  year_part TEXT;
  sequence_part TEXT;
BEGIN
  year_part := EXTRACT(YEAR FROM now())::TEXT;
  
  -- Get next sequence number for this year
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(invoice_number FROM 'INV-' || year_part || '-(.*)') AS INTEGER)), 
    0
  ) + 1 INTO sequence_part
  FROM public.bookings 
  WHERE invoice_number LIKE 'INV-' || year_part || '-%';
  
  RETURN 'INV-' || year_part || '-' || LPAD(sequence_part, 3, '0');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_stall_label(p_market_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_max_num INTEGER;
  v_new_label TEXT;
BEGIN
  -- Find the highest number from existing stall labels in this market
  -- Labels are expected to be in format ST-001, ST-002, etc.
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(label FROM 'ST-(\d+)') AS INTEGER
      )
    ),
    0
  ) INTO v_max_num
  FROM public.stall_instances
  WHERE market_id = p_market_id
  AND label ~ '^ST-\d+$';
  
  -- Generate new label with zero-padded number
  v_new_label := 'ST-' || LPAD((v_max_num + 1)::TEXT, 3, '0');
  
  -- Ensure uniqueness (in case of manual labels)
  WHILE EXISTS (
    SELECT 1 FROM public.stall_instances 
    WHERE market_id = p_market_id AND label = v_new_label
  ) LOOP
    v_max_num := v_max_num + 1;
    v_new_label := 'ST-' || LPAD((v_max_num + 1)::TEXT, 3, '0');
  END LOOP;
  
  RETURN v_new_label;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT role 
    FROM public.user_roles 
    WHERE user_id = user_uuid 
    LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Insert profile
    INSERT INTO public.profiles (id, email, full_name, phone_number)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone_number', '')
    );
    
    -- Insert default vendor role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'vendor');
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_stall_available(stall_id uuid, market_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if stall exists and is available
  IF NOT EXISTS (
    SELECT 1 FROM public.stall_instances si
    WHERE si.id = stall_id 
    AND si.market_id = market_id 
    AND si.status = 'AVAILABLE'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Check if stall is already booked (has any paid or pending bookings)
  IF EXISTS (
    SELECT 1 FROM public.booking_stalls bs
    JOIN public.bookings b ON bs.booking_id = b.id
    WHERE bs.stall_instance_id = stall_id
    AND b.status IN ('paid', 'pending', 'partial')
    AND b.market_id = market_id
  ) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.payments_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.simulate_payment_confirmed_admin(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found');
  END IF;

  IF v_booking.status != 'approved' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking must be approved before payment');
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
$function$
;

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
$function$
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

  IF v_booking.status != 'approved' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking must be approved before payment');
  END IF;

  UPDATE bookings 
  SET 
    payment_status = 'pending',
    paid_amount = total_amount,
    updated_at = now()
  WHERE id = p_booking_id;

  UPDATE booking_dates
  SET status = 'booked'
  WHERE booking_id = p_booking_id;

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment processing');
END;$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;



