-- =============================================================================
-- VAT System: Tables, Columns, RPC Functions, Permissions, and RLS Policies
-- =============================================================================

-- 1. Create vat_periods table
CREATE TABLE IF NOT EXISTS "public"."vat_periods" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" text NOT NULL,
    "start_date" date NOT NULL,
    "end_date" date,                    -- nullable: null = indefinite/open-ended
    "status" text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    "closed_at" timestamptz,
    "closed_by" uuid REFERENCES profiles(id),
    "total_vat_collected" numeric NOT NULL DEFAULT 0,
    "total_vat_outstanding" numeric NOT NULL DEFAULT 0,
    "total_vat_due" numeric NOT NULL DEFAULT 0,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- 2. Create vat_ledger table
CREATE TABLE IF NOT EXISTS "public"."vat_ledger" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "booking_id" uuid NOT NULL REFERENCES bookings(id),
    "vendor_id" uuid NOT NULL REFERENCES profiles(id),
    "invoice_number" text NOT NULL,
    "vat_amount" numeric NOT NULL,
    "net_amount" numeric NOT NULL,
    "gross_amount" numeric NOT NULL,
    "vat_rate" numeric NOT NULL,
    "vat_mode" text NOT NULL CHECK (vat_mode IN ('inclusive', 'exclusive')),
    "period_id" uuid REFERENCES vat_periods(id),
    "status" text NOT NULL DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'collected', 'settled', 'refunded')),
    "refund_of" uuid REFERENCES vat_ledger(id),
    "notes" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- 3. Add VAT columns to bookings table (all nullable for backward compatibility)
ALTER TABLE "public"."bookings"
    ADD COLUMN IF NOT EXISTS "vat_rate_at_booking" numeric,
    ADD COLUMN IF NOT EXISTS "vat_mode_at_booking" text,
    ADD COLUMN IF NOT EXISTS "vat_amount" numeric,
    ADD COLUMN IF NOT EXISTS "net_amount" numeric,
    ADD COLUMN IF NOT EXISTS "gross_amount" numeric;

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_vat_periods_status ON vat_periods(status);
CREATE INDEX IF NOT EXISTS idx_vat_periods_dates ON vat_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_vat_ledger_period ON vat_ledger(period_id);
CREATE INDEX IF NOT EXISTS idx_vat_ledger_booking ON vat_ledger(booking_id);
CREATE INDEX IF NOT EXISTS idx_vat_ledger_vendor ON vat_ledger(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vat_ledger_status ON vat_ledger(status);
CREATE INDEX IF NOT EXISTS idx_bookings_vat ON bookings(vat_amount) WHERE vat_amount IS NOT NULL;

-- 5. Enable RLS
ALTER TABLE "public"."vat_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."vat_ledger" ENABLE ROW LEVEL SECURITY;

-- 6. Grant permissions to authenticated and service_role
GRANT ALL ON TABLE "public"."vat_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."vat_periods" TO "service_role";
GRANT ALL ON TABLE "public"."vat_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."vat_ledger" TO "service_role";

-- 7. Create permissions
INSERT INTO public.permissions (key, name, description, category)
VALUES 
    ('vat.view', 'View VAT', 'View VAT periods, ledger, and reports', 'vat'),
    ('vat.manage', 'Manage VAT', 'Create/close VAT periods and reconcile', 'vat')
ON CONFLICT (key) DO NOTHING;

-- 8. Assign VAT permissions to admin role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'admin'
  AND p.key IN ('vat.view', 'vat.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 9. RLS policies for vat_periods
CREATE POLICY "Users with vat.view can read vat_periods"
    ON public.vat_periods FOR SELECT
    USING (has_permission(auth.uid(), 'vat.view'));

CREATE POLICY "Users with vat.manage can manage vat_periods"
    ON public.vat_periods FOR ALL
    USING (has_permission(auth.uid(), 'vat.manage'))
    WITH CHECK (has_permission(auth.uid(), 'vat.manage'));

-- 10. RLS policies for vat_ledger
CREATE POLICY "Users with vat.view can read vat_ledger"
    ON public.vat_ledger FOR SELECT
    USING (has_permission(auth.uid(), 'vat.view'));

CREATE POLICY "Users with vat.manage can manage vat_ledger"
    ON public.vat_ledger FOR ALL
    USING (has_permission(auth.uid(), 'vat.manage'))
    WITH CHECK (has_permission(auth.uid(), 'vat.manage'));

-- =============================================================================
-- RPC Functions
-- =============================================================================

-- 11. calculate_vat: Pure calculation function
CREATE OR REPLACE FUNCTION public.calculate_vat(
    p_base_price numeric,
    p_vat_rate numeric,
    p_vat_mode text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_net numeric;
    v_vat numeric;
    v_gross numeric;
BEGIN
    IF p_vat_mode = 'exclusive' THEN
        v_net := p_base_price;
        v_vat := ROUND(p_base_price * (p_vat_rate / 100.0), 2);
        v_gross := v_net + v_vat;
    ELSIF p_vat_mode = 'inclusive' THEN
        v_gross := p_base_price;
        v_vat := ROUND(p_base_price - (p_base_price / (1 + p_vat_rate / 100.0)), 2);
        v_net := v_gross - v_vat;
    ELSE
        RAISE EXCEPTION 'Invalid VAT mode: %. Must be inclusive or exclusive.', p_vat_mode;
    END IF;

    RETURN jsonb_build_object(
        'net_amount', v_net,
        'vat_amount', v_vat,
        'gross_amount', v_gross
    );
END;
$$;

-- 12. get_or_create_open_vat_period: Core period management
CREATE OR REPLACE FUNCTION public.get_or_create_open_vat_period()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_period record;
    v_new_start date;
    v_new_end date;
    v_new_name text;
    v_result jsonb;
BEGIN
    -- Step 1: Find any open period
    SELECT * INTO v_period
    FROM vat_periods
    WHERE status = 'open'
    ORDER BY start_date DESC
    LIMIT 1;

    IF v_period IS NOT NULL THEN
        -- Step 2a: end_date is null (indefinite) → use it
        IF v_period.end_date IS NULL THEN
            RETURN jsonb_build_object(
                'id', v_period.id,
                'name', v_period.name,
                'start_date', v_period.start_date,
                'end_date', v_period.end_date,
                'status', v_period.status
            );
        END IF;

        -- Step 2b: Within date range → use it
        IF CURRENT_DATE <= v_period.end_date THEN
            RETURN jsonb_build_object(
                'id', v_period.id,
                'name', v_period.name,
                'start_date', v_period.start_date,
                'end_date', v_period.end_date,
                'status', v_period.status
            );
        END IF;

        -- Step 2c: Past end_date → auto-close and create new monthly period
        UPDATE vat_periods
        SET status = 'closed',
            closed_at = now(),
            updated_at = now()
        WHERE id = v_period.id;

        v_new_start := v_period.end_date + 1;
        v_new_end := (date_trunc('month', v_new_start) + interval '1 month' - interval '1 day')::date;
        v_new_name := to_char(v_new_start, 'Month YYYY');

        INSERT INTO vat_periods (name, start_date, end_date)
        VALUES (trim(v_new_name), v_new_start, v_new_end)
        RETURNING * INTO v_period;

        RETURN jsonb_build_object(
            'id', v_period.id,
            'name', v_period.name,
            'start_date', v_period.start_date,
            'end_date', v_period.end_date,
            'status', v_period.status
        );
    END IF;

    -- Step 3: No open period → auto-create monthly
    v_new_start := date_trunc('month', CURRENT_DATE)::date;
    v_new_end := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
    v_new_name := to_char(CURRENT_DATE, 'Month YYYY');

    INSERT INTO vat_periods (name, start_date, end_date)
    VALUES (trim(v_new_name), v_new_start, v_new_end)
    RETURNING * INTO v_period;

    RETURN jsonb_build_object(
        'id', v_period.id,
        'name', v_period.name,
        'start_date', v_period.start_date,
        'end_date', v_period.end_date,
        'status', v_period.status
    );
END;
$$;

-- 13. create_vat_ledger_entry: Called when a booking is created
CREATE OR REPLACE FUNCTION public.create_vat_ledger_entry(
    p_booking_id uuid,
    p_vendor_id uuid,
    p_invoice_number text,
    p_total_amount numeric,
    p_vat_rate numeric,
    p_vat_mode text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_vat_calc jsonb;
    v_period_id uuid;
    v_ledger_id uuid;
BEGIN
    -- Calculate VAT
    v_vat_calc := calculate_vat(p_total_amount, p_vat_rate, p_vat_mode);

    -- Find the best matching open period: date range contains today, prefer latest start_date
    SELECT id INTO v_period_id
    FROM vat_periods
    WHERE status = 'open'
      AND start_date <= CURRENT_DATE
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    ORDER BY start_date DESC
    LIMIT 1;

    -- If no match, auto-create a monthly period
    IF v_period_id IS NULL THEN
        INSERT INTO vat_periods (name, start_date, end_date)
        VALUES (
            trim(to_char(CURRENT_DATE, 'Month YYYY')),
            date_trunc('month', CURRENT_DATE)::date,
            (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date
        )
        RETURNING id INTO v_period_id;
    END IF;

    -- Update booking with VAT info
    UPDATE bookings
    SET vat_rate_at_booking = p_vat_rate,
        vat_mode_at_booking = p_vat_mode,
        vat_amount = (v_vat_calc->>'vat_amount')::numeric,
        net_amount = (v_vat_calc->>'net_amount')::numeric,
        gross_amount = (v_vat_calc->>'gross_amount')::numeric,
        updated_at = now()
    WHERE id = p_booking_id;

    -- Insert ledger entry
    INSERT INTO vat_ledger (
        booking_id, vendor_id, invoice_number,
        vat_amount, net_amount, gross_amount,
        vat_rate, vat_mode, period_id, status
    ) VALUES (
        p_booking_id, p_vendor_id, p_invoice_number,
        (v_vat_calc->>'vat_amount')::numeric,
        (v_vat_calc->>'net_amount')::numeric,
        (v_vat_calc->>'gross_amount')::numeric,
        p_vat_rate, p_vat_mode, v_period_id, 'outstanding'
    )
    RETURNING id INTO v_ledger_id;

    -- Update period totals
    UPDATE vat_periods
    SET total_vat_outstanding = total_vat_outstanding + (v_vat_calc->>'vat_amount')::numeric,
        total_vat_due = total_vat_due + (v_vat_calc->>'vat_amount')::numeric,
        updated_at = now()
    WHERE id = v_period_id;

    RETURN jsonb_build_object(
        'ledger_id', v_ledger_id,
        'vat_amount', (v_vat_calc->>'vat_amount')::numeric,
        'net_amount', (v_vat_calc->>'net_amount')::numeric,
        'gross_amount', (v_vat_calc->>'gross_amount')::numeric,
        'period_id', v_period_id
    );
END;
$$;

-- 14. mark_vat_collected: Called when payment succeeds
CREATE OR REPLACE FUNCTION public.mark_vat_collected(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ledger record;
BEGIN
    -- Find the outstanding ledger entry for this booking
    SELECT * INTO v_ledger
    FROM vat_ledger
    WHERE booking_id = p_booking_id
      AND status = 'outstanding'
      AND refund_of IS NULL
    LIMIT 1;

    IF v_ledger IS NULL THEN
        RETURN jsonb_build_object('status', 'no_entry', 'message', 'No outstanding VAT ledger entry found');
    END IF;

    -- Update ledger status
    UPDATE vat_ledger
    SET status = 'collected', updated_at = now()
    WHERE id = v_ledger.id;

    -- Update period totals
    UPDATE vat_periods
    SET total_vat_collected = total_vat_collected + v_ledger.vat_amount,
        total_vat_outstanding = total_vat_outstanding - v_ledger.vat_amount,
        updated_at = now()
    WHERE id = v_ledger.period_id;

    RETURN jsonb_build_object('status', 'collected', 'ledger_id', v_ledger.id);
END;
$$;

-- 15. create_vat_refund_entry: Called on refund - automatically reverses VAT
CREATE OR REPLACE FUNCTION public.create_vat_refund_entry(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_original record;
    v_refund_id uuid;
BEGIN
    -- Find the original collected ledger entry
    SELECT * INTO v_original
    FROM vat_ledger
    WHERE booking_id = p_booking_id
      AND status = 'collected'
      AND refund_of IS NULL
    LIMIT 1;

    IF v_original IS NULL THEN
        RETURN jsonb_build_object('status', 'no_entry', 'message', 'No collected VAT entry found to refund');
    END IF;

    -- Create refund ledger entry in the same period as the original
    INSERT INTO vat_ledger (
        booking_id, vendor_id, invoice_number,
        vat_amount, net_amount, gross_amount,
        vat_rate, vat_mode, period_id, status,
        refund_of, notes
    ) VALUES (
        v_original.booking_id, v_original.vendor_id, v_original.invoice_number,
        -v_original.vat_amount, -v_original.net_amount, -v_original.gross_amount,
        v_original.vat_rate, v_original.vat_mode, v_original.period_id, 'refunded',
        v_original.id, 'Automatic VAT reversal on refund'
    )
    RETURNING id INTO v_refund_id;

    -- Update the original period's totals
    UPDATE vat_periods
    SET total_vat_collected = total_vat_collected - v_original.vat_amount,
        total_vat_due = total_vat_due - v_original.vat_amount,
        updated_at = now()
    WHERE id = v_original.period_id;

    RETURN jsonb_build_object(
        'status', 'refunded',
        'refund_ledger_id', v_refund_id,
        'original_ledger_id', v_original.id
    );
END;
$$;

-- 16. reconcile_vat_period: Close a VAT period
CREATE OR REPLACE FUNCTION public.reconcile_vat_period(
    p_period_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_period record;
    v_settled_count integer;
BEGIN
    -- Find the period
    SELECT * INTO v_period
    FROM vat_periods
    WHERE id = p_period_id;

    IF v_period IS NULL THEN
        RAISE EXCEPTION 'VAT period not found: %', p_period_id;
    END IF;

    IF v_period.status = 'closed' THEN
        RAISE EXCEPTION 'VAT period is already closed';
    END IF;

    -- Mark all collected, outstanding, and refunded entries as settled
    UPDATE vat_ledger
    SET status = 'settled', updated_at = now()
    WHERE period_id = p_period_id
      AND status IN ('collected', 'outstanding', 'refunded');

    GET DIAGNOSTICS v_settled_count = ROW_COUNT;

    -- Close the period
    UPDATE vat_periods
    SET status = 'closed',
        closed_at = now(),
        closed_by = auth.uid(),
        updated_at = now()
    WHERE id = p_period_id;

    RETURN jsonb_build_object(
        'status', 'closed',
        'period_id', p_period_id,
        'entries_settled', v_settled_count
    );
END;
$$;

-- 18. Override simulate_payment_success_admin to also mark VAT collected
CREATE OR REPLACE FUNCTION public.simulate_payment_success_admin(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found');
  END IF;

  IF v_booking.payment_status = 'success' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Payment processed successfully');
  END IF;

  UPDATE bookings
  SET
    payment_status = 'success',
    paid_amount = COALESCE(gross_amount, total_amount),
    status = 'completed',
    updated_at = now()
  WHERE id = p_booking_id;

  UPDATE booking_dates
  SET status = 'booked'
  WHERE booking_id = p_booking_id;

  -- Mark VAT as collected
  PERFORM mark_vat_collected(p_booking_id);

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment processed successfully');
END;
$$;

-- 19. Override simulate_payment_success to also mark VAT collected
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

  IF v_booking.payment_status = 'success' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Payment processed successfully');
  END IF;

  IF v_booking.status NOT IN ('pending', 'reserved') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking must be pending or reserved before payment');
  END IF;

  UPDATE bookings
  SET
    payment_status = 'success',
    paid_amount = COALESCE(gross_amount, total_amount),
    updated_at = now()
  WHERE id = p_booking_id;

  UPDATE booking_dates
  SET status = 'booked'
  WHERE booking_id = p_booking_id;

  -- Mark VAT as collected
  PERFORM mark_vat_collected(p_booking_id);

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment processed successfully');
END;
$$;

-- 20. Override simulate_payment_refund_admin to also create VAT refund entry
CREATE OR REPLACE FUNCTION public.simulate_payment_refund_admin(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      errcode = 'PT400',
      message = 'Booking not found',
      detail  = 'booking_not_found';
  END IF;

  IF v_booking.payment_status <> 'success' THEN
    RAISE EXCEPTION USING
      errcode = 'PT400',
      message = 'No successful payment to refund',
      detail  = 'no_payment';
  END IF;

  IF v_booking.payment_status = 'refunded' THEN
    RETURN jsonb_build_object('status', 'success', 'message', 'Payment already refunded');
  END IF;

  UPDATE bookings
  SET
    payment_status = 'refunded',
    status = 'cancelled',
    paid_amount = 0,
    updated_at = now()
  WHERE id = p_booking_id;

  DELETE FROM booking_dates WHERE booking_id = p_booking_id;

  DELETE FROM stall_holds
  WHERE user_id = v_booking.user_id
    AND stall_instance_id IN (
      SELECT bs.stall_instance_id
      FROM booking_stalls bs
      WHERE bs.booking_id = p_booking_id
    );

  -- Create automatic VAT refund entry
  PERFORM create_vat_refund_entry(p_booking_id);

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment refunded with booking cancelled');
END;
$$;

-- 20. Override simulate_payment_refund to also create VAT refund entry
CREATE OR REPLACE FUNCTION public.simulate_payment_refund(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Authentication required');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      errcode = 'PT400',
      message = 'Booking not found or unauthorized',
      detail  = 'no_booking_or_unauthorized';
  END IF;

  IF v_booking.payment_status <> 'success' THEN
    RAISE EXCEPTION USING
      errcode = 'PT400',
      message = 'No payment marked for this booking',
      detail  = 'no_payment';
  END IF;

  IF v_booking.payment_status = 'refunded' THEN
    RETURN jsonb_build_object('status', 'success', 'message', 'Payment already refunded');
  END IF;

  UPDATE bookings
  SET
    payment_status = 'refunded',
    status = 'cancelled',
    paid_amount = 0,
    updated_at = now()
  WHERE id = p_booking_id;

  DELETE FROM booking_dates WHERE booking_id = v_booking.id;

  DELETE FROM stall_holds
  WHERE user_id = v_booking.user_id
    AND stall_instance_id IN (
      SELECT bs.stall_instance_id
      FROM booking_stalls bs
      WHERE bs.booking_id = p_booking_id
    );

  -- Create automatic VAT refund entry
  PERFORM create_vat_refund_entry(p_booking_id);

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment refunded with booking cancelled');
END;
$$;

-- 21. Override simulate_booking_confirm_admin to also mark VAT collected
CREATE OR REPLACE FUNCTION public.simulate_booking_confirm_admin(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      errcode = 'PT400',
      message = 'Booking not found',
      detail  = 'booking_not_found';
  END IF;

  IF v_booking.status != 'reserved' THEN
    RAISE EXCEPTION USING
      errcode = 'PT400',
      message = 'Booking must be reserved before payment',
      detail  = 'booking_reserved_before_payment';
  END IF;

  UPDATE bookings
  SET
    payment_status = 'success',
    paid_amount = COALESCE(gross_amount, total_amount),
    status = 'completed',
    updated_at = now()
  WHERE id = p_booking_id;

  UPDATE booking_dates
  SET status = 'booked'
  WHERE booking_id = p_booking_id;

  -- Mark VAT as collected
  PERFORM mark_vat_collected(p_booking_id);

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment processed successfully');
END;
$$;

-- 23. create_vat_period: Admin manually creates a period
CREATE OR REPLACE FUNCTION public.create_vat_period(
    p_name text,
    p_start_date date,
    p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_period record;
BEGIN
    INSERT INTO vat_periods (name, start_date, end_date, status)
    VALUES (p_name, p_start_date, p_end_date, 'open')
    RETURNING * INTO v_new_period;

    RETURN jsonb_build_object(
        'id', v_new_period.id,
        'name', v_new_period.name,
        'start_date', v_new_period.start_date,
        'end_date', v_new_period.end_date,
        'status', v_new_period.status
    );
END;
$$;

-- 24. update_vat_period: Admin edits a non-closed period (name, end_date only)
CREATE OR REPLACE FUNCTION public.update_vat_period(
    p_period_id uuid,
    p_name text,
    p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_period record;
BEGIN
    SELECT * INTO v_period FROM vat_periods WHERE id = p_period_id;

    IF v_period IS NULL THEN
        RAISE EXCEPTION 'VAT period not found: %', p_period_id;
    END IF;

    IF v_period.status = 'closed' THEN
        RAISE EXCEPTION 'Cannot edit a closed VAT period';
    END IF;

    UPDATE vat_periods
    SET name = p_name,
        end_date = p_end_date,
        updated_at = now()
    WHERE id = p_period_id
    RETURNING * INTO v_period;

    RETURN jsonb_build_object(
        'id', v_period.id,
        'name', v_period.name,
        'start_date', v_period.start_date,
        'end_date', v_period.end_date,
        'status', v_period.status
    );
END;
$$;

-- 25. delete_vat_period: Admin deletes a period only if it has no ledger entries
CREATE OR REPLACE FUNCTION public.delete_vat_period(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_period record;
    v_ledger_count integer;
BEGIN
    SELECT * INTO v_period FROM vat_periods WHERE id = p_period_id;

    IF v_period IS NULL THEN
        RAISE EXCEPTION 'VAT period not found: %', p_period_id;
    END IF;

    IF v_period.status = 'closed' THEN
        RAISE EXCEPTION 'Cannot delete a closed VAT period';
    END IF;

    SELECT COUNT(*) INTO v_ledger_count
    FROM vat_ledger
    WHERE period_id = p_period_id;

    IF v_ledger_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete: period has % ledger entries', v_ledger_count;
    END IF;

    DELETE FROM vat_periods WHERE id = p_period_id;

    RETURN jsonb_build_object('status', 'deleted', 'period_id', p_period_id);
END;
$$;
