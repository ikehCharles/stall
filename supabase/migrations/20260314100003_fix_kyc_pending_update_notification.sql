-- =============================================================================
-- Fix: Updating a PENDING KYC application did not trigger a notification
-- =============================================================================
-- The previous guard `IF TG_OP = 'UPDATE' AND OLD.status = 'PENDING'` exited
-- early, so vendors editing their pending KYC (before admin review) never
-- sent a notification. Now we distinguish three submission types:
--   INSERT                          → "New Submission"
--   UPDATE from non-PENDING→PENDING → "Resubmission"
--   UPDATE from PENDING→PENDING     → "Updated Submission"
-- =============================================================================

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
BEGIN
    -- Only fire when status is PENDING (new submission or resubmission)
    IF NEW.status != 'PENDING' THEN
        RETURN NEW;
    END IF;

    -- Determine submission type
    IF TG_OP = 'INSERT' THEN
        v_submission_type := 'New Submission';
    ELSIF OLD.status != 'PENDING' THEN
        v_submission_type := 'Resubmission';
    ELSE
        v_submission_type := 'Updated Submission';
    END IF;

    -- Get vendor info
    SELECT COALESCE(p.full_name, 'Vendor'), COALESCE(p.email, u.email)
    INTO v_vendor_name, v_vendor_email
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE u.id = NEW.user_id;

    -- Build metadata (review_url is a relative path; the send-notification
    -- edge function resolves any *_url starting with / using CLIENT_BASEURL)
    v_metadata := jsonb_build_object(
        'kyc_id',           NEW.id,
        'vendor_id',        NEW.user_id,
        'business_name',    NEW.business_name,
        'contact_email',    NEW.contact_email,
        'vendor_name',      v_vendor_name,
        'vendor_email',     v_vendor_email,
        'submission_type',  v_submission_type,
        'submitted_at',     to_char(COALESCE(NEW.submitted_at, now()), 'YYYY-MM-DD HH24:MI'),
        'review_url',       '/admin/kyc'
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
