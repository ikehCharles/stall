-- Phase 2: Update RLS Policies to Permission-Based Checks

-- ============================================================================
-- 1. Markets Table
-- ============================================================================

-- Drop old role-based policies
DROP POLICY IF EXISTS "Admins can view all markets" ON public.markets;
DROP POLICY IF EXISTS "Admins can create markets" ON public.markets;
DROP POLICY IF EXISTS "Admins can update markets" ON public.markets;
DROP POLICY IF EXISTS "Admins can delete markets" ON public.markets;
DROP POLICY IF EXISTS "Vendors can view published markets" ON public.markets;

-- Create new permission-based policies
CREATE POLICY "Users with markets.manage can manage all markets"
  ON public.markets FOR ALL
  USING (has_permission(auth.uid(), 'markets.manage'));

CREATE POLICY "Users with markets.view can see published markets"
  ON public.markets FOR SELECT
  USING (
    status = 'PUBLISHED' 
    AND has_permission(auth.uid(), 'markets.view')
  );

-- ============================================================================
-- 2. Stall Templates Table
-- ============================================================================

-- Drop old role-based policies
DROP POLICY IF EXISTS "Admins can view all templates" ON public.stall_templates;
DROP POLICY IF EXISTS "Admins can create templates" ON public.stall_templates;
DROP POLICY IF EXISTS "Admins can update templates" ON public.stall_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON public.stall_templates;
DROP POLICY IF EXISTS "Vendors can view templates for published markets" ON public.stall_templates;

-- Create new permission-based policies
CREATE POLICY "Users with stalls.manage can manage templates"
  ON public.stall_templates FOR ALL
  USING (has_permission(auth.uid(), 'stalls.manage'));

CREATE POLICY "Users with stalls.view can see templates"
  ON public.stall_templates FOR SELECT
  USING (has_permission(auth.uid(), 'stalls.view'));

-- ============================================================================
-- 3. Stall Instances Table
-- ============================================================================

-- Drop old role-based policies
DROP POLICY IF EXISTS "Admins can view all stall instances" ON public.stall_instances;
DROP POLICY IF EXISTS "Admins can create stall instances" ON public.stall_instances;
DROP POLICY IF EXISTS "Admins can update stall instances" ON public.stall_instances;
DROP POLICY IF EXISTS "Admins can delete stall instances" ON public.stall_instances;
DROP POLICY IF EXISTS "Vendors can view stall instances in published markets" ON public.stall_instances;

-- Create new permission-based policies
CREATE POLICY "Users with stalls.manage can manage instances"
  ON public.stall_instances FOR ALL
  USING (has_permission(auth.uid(), 'stalls.manage'));

CREATE POLICY "Users with stalls.view can see instances in published markets"
  ON public.stall_instances FOR SELECT
  USING (
    has_permission(auth.uid(), 'stalls.view')
    AND EXISTS (
      SELECT 1 FROM public.markets 
      WHERE markets.id = stall_instances.market_id 
      AND markets.status = 'PUBLISHED'
    )
  );

-- ============================================================================
-- 4. Bookings Table
-- ============================================================================

-- Drop old role-based policies
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can create bookings for any user" ON public.bookings;
DROP POLICY IF EXISTS "Admins can update all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON public.bookings;

-- Create new permission-based policies
CREATE POLICY "Users can view own bookings"
  ON public.bookings FOR SELECT
  USING (
    user_id = auth.uid() 
    AND has_permission(auth.uid(), 'bookings.view.self')
  );

CREATE POLICY "Users with bookings.view.all can see all bookings"
  ON public.bookings FOR SELECT
  USING (has_permission(auth.uid(), 'bookings.view.all'));

CREATE POLICY "Users can create own bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    AND has_permission(auth.uid(), 'bookings.create.self')
  );

CREATE POLICY "Users with bookings.create.any can create any booking"
  ON public.bookings FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'bookings.create.any'));

CREATE POLICY "Users can update own bookings"
  ON public.bookings FOR UPDATE
  USING (
    user_id = auth.uid() 
    AND has_permission(auth.uid(), 'bookings.cancel.self')
  );

CREATE POLICY "Users with bookings.manage can manage all bookings"
  ON public.bookings FOR UPDATE
  USING (has_permission(auth.uid(), 'bookings.manage'));

-- ============================================================================
-- 5. Booking Stalls Table
-- ============================================================================

-- Drop old role-based policies
DROP POLICY IF EXISTS "Admins can view all booking stalls" ON public.booking_stalls;
DROP POLICY IF EXISTS "Admins can create booking stalls for any booking" ON public.booking_stalls;
DROP POLICY IF EXISTS "Admins can manage all booking stalls" ON public.booking_stalls;
DROP POLICY IF EXISTS "Users can view stalls from their own bookings" ON public.booking_stalls;
DROP POLICY IF EXISTS "Users can create stalls for their own bookings" ON public.booking_stalls;

-- Create new permission-based policies
CREATE POLICY "Users can view stalls from own bookings"
  ON public.booking_stalls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = booking_stalls.booking_id 
      AND bookings.user_id = auth.uid()
    )
    AND has_permission(auth.uid(), 'bookings.view.self')
  );

CREATE POLICY "Users with bookings.view.all can see all booking stalls"
  ON public.booking_stalls FOR SELECT
  USING (has_permission(auth.uid(), 'bookings.view.all'));

CREATE POLICY "Users can create stalls for own bookings"
  ON public.booking_stalls FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = booking_stalls.booking_id 
      AND bookings.user_id = auth.uid()
    )
    AND has_permission(auth.uid(), 'bookings.create.self')
  );

CREATE POLICY "Users with bookings.create.any can create any booking stalls"
  ON public.booking_stalls FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'bookings.create.any'));

-- ============================================================================
-- 6. Booking Dates Table
-- ============================================================================

-- Drop old role-based policies
DROP POLICY IF EXISTS "Admins can view all booking dates" ON public.booking_dates;
DROP POLICY IF EXISTS "Admins can create booking dates for any booking" ON public.booking_dates;
DROP POLICY IF EXISTS "Users can view booking dates for their own bookings" ON public.booking_dates;
DROP POLICY IF EXISTS "Users can create booking dates for their own bookings" ON public.booking_dates;

-- Create new permission-based policies
CREATE POLICY "Users can view dates for own bookings"
  ON public.booking_dates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = booking_dates.booking_id 
      AND bookings.user_id = auth.uid()
    )
    AND has_permission(auth.uid(), 'bookings.view.self')
  );

CREATE POLICY "Users with bookings.view.all can see all booking dates"
  ON public.booking_dates FOR SELECT
  USING (has_permission(auth.uid(), 'bookings.view.all'));

CREATE POLICY "Users can create dates for own bookings"
  ON public.booking_dates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = booking_dates.booking_id 
      AND bookings.user_id = auth.uid()
    )
    AND has_permission(auth.uid(), 'bookings.create.self')
  );

CREATE POLICY "Users with bookings.create.any can create any booking dates"
  ON public.booking_dates FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'bookings.create.any'));

-- ============================================================================
-- 7. KYC Applications Table
-- ============================================================================

-- Drop old role-based policies
DROP POLICY IF EXISTS "Users can view own KYC" ON public.kyc_applications;
DROP POLICY IF EXISTS "Admins can view all KYC" ON public.kyc_applications;
DROP POLICY IF EXISTS "Users can insert own KYC" ON public.kyc_applications;
DROP POLICY IF EXISTS "Users can update own KYC" ON public.kyc_applications;
DROP POLICY IF EXISTS "Admins can update all KYC" ON public.kyc_applications;

-- Create new permission-based policies
CREATE POLICY "Users can view own KYC"
  ON public.kyc_applications FOR SELECT
  USING (
    user_id = auth.uid() 
    AND has_permission(auth.uid(), 'kyc.view.self')
  );

CREATE POLICY "Users with kyc.view.all can see all KYC"
  ON public.kyc_applications FOR SELECT
  USING (has_permission(auth.uid(), 'kyc.view.all'));

CREATE POLICY "Users can submit own KYC"
  ON public.kyc_applications FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    AND has_permission(auth.uid(), 'kyc.create.self')
  );

CREATE POLICY "Users with kyc.create.pending can create KYC for others"
  ON public.kyc_applications FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'kyc.create.pending'));

CREATE POLICY "Users can update own pending KYC"
  ON public.kyc_applications FOR UPDATE
  USING (
    user_id = auth.uid() 
    AND status = 'PENDING'
    AND has_permission(auth.uid(), 'kyc.create.self')
  );

CREATE POLICY "Users with kyc.review can update any KYC"
  ON public.kyc_applications FOR UPDATE
  USING (has_permission(auth.uid(), 'kyc.review'));

-- ============================================================================
-- 8. KYC Audit Log Table
-- ============================================================================

-- Drop old role-based policies
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.kyc_audit_log;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.kyc_audit_log;

-- Create new permission-based policies
CREATE POLICY "Users with kyc.view.all can see audit logs"
  ON public.kyc_audit_log FOR SELECT
  USING (has_permission(auth.uid(), 'kyc.view.all'));

CREATE POLICY "Users with kyc.review can create audit logs"
  ON public.kyc_audit_log FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'kyc.review'));

-- ============================================================================
-- 9. Stall Holds Table
-- ============================================================================

-- Drop old role-based policies
DROP POLICY IF EXISTS "Admins can view all holds" ON public.stall_holds;
DROP POLICY IF EXISTS "Users can manage their own holds" ON public.stall_holds;

-- Create new permission-based policies
CREATE POLICY "Users can manage own holds"
  ON public.stall_holds FOR ALL
  USING (
    user_id = auth.uid()
    AND has_any_permission(auth.uid(), ARRAY['stalls.book.self', 'stalls.book.any'])
  );

CREATE POLICY "Users with stalls.view can see all holds"
  ON public.stall_holds FOR SELECT
  USING (
    has_permission(auth.uid(), 'stalls.manage')
    OR has_permission(auth.uid(), 'bookings.view.all')
  );

-- ============================================================================
-- 10. Profiles Table
-- ============================================================================

-- Add policy for viewing all profiles (existing self-view policies stay)
CREATE POLICY "Users with vendors.view.all can see all profiles"
  ON public.profiles FOR SELECT
  USING (has_permission(auth.uid(), 'vendors.view.all'));

-- ============================================================================
-- 11. Market Layouts Table
-- ============================================================================

-- Drop old role-based policies
DROP POLICY IF EXISTS "Admins can view all layouts" ON public.market_layouts;
DROP POLICY IF EXISTS "Admins can manage layouts" ON public.market_layouts;
DROP POLICY IF EXISTS "Admins can update layouts" ON public.market_layouts;

-- Create new permission-based policies
CREATE POLICY "Users with markets.manage can manage layouts"
  ON public.market_layouts FOR ALL
  USING (has_permission(auth.uid(), 'markets.manage'));

CREATE POLICY "Users with markets.view can see layouts"
  ON public.market_layouts FOR SELECT
  USING (
    has_permission(auth.uid(), 'markets.view')
    AND EXISTS (
      SELECT 1 FROM public.markets
      WHERE markets.id = market_layouts.market_id
      AND markets.status = 'PUBLISHED'
    )
  );

-- ============================================================================
-- 12. Update Database Functions
-- ============================================================================

-- Update admin_approve_booking to use permissions
CREATE OR REPLACE FUNCTION public.admin_approve_booking(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Check permission instead of role
  IF v_user_id IS NULL OR NOT has_permission(v_user_id, 'bookings.manage') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Permission denied: bookings.manage required');
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found');
  END IF;

  -- Check if already paid
  IF v_booking.payment_status = 'success' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Payment already processed - booking is already completed');
  END IF;

  -- Simply approve the booking
  UPDATE public.bookings 
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

-- Update admin_decline_booking to use permissions
CREATE OR REPLACE FUNCTION public.admin_decline_booking(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Check permission instead of role
  IF v_user_id IS NULL OR NOT has_permission(v_user_id, 'bookings.manage') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Permission denied: bookings.manage required');
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found');
  END IF;

  -- Cancel booking and payment
  UPDATE public.bookings 
  SET 
    status = 'cancelled',
    payment_status = 'cancelled',
    updated_at = now()
  WHERE id = p_booking_id;

  -- Release all booking_dates
  DELETE FROM public.booking_dates
  WHERE booking_id = p_booking_id;

  -- Release all holds
  DELETE FROM public.stall_holds 
  WHERE stall_instance_id IN (
    SELECT bs.stall_instance_id 
    FROM public.booking_stalls bs 
    WHERE bs.booking_id = p_booking_id
  );

  RETURN jsonb_build_object('status', 'success', 'message', 'Booking declined and dates released');
END;
$$;

-- Update lookup_vendor_by_email to check permissions
CREATE OR REPLACE FUNCTION public.lookup_vendor_by_email(p_email TEXT)
RETURNS TABLE(user_id UUID, email TEXT, full_name TEXT, phone_number TEXT, company_name TEXT, kyc_status TEXT, kyc_id UUID, has_unpaid_bookings BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check permission
  IF NOT has_permission(auth.uid(), 'vendors.lookup') THEN
    RAISE EXCEPTION 'Permission denied: vendors.lookup required';
  END IF;

  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    p.phone_number,
    p.company_name,
    COALESCE(k.status::TEXT, 'NONE') as kyc_status,
    k.id as kyc_id,
    EXISTS(
      SELECT 1 FROM public.bookings b 
      WHERE b.user_id = p.id 
      AND b.payment_status != 'success'
      AND b.status NOT IN ('cancelled', 'expired')
    ) as has_unpaid_bookings
  FROM public.profiles p
  LEFT JOIN public.kyc_applications k ON k.user_id = p.id
  WHERE LOWER(p.email) = LOWER(p_email)
  ORDER BY k.created_at DESC
  LIMIT 1;
END;
$$;

-- Update create_stall_hold to check permissions
CREATE OR REPLACE FUNCTION public.create_stall_hold(p_stall_id UUID, p_market_id UUID, p_dates DATE[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price_per_day NUMERIC;
  v_conflict_count INT;
  v_current_user_id UUID;
  v_days_count INT;
  v_total NUMERIC;
BEGIN
  v_current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Authentication required to reserve a stall'
    );
  END IF;
  
  -- Check if user has booking permission
  IF NOT has_any_permission(v_current_user_id, ARRAY['stalls.book.self', 'stalls.book.any']) THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Permission denied: stalls.book permission required'
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
$$;

-- Update simulate_payment_success to check permissions
CREATE OR REPLACE FUNCTION public.simulate_payment_success(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Authentication required');
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found');
  END IF;
  
  -- Check if user owns booking OR has payment management permission
  IF v_booking.user_id != v_user_id AND NOT has_permission(v_user_id, 'payments.manage') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Permission denied');
  END IF;

  -- Check if booking is approved
  IF v_booking.status != 'approved' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking must be approved before payment');
  END IF;

  -- Update payment status, paid amount, AND booking status
  UPDATE public.bookings 
  SET 
    payment_status = 'success',
    paid_amount = total_amount,
    status = 'completed',
    updated_at = now()
  WHERE id = p_booking_id;

  -- Update all booking_dates to 'booked' status
  UPDATE public.booking_dates
  SET status = 'booked'
  WHERE booking_id = p_booking_id;

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment processed successfully');
END;
$$;

-- Update simulate_payment_failure to check permissions
CREATE OR REPLACE FUNCTION public.simulate_payment_failure(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Authentication required');
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found');
  END IF;
  
  -- Check if user owns booking OR has payment management permission
  IF v_booking.user_id != v_user_id AND NOT has_permission(v_user_id, 'payments.manage') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Permission denied');
  END IF;

  -- Cancel booking and payment
  UPDATE public.bookings 
  SET 
    payment_status = 'failed',
    status = 'cancelled',
    updated_at = now()
  WHERE id = p_booking_id;

  -- Release all booking_dates
  DELETE FROM public.booking_dates
  WHERE booking_id = p_booking_id;

  -- Release all holds
  DELETE FROM public.stall_holds 
  WHERE user_id = v_user_id 
  AND stall_instance_id IN (
    SELECT bs.stall_instance_id 
    FROM public.booking_stalls bs 
    WHERE bs.booking_id = p_booking_id
  );

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment marked as failed and booking cancelled');
END;
$$;