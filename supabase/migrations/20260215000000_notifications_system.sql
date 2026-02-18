-- =============================================================================
-- Notifications System
-- =============================================================================
-- Creates the notifications table, enum types, granular admin notification
-- permissions, and RLS policies. Each admin-facing notification type has its
-- own permission so different admins can receive different notifications based
-- on role configuration.
-- =============================================================================

-- 1. Enum: notification type
CREATE TYPE public.notification_type AS ENUM (
    -- Admin-facing (vendor → admin)
    'booking_submitted',        -- Vendor submits a new booking
    'payment_received',         -- Payment captured (Pay Now / PayPal)
    'offline_payment_complete', -- FCA completes offline (cash/POS) payment
    'vendor_onboarded',         -- FCA onboards a new vendor

    -- Vendor-facing (admin/system → vendor)
    'booking_approved',         -- Admin approves a booking
    'booking_rejected',         -- Admin rejects a booking
    'vendor_checked_in'         -- FCA checks in a vendor at market
);

-- 2. Enum: notification channel (email-only for now, extensible later)
CREATE TYPE public.notification_channel AS ENUM (
    'email'
);

-- 3. Enum: notification delivery/read status
CREATE TYPE public.notification_status AS ENUM (
    'pending',   -- Queued, not yet sent
    'sent',      -- Email dispatched successfully
    'failed',    -- Email dispatch failed
    'read'       -- Recipient has read (notification center)
);

-- =============================================================================
-- 4. Notifications Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    type            public.notification_type NOT NULL,
    channel         public.notification_channel NOT NULL DEFAULT 'email',
    status          public.notification_status NOT NULL DEFAULT 'pending',
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    -- Idempotency: prevents duplicate notifications for the same event
    idempotency_key TEXT NOT NULL UNIQUE,
    -- Lifecycle timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    -- Error tracking for failed sends
    error_message   TEXT
);

-- Indexes
CREATE INDEX idx_notifications_recipient   ON public.notifications(recipient_id);
CREATE INDEX idx_notifications_status      ON public.notifications(status);
CREATE INDEX idx_notifications_type        ON public.notifications(type);
CREATE INDEX idx_notifications_created_at  ON public.notifications(created_at DESC);
-- Composite: vendor notification center queries (my unread, ordered)
CREATE INDEX idx_notifications_recipient_unread
    ON public.notifications(recipient_id, created_at DESC)
    WHERE status != 'read';

-- =============================================================================
-- 5. RLS Policies
-- =============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Vendors can read their own notifications
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = recipient_id);

-- Vendors can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);

-- Admins with notifications.view.all can see all notifications
CREATE POLICY "Admins can view all notifications"
    ON public.notifications FOR SELECT
    USING (has_permission(auth.uid(), 'notifications.view.all'));

-- Service role / triggers can insert (SECURITY DEFINER functions handle this)
CREATE POLICY "System can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

-- Grant table access to authenticated and service_role
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

-- =============================================================================
-- 6. Notification Permissions
-- =============================================================================
-- Granular permissions: each admin-facing notification type has its own
-- receive permission, so different admin roles can subscribe to different
-- notification streams.
-- =============================================================================

INSERT INTO public.permissions (key, name, description, category)
VALUES
    -- Admin-facing: controls which admins receive each notification type
    ('notifications.receive.booking_submitted',
     'Receive Booking Submitted Notifications',
     'Receive email when a vendor submits a new booking',
     'notifications'),

    ('notifications.receive.payment_received',
     'Receive Payment Received Notifications',
     'Receive email when a payment is captured for a booking',
     'notifications'),

    ('notifications.receive.offline_payment',
     'Receive Offline Payment Notifications',
     'Receive email when an FCA completes an offline (cash/POS) payment',
     'notifications'),

    ('notifications.receive.vendor_onboarded',
     'Receive Vendor Onboarded Notifications',
     'Receive email when an FCA onboards a new vendor',
     'notifications'),

    -- General notification management
    ('notifications.view.all',
     'View All Notifications',
     'View all notifications across the platform (admin oversight)',
     'notifications'),

    ('notifications.manage',
     'Manage Notifications',
     'Manage notification settings and configuration',
     'notifications')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 7. Assign Notification Permissions to Roles
-- =============================================================================

-- Admin gets ALL notification permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'admin'
  AND p.key IN (
      'notifications.receive.booking_submitted',
      'notifications.receive.payment_received',
      'notifications.receive.offline_payment',
      'notifications.receive.vendor_onboarded',
      'notifications.view.all',
      'notifications.manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- FCA gets offline-payment notification (they may need visibility on their own collections)
-- Extend as needed; FCA does not receive admin email notifications by default.

-- Vendor role does NOT receive admin notification permissions.
-- Vendor notifications (approved, rejected, checked_in) are sent directly to
-- the booking owner — no permission gating needed for those.

-- =============================================================================
-- 8. Helper: find admin recipients for a given notification type
-- =============================================================================
-- Returns user IDs and emails of admins who have the permission to receive
-- a specific notification type. Used by trigger functions to fan-out
-- notifications to the right admins.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_notification_recipients(p_notification_type public.notification_type)
RETURNS TABLE(user_id UUID, email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id AS user_id, u.email
    FROM auth.users u
    JOIN public.user_roles ur ON ur.user_id = u.id
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE p.key = (
        CASE p_notification_type
            WHEN 'booking_submitted'        THEN 'notifications.receive.booking_submitted'
            WHEN 'payment_received'         THEN 'notifications.receive.payment_received'
            WHEN 'offline_payment_complete'  THEN 'notifications.receive.offline_payment'
            WHEN 'vendor_onboarded'         THEN 'notifications.receive.vendor_onboarded'
            ELSE NULL
        END
    );
$$;

-- =============================================================================
-- 9. Helper: create notification (idempotent insert)
-- =============================================================================
-- Central function used by all triggers to queue a notification.
-- Silently skips if the idempotency_key already exists.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_notification(
    p_recipient_id    UUID,
    p_recipient_email TEXT,
    p_type            public.notification_type,
    p_title           TEXT,
    p_body            TEXT,
    p_metadata        JSONB DEFAULT '{}',
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO public.notifications (
        recipient_id, recipient_email, type, title, body, metadata, idempotency_key
    )
    VALUES (
        p_recipient_id, p_recipient_email, p_type, p_title, p_body, p_metadata, p_idempotency_key
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$;

-- =============================================================================
-- 10. Helper: build booking notification metadata
-- =============================================================================
-- Gathers context (market, stall, vendor, amounts) for a given booking.
-- Used by all booking-related trigger functions.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.build_booking_notification_metadata(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_metadata JSONB;
BEGIN
    SELECT jsonb_build_object(
        'booking_id',      b.id,
        'invoice_number',  b.invoice_number,
        'status',          b.status,
        'payment_status',  b.payment_status,
        'total_amount',    b.total_amount,
        'gross_amount',    b.gross_amount,
        'paid_amount',     b.paid_amount,
        'selected_dates',  b.selected_dates,
        'days_count',      b.days_count,
        'market_name',     m.name,
        'market_id',       m.id,
        'stall_label',     si.label,
        'stall_instance_id', si.id,
        'vendor_name',     COALESCE(p.full_name, 'Vendor'),
        'vendor_email',    COALESCE(p.email, u.email),
        'vendor_id',       b.user_id
    )
    INTO v_metadata
    FROM bookings b
    LEFT JOIN booking_stalls bs ON bs.booking_id = b.id
    LEFT JOIN stall_instances si ON si.id = bs.stall_instance_id
    LEFT JOIN markets m ON m.id = b.market_id
    LEFT JOIN profiles p ON p.id = b.user_id
    LEFT JOIN auth.users u ON u.id = b.user_id
    WHERE b.id = p_booking_id
    LIMIT 1;

    RETURN COALESCE(v_metadata, '{}'::jsonb);
END;
$$;

-- =============================================================================
-- 11. Trigger: booking submitted → notify admins
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_booking_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_metadata JSONB;
    v_recipient RECORD;
BEGIN
    -- Only for vendor-submitted bookings (FCA bookings are auto-approved, status != 'pending')
    IF NEW.status != 'pending' THEN
        RETURN NEW;
    END IF;

    v_metadata := build_booking_notification_metadata(NEW.id);

    -- Fan out to all admins with the booking_submitted permission
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
                v_metadata->>'gross_amount'
            ),
            v_metadata,
            format('booking_submitted:%s:%s', NEW.id, v_recipient.user_id)
        );
    END LOOP;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_booking_submitted
    AFTER INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION notify_booking_submitted();

-- =============================================================================
-- 12. Trigger: booking status / payment changes → multiple notification types
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

        -- Check if this booking was paid via cash
        SELECT EXISTS (
            SELECT 1 FROM cash_payments WHERE booking_id = NEW.id
        ) INTO v_is_cash;

        IF v_is_cash THEN
            -- Offline payment complete → notify vendor + admins
            -- Notify vendor
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

            -- Notify admins
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
            -- Online payment → notify admins only
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
    -- B) Booking approved (status → 'completed')
    -- ---------------------------------------------------------------
    IF (OLD.status IS DISTINCT FROM 'completed')
       AND NEW.status = 'completed'
       AND NEW.user_id IS NOT NULL
       AND v_vendor_email IS NOT NULL THEN

        PERFORM create_notification(
            NEW.user_id,
            v_vendor_email,
            'booking_approved',
            'Booking Approved',
            format('Your booking %s for stall %s at %s has been approved! Your QR code is now available.',
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

CREATE TRIGGER trg_notify_booking_status_changed
    AFTER UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION notify_booking_status_changed();

-- =============================================================================
-- 13. Trigger: vendor checked in → notify vendor
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_vendor_checked_in()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_metadata     JSONB;
    v_vendor_email TEXT;
    v_vendor_id    UUID;
    v_booking_date DATE;
BEGIN
    -- Only fire when checked_in_at transitions from NULL to NOT NULL
    IF OLD.checked_in_at IS NOT NULL OR NEW.checked_in_at IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get booking context
    v_metadata := build_booking_notification_metadata(NEW.booking_id);
    v_vendor_id    := (v_metadata->>'vendor_id')::UUID;
    v_vendor_email := v_metadata->>'vendor_email';
    v_booking_date := NEW.booking_date;

    IF v_vendor_id IS NOT NULL AND v_vendor_email IS NOT NULL THEN
        -- Add the specific date to metadata
        v_metadata := v_metadata || jsonb_build_object('checked_in_date', v_booking_date);

        PERFORM create_notification(
            v_vendor_id,
            v_vendor_email,
            'vendor_checked_in',
            'Check-In Confirmed',
            format('You have been checked in for %s at stall %s (%s) on %s.',
                v_metadata->>'market_name',
                v_metadata->>'stall_label',
                v_metadata->>'invoice_number',
                v_booking_date::TEXT
            ),
            v_metadata,
            format('vendor_checkin:%s', NEW.id)
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_vendor_checked_in
    AFTER UPDATE ON public.booking_dates
    FOR EACH ROW
    EXECUTE FUNCTION notify_vendor_checked_in();

-- =============================================================================
-- 14. Trigger: vendor onboarded by FCA → notify admins
-- =============================================================================
-- Fires when the invite-user edge function creates a new user with the
-- vendors.invite permission (FCA onboarding). We detect this by watching
-- for new profile rows where there is no existing booking (pure onboarding).
-- NOTE: This is best handled in the invite-user edge function for more
-- accurate detection. This trigger provides a fallback.
-- =============================================================================

-- (vendor_onboarded notifications are dispatched from the invite-user edge
-- function where we have full context about who performed the invitation.
-- See supabase/functions/invite-user/index.ts for the implementation.)

-- =============================================================================
-- 15. Helper: mark notification as read
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.notifications
    SET status  = 'read',
        read_at = now()
    WHERE id = p_notification_id
      AND recipient_id = auth.uid()
      AND status != 'read';
END;
$$;

-- =============================================================================
-- 16. Helper: mark all notifications as read for current user
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.notifications
    SET status  = 'read',
        read_at = now()
    WHERE recipient_id = auth.uid()
      AND status != 'read';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- =============================================================================
-- 17. Enable Supabase Realtime for notifications table
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =============================================================================
-- 18. Email dispatch — Supabase Dashboard Webhook (manual setup)
-- =============================================================================
-- Configure a Database Webhook in the Supabase Dashboard to automatically
-- send emails whenever a notification row is created.
--
-- Steps:
--   1. Go to Database → Webhooks → Create a new webhook
--   2. Name:   send-notification-on-insert
--   3. Table:  notifications
--   4. Events: INSERT
--   5. Type:   Supabase Edge Function
--   6. Edge Function: send-notification
--   7. HTTP Headers (added automatically by Supabase when you pick the function)
--   8. Save
--
-- The webhook will POST the full inserted row to the edge function.
-- The edge function reads notification_id from the payload, sends the
-- email via Resend, and updates the row status to 'sent' or 'failed'.
--
-- Retry / batch fallback:
--   Call the edge function manually with { "process_pending": 50 }
--   to sweep any notifications stuck in 'pending' status.
-- =============================================================================
