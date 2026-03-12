-- ============================================================
-- Update get_notification_recipients to handle refund types
-- ============================================================
-- This must be in a separate migration because PostgreSQL requires
-- new enum values (added via ALTER TYPE ADD VALUE in the previous
-- migration) to be committed before they can be referenced.
-- ============================================================

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
            WHEN 'refund_requested'         THEN 'notifications.receive.refund_requested'
            WHEN 'refund_resolved'          THEN 'notifications.receive.refund_resolved'
            ELSE NULL
        END
    );
$$;
