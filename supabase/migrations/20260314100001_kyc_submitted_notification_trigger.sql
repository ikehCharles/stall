-- =============================================================================
-- KYC Submitted Notification: trigger + get_notification_recipients update
-- Must be a separate migration because PostgreSQL requires new enum values
-- (added via ALTER TYPE ADD VALUE) to be committed before they can be
-- referenced in CASE expressions.
-- =============================================================================

-- 1. Update get_notification_recipients to handle kyc_submitted
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
            WHEN 'kyc_submitted'            THEN 'notifications.receive.kyc_submitted'
            ELSE NULL
        END
    );
$$;

-- 2. Trigger function: notify admins when KYC application is created or resubmitted
CREATE OR REPLACE FUNCTION public.notify_kyc_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vendor_name    TEXT;
    v_vendor_email   TEXT;
    v_submission_type TEXT;
    v_metadata       JSONB;
    v_recipient      RECORD;
    v_site_url       TEXT;
    v_review_url     TEXT;
BEGIN
    -- Only fire when status is PENDING (new submission or resubmission)
    IF NEW.status != 'PENDING' THEN
        RETURN NEW;
    END IF;

    -- For UPDATE: only fire if status changed TO PENDING (resubmission)
    IF TG_OP = 'UPDATE' AND OLD.status = 'PENDING' THEN
        RETURN NEW;
    END IF;

    -- Determine submission type
    IF TG_OP = 'INSERT' THEN
        v_submission_type := 'New Submission';
    ELSE
        v_submission_type := 'Resubmission';
    END IF;

    -- Get vendor info
    SELECT COALESCE(p.full_name, 'Vendor'), COALESCE(p.email, u.email)
    INTO v_vendor_name, v_vendor_email
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE u.id = NEW.user_id;

    -- Build the review deep link
    -- Read site URL from Supabase config or settings
    SELECT COALESCE(
        (SELECT value FROM settings WHERE key = 'app_url' AND source = 'platform' LIMIT 1),
        current_setting('app.settings.site_url', true),
        'http://localhost:8080'
    ) INTO v_site_url;

    v_review_url := v_site_url || '/admin/kyc';

    -- Build metadata
    v_metadata := jsonb_build_object(
        'kyc_id',           NEW.id,
        'vendor_id',        NEW.user_id,
        'business_name',    NEW.business_name,
        'contact_email',    NEW.contact_email,
        'vendor_name',      v_vendor_name,
        'vendor_email',     v_vendor_email,
        'submission_type',  v_submission_type,
        'submitted_at',     to_char(COALESCE(NEW.submitted_at, now()), 'YYYY-MM-DD HH24:MI'),
        'review_url',       v_review_url
    );

    -- Fan out to all admins with the kyc_submitted permission
    FOR v_recipient IN
        SELECT nr.user_id, nr.email
        FROM get_notification_recipients('kyc_submitted') nr
    LOOP
        PERFORM create_notification(
            v_recipient.user_id,
            v_recipient.email,
            'kyc_submitted',
            'KYC Application Submitted',
            format('%s has submitted a KYC application for %s (%s). Click to review.',
                v_vendor_name,
                NEW.business_name,
                v_submission_type
            ),
            v_metadata,
            format('kyc_submitted:%s:%s:%s', NEW.id, v_recipient.user_id, COALESCE(NEW.updated_at, now()))
        );
    END LOOP;

    RETURN NEW;
END;
$$;

-- 3. Attach trigger to kyc_applications for INSERT and UPDATE
CREATE TRIGGER trg_notify_kyc_submitted
    AFTER INSERT OR UPDATE ON public.kyc_applications
    FOR EACH ROW
    EXECUTE FUNCTION notify_kyc_submitted();
