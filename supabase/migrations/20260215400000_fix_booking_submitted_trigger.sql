-- =============================================================================
-- Fix: Move booking_submitted notification trigger from bookings to
-- booking_stalls so that stall_label and gross_amount are available.
-- The booking row exists but booking_stalls hasn't been inserted yet when
-- AFTER INSERT ON bookings fires.
-- =============================================================================

-- Drop the old trigger on bookings
DROP TRIGGER IF EXISTS trg_notify_booking_submitted ON public.bookings;

-- Rewrite the function to work from a booking_stalls insert
CREATE OR REPLACE FUNCTION public.notify_booking_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking   RECORD;
    v_metadata  JSONB;
    v_recipient RECORD;
BEGIN
    -- Look up the parent booking
    SELECT * INTO v_booking FROM bookings WHERE id = NEW.booking_id;

    -- Only for vendor-submitted bookings (reserved status)
    IF v_booking IS NULL OR v_booking.status != 'reserved' THEN
        RETURN NEW;
    END IF;

    -- Check if we already sent this notification (another stall in the same
    -- booking may have already triggered it)
    IF EXISTS (
        SELECT 1 FROM notifications
        WHERE idempotency_key LIKE format('booking_submitted:%s:%%', v_booking.id)
        LIMIT 1
    ) THEN
        RETURN NEW;
    END IF;

    v_metadata := build_booking_notification_metadata(v_booking.id);

    FOR v_recipient IN
        SELECT nr.user_id, nr.email
        FROM get_notification_recipients('booking_submitted') nr
    LOOP
        PERFORM create_notification(
            v_recipient.user_id,
            v_recipient.email,
            'booking_submitted',
            'New Booking Submitted',
            format('Booking %s submitted by %s for stall %s at %s (%s days, %s).',
                v_metadata->>'invoice_number',
                v_metadata->>'vendor_name',
                v_metadata->>'stall_label',
                v_metadata->>'market_name',
                v_metadata->>'days_count',
                COALESCE(v_metadata->>'gross_amount', v_metadata->>'total_amount')
            ),
            v_metadata,
            format('booking_submitted:%s:%s', v_booking.id, v_recipient.user_id)
        );
    END LOOP;

    RETURN NEW;
END;
$$;

-- Attach to booking_stalls instead
CREATE TRIGGER trg_notify_booking_submitted
    AFTER INSERT ON public.booking_stalls
    FOR EACH ROW
    EXECUTE FUNCTION notify_booking_submitted();

-- =============================================================================
-- Fix: Booking approved notification should also fire when status → 'approved'
-- (reserved bookings approved via Pay Later path set status to 'approved',
--  not 'completed')
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_booking_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_metadata      JSONB;
    v_recipient     RECORD;
    v_vendor_email  TEXT;
    v_is_cash       BOOLEAN;
BEGIN
    v_metadata := build_booking_notification_metadata(NEW.id);
    v_vendor_email := v_metadata->>'vendor_email';

    -- ---------------------------------------------------------------
    -- A) Payment received (payment_status → 'success')
    -- ---------------------------------------------------------------
    IF (OLD.payment_status IS DISTINCT FROM 'success')
       AND NEW.payment_status = 'success' THEN

        SELECT EXISTS (
            SELECT 1 FROM cash_payments WHERE booking_id = NEW.id
        ) INTO v_is_cash;

        IF v_is_cash THEN
            IF NEW.user_id IS NOT NULL AND v_vendor_email IS NOT NULL THEN
                PERFORM create_notification(
                    NEW.user_id,
                    v_vendor_email,
                    'offline_payment_complete',
                    'Payment Complete',
                    format('Your offline payment for booking %s (stall %s at %s) has been fully received.',
                        v_metadata->>'invoice_number',
                        v_metadata->>'stall_label',
                        v_metadata->>'market_name'
                    ),
                    v_metadata,
                    format('offline_payment:%s:vendor', NEW.id)
                );
            END IF;

            FOR v_recipient IN
                SELECT nr.user_id, nr.email
                FROM get_notification_recipients('offline_payment_complete') nr
            LOOP
                PERFORM create_notification(
                    v_recipient.user_id,
                    v_recipient.email,
                    'offline_payment_complete',
                    'Offline Payment Collected',
                    format('Cash/POS payment for booking %s (%s, stall %s at %s) fully collected.',
                        v_metadata->>'invoice_number',
                        v_metadata->>'vendor_name',
                        v_metadata->>'stall_label',
                        v_metadata->>'market_name'
                    ),
                    v_metadata,
                    format('offline_payment:%s:%s', NEW.id, v_recipient.user_id)
                );
            END LOOP;
        ELSE
            FOR v_recipient IN
                SELECT nr.user_id, nr.email
                FROM get_notification_recipients('payment_received') nr
            LOOP
                PERFORM create_notification(
                    v_recipient.user_id,
                    v_recipient.email,
                    'payment_received',
                    'Payment Received',
                    format('Payment received for booking %s from %s (stall %s at %s, amount %s).',
                        v_metadata->>'invoice_number',
                        v_metadata->>'vendor_name',
                        v_metadata->>'stall_label',
                        v_metadata->>'market_name',
                        v_metadata->>'gross_amount'
                    ),
                    v_metadata,
                    format('payment_received:%s:%s', NEW.id, v_recipient.user_id)
                );
            END LOOP;
        END IF;
    END IF;

    -- ---------------------------------------------------------------
    -- B) Booking approved (status → 'completed' OR 'approved')
    --    'completed' = paid booking approved
    --    'approved'  = reserved (pay later) booking approved
    -- ---------------------------------------------------------------
    IF NEW.status IN ('completed', 'approved')
       AND OLD.status NOT IN ('completed', 'approved')
       AND NEW.user_id IS NOT NULL
       AND v_vendor_email IS NOT NULL THEN

        PERFORM create_notification(
            NEW.user_id,
            v_vendor_email,
            'booking_approved',
            'Booking Approved',
            format('Your booking %s for stall %s at %s has been approved!',
                v_metadata->>'invoice_number',
                v_metadata->>'stall_label',
                v_metadata->>'market_name'
            ),
            v_metadata,
            format('booking_approved:%s', NEW.id)
        );
    END IF;

    -- ---------------------------------------------------------------
    -- C) Booking rejected (status → 'cancelled')
    -- ---------------------------------------------------------------
    IF (OLD.status IS DISTINCT FROM 'cancelled')
       AND NEW.status = 'cancelled'
       AND NEW.user_id IS NOT NULL
       AND v_vendor_email IS NOT NULL THEN

        PERFORM create_notification(
            NEW.user_id,
            v_vendor_email,
            'booking_rejected',
            'Booking Rejected',
            format('Your booking %s for stall %s at %s has been rejected/cancelled. If payment was captured, a refund will be processed.',
                v_metadata->>'invoice_number',
                v_metadata->>'stall_label',
                v_metadata->>'market_name'
            ),
            v_metadata,
            format('booking_rejected:%s', NEW.id)
        );
    END IF;

    RETURN NEW;
END;
$$;

-- =============================================================================
-- Fix: Allow simulate_payment_success for both pending and reserved bookings
-- =============================================================================

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

  IF v_booking.status NOT IN ('pending', 'approved') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking must be pending or reserved before payment');
  END IF;

  UPDATE bookings
  SET
    payment_status = 'success',
    paid_amount = COALESCE(gross_amount, total_amount),
    status = CASE WHEN v_booking.status = 'approved' THEN 'completed' ELSE status END,
    updated_at = now()
  WHERE id = p_booking_id;

  UPDATE booking_dates
  SET status = 'booked'
  WHERE booking_id = p_booking_id;

  PERFORM mark_vat_collected(p_booking_id);

  RETURN jsonb_build_object('status', 'success', 'message', 'Payment processed successfully');
END;
$$;
