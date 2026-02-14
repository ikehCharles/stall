-- Cash payments table for FCA cash collection and reconciliation
CREATE TABLE IF NOT EXISTS public.cash_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    denominations JSONB DEFAULT NULL, -- optional breakdown e.g. {"50":1,"20":2,"10":0,"5":1,"2":0,"1":3,"0.5":0,"0.2":0,"0.1":0,"0.05":0,"0.02":0,"0.01":0}
    collected_by UUID NOT NULL REFERENCES auth.users(id),
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for fast lookups by booking
CREATE INDEX IF NOT EXISTS idx_cash_payments_booking_id ON public.cash_payments(booking_id);
-- Index for reconciliation queries by collector
CREATE INDEX IF NOT EXISTS idx_cash_payments_collected_by ON public.cash_payments(collected_by);
-- Index for date-range reconciliation reports
CREATE INDEX IF NOT EXISTS idx_cash_payments_created_at ON public.cash_payments(created_at);

-- RLS policies
ALTER TABLE public.cash_payments ENABLE ROW LEVEL SECURITY;

-- Admin / FCA users can insert cash payments
CREATE POLICY "FCA users can insert cash payments"
    ON public.cash_payments FOR INSERT
    WITH CHECK (true);

-- Admin / FCA users can read cash payments
CREATE POLICY "Authenticated users can read cash payments"
    ON public.cash_payments FOR SELECT
    USING (true);

-- Function: record a cash payment and mark the booking as paid when fully settled
CREATE OR REPLACE FUNCTION public.record_cash_payment(
    p_booking_id UUID,
    p_amount NUMERIC,
    p_collected_by UUID,
    p_denominations JSONB DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cash_payment_id UUID;
    v_booking RECORD;
    v_gross NUMERIC;
    v_new_paid NUMERIC;
    v_fully_paid BOOLEAN;
BEGIN
    -- Fetch the booking
    SELECT id, total_amount, gross_amount, paid_amount, payment_status, status
    INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found: %', p_booking_id;
    END IF;

    -- Prevent duplicate payment on already-paid bookings
    IF v_booking.payment_status = 'success' THEN
        RAISE EXCEPTION 'Booking is already fully paid';
    END IF;

    -- The payable amount is gross_amount (includes VAT); fall back to total_amount
    v_gross := COALESCE(v_booking.gross_amount, v_booking.total_amount);

    -- Accumulate: new paid = existing paid + this cash payment
    v_new_paid := COALESCE(v_booking.paid_amount, 0) + p_amount;

    -- Determine if booking is now fully paid
    v_fully_paid := v_new_paid >= v_gross;

    -- Insert cash payment record
    INSERT INTO public.cash_payments (booking_id, amount, collected_by, denominations, notes)
    VALUES (p_booking_id, p_amount, p_collected_by, p_denominations, p_notes)
    RETURNING id INTO v_cash_payment_id;

    -- Update the booking with accumulated paid_amount
    UPDATE public.bookings
    SET paid_amount = v_new_paid,
        payment_status = (CASE WHEN v_fully_paid THEN 'success' ELSE 'pending' END)::payment_status,
        status = (CASE
            WHEN v_fully_paid AND status = 'approved' THEN 'completed'
            ELSE status::text
        END)::booking_status,
        fca_notes = COALESCE(p_notes, 'FCA cash payment collected'),
        updated_at = now()
    WHERE id = p_booking_id;

    -- Also record in the payments table for unified reporting
    INSERT INTO public.payments (booking_id, amount, provider, provider_payment_id, status, currency, invoice_number, metadata)
    SELECT p_booking_id, p_amount, 'cash', v_cash_payment_id::TEXT,
           CASE WHEN v_fully_paid THEN 'completed' ELSE 'partial' END,
           'GBP', b.invoice_number,
           jsonb_build_object(
               'collected_by', p_collected_by,
               'denominations', p_denominations,
               'payment_type', 'cash',
               'gross_amount', v_gross,
               'cumulative_paid', v_new_paid,
               'fully_paid', v_fully_paid
           )
    FROM public.bookings b WHERE b.id = p_booking_id;

    RETURN v_cash_payment_id;
END;
$$;
