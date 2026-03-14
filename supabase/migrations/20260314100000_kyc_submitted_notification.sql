-- =============================================================================
-- KYC Submitted Notification: notify permitted admins when a vendor
-- creates or resubmits a KYC application.
-- =============================================================================
-- Acceptance criteria:
--   1. Triggered on KYC creation (INSERT) or resubmission (UPDATE → PENDING)
--   2. Sent only to admins with the kyc_submitted notification permission
--   3. Includes deep link to the KYC review page
-- =============================================================================

-- 1. Add new notification type enum value
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'kyc_submitted';

-- 2. Seed the permission
INSERT INTO public.permissions (key, name, description, category)
VALUES
  ('notifications.receive.kyc_submitted',
   'Receive KYC Submitted Notifications',
   'Receive notification when a vendor submits or resubmits a KYC application',
   'notifications')
ON CONFLICT (key) DO NOTHING;

-- 3. Assign to admin role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'admin'
  AND p.key = 'notifications.receive.kyc_submitted'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Email template for the admin notification
INSERT INTO public.email_templates (key, name, subject, html_body, variables, is_default)
VALUES
('kyc_submitted', 'KYC Submitted', 'New KYC Application Requires Review',
'<h2 style="color: #1f2937; margin: 0 0 8px;">KYC Application Submitted</h2>
<p style="color: #6b7280;">A vendor has submitted a KYC application that requires your review.</p>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Vendor</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{vendor_name}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; font-size: 14px;">Business Name</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{business_name}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; font-size: 14px;">Contact Email</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{contact_email}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; font-size: 14px;">Submission Type</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{submission_type}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; font-size: 14px;">Submitted At</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{submitted_at}}</td></tr>
</table>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{review_url}}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Review Application</a>
</div>
<p style="color: #9ca3af; font-size: 13px; text-align: center;">Or copy this link: {{review_url}}</p>',
'["vendor_name","business_name","contact_email","submission_type","submitted_at","review_url"]', true)
ON CONFLICT (key) DO NOTHING;
