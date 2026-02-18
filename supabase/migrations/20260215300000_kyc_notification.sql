-- =============================================================================
-- KYC Notification: email templates + trigger
-- Sends an email to the vendor when admin approves or rejects their KYC.
-- =============================================================================

-- 1. Add new notification types
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'kyc_approved';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'kyc_rejected';

-- 2. Seed email templates for KYC responses
INSERT INTO public.email_templates (key, name, subject, html_body, variables, is_default)
VALUES
-- ---- kyc_approved ----
('kyc_approved', 'KYC Approved', 'Your KYC Application Has Been Approved',
'<h2 style="color: #1f2937; margin: 0 0 8px;">KYC Application Approved</h2>
<p style="color: #6b7280;">Hi {{vendor_name}},</p>
<p style="color: #6b7280;">Great news! Your KYC application for <strong>{{business_name}}</strong> has been reviewed and <strong style="color: #16a34a;">approved</strong>.</p>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Business Name</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{business_name}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; font-size: 14px;">Status</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #16a34a; font-weight: 600; font-size: 14px;">Approved</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; font-size: 14px;">Business Address</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{business_address}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; font-size: 14px;">Reviewed On</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{reviewed_at}}</td></tr>
</table>
<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <p style="color: #166534; margin: 0; font-size: 14px;">You can now proceed to book stalls on StallBook. Log in to your account to get started!</p>
</div>
<p style="color: #6b7280; font-size: 14px;">If you have any questions, please contact our support team.</p>',
'["vendor_name","business_name","business_address","contact_email","reviewed_at","review_notes","reviewer_name","reviewer_email"]', true),

-- ---- kyc_rejected ----
('kyc_rejected', 'KYC Rejected', 'Your KYC Application Requires Attention',
'<h2 style="color: #1f2937; margin: 0 0 8px;">KYC Application Update</h2>
<p style="color: #6b7280;">Hi {{vendor_name}},</p>
<p style="color: #6b7280;">We''ve reviewed your KYC application for <strong>{{business_name}}</strong> and unfortunately it could not be approved at this time.</p>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Business Name</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{business_name}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; font-size: 14px;">Status</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: 600; font-size: 14px;">Rejected</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; font-size: 14px;">Business Address</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{business_address}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; font-size: 14px;">Reviewed On</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{reviewed_at}}</td></tr>
</table>
<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <p style="color: #991b1b; margin: 0 0 4px; font-size: 13px; font-weight: 600;">Reason for rejection:</p>
  <p style="color: #991b1b; margin: 0; font-size: 14px;">{{review_notes}}</p>
</div>
<p style="color: #6b7280; font-size: 14px;">Please review the feedback above and resubmit your application with the necessary corrections. If you believe this was an error, contact our support team.</p>',
'["vendor_name","business_name","business_address","contact_email","reviewed_at","review_notes","reviewer_name","reviewer_email"]', true)

ON CONFLICT (key) DO NOTHING;

-- 3. Trigger function: notify vendor when KYC status changes to APPROVED or REJECTED
CREATE OR REPLACE FUNCTION public.notify_kyc_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vendor_name   TEXT;
    v_vendor_email  TEXT;
    v_reviewer_name TEXT;
    v_reviewer_email TEXT;
    v_ntype         public.notification_type;
    v_title         TEXT;
    v_body          TEXT;
    v_metadata      JSONB;
BEGIN
    -- Only fire for APPROVED or REJECTED status
    IF NEW.status NOT IN ('APPROVED', 'REJECTED') THEN
        RETURN NEW;
    END IF;

    -- Fire when status changes, OR when reviewed_at changes (covers re-reviews
    -- where status stays the same, e.g. a second rejection after resubmission)
    IF OLD.status = NEW.status AND OLD.reviewed_at IS NOT DISTINCT FROM NEW.reviewed_at THEN
        RETURN NEW;
    END IF;

    -- Get vendor info
    SELECT COALESCE(p.full_name, 'Vendor'), COALESCE(p.email, u.email)
    INTO v_vendor_name, v_vendor_email
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE u.id = NEW.user_id;

    -- Get reviewer (admin) info
    SELECT COALESCE(p.full_name, 'Admin'), COALESCE(p.email, u.email)
    INTO v_reviewer_name, v_reviewer_email
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE u.id = NEW.reviewed_by;

    -- Build metadata
    v_metadata := jsonb_build_object(
        'kyc_id',           NEW.id,
        'business_name',    NEW.business_name,
        'contact_email',    NEW.contact_email,
        'business_address', COALESCE(NEW.business_address, ''),
        'vendor_name',      v_vendor_name,
        'vendor_email',     v_vendor_email,
        'reviewer_name',    v_reviewer_name,
        'reviewer_email',   v_reviewer_email,
        'review_notes',     COALESCE(NEW.review_notes, ''),
        'reviewed_at',      to_char(COALESCE(NEW.reviewed_at, now()), 'YYYY-MM-DD HH24:MI')
    );

    IF NEW.status = 'APPROVED' THEN
        v_ntype := 'kyc_approved';
        v_title := 'KYC Application Approved';
        v_body  := format('Your KYC application for %s has been approved. You can now book stalls.', NEW.business_name);
    ELSE
        v_ntype := 'kyc_rejected';
        v_title := 'KYC Application Rejected';
        v_body  := format('Your KYC application for %s has been rejected. Reason: %s', NEW.business_name, COALESCE(NEW.review_notes, 'No reason provided'));
    END IF;

    -- Send notification directly to the vendor (not admin fan-out)
    PERFORM create_notification(
        NEW.user_id,
        v_vendor_email,
        v_ntype,
        v_title,
        v_body,
        v_metadata,
        format('kyc_%s:%s:%s', NEW.status, NEW.id, COALESCE(NEW.reviewed_at, now()))
    );

    RETURN NEW;
END;
$$;

-- 4. Attach trigger to kyc_applications table
CREATE TRIGGER trg_notify_kyc_status_changed
    AFTER UPDATE ON public.kyc_applications
    FOR EACH ROW
    EXECUTE FUNCTION notify_kyc_status_changed();
