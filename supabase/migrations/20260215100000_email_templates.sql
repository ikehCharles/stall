-- =============================================================================
-- Email Templates System
-- =============================================================================
-- Stores editable email templates that are used by the notification system.
-- Each notification type has a default template that admins can customise
-- via the admin panel WYSIWYG editor.
--
-- Variable placeholders use {{variable_name}} syntax and are replaced at
-- send time by the send-notification edge function.
-- =============================================================================

-- 1. Table
CREATE TABLE IF NOT EXISTS public.email_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    subject     TEXT NOT NULL,
    html_body   TEXT NOT NULL,
    variables   JSONB NOT NULL DEFAULT '[]',
    is_default  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_email_templates_key ON public.email_templates(key);

-- Auto-update updated_at
CREATE TRIGGER set_email_templates_updated_at
    BEFORE UPDATE ON public.email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with notifications.manage can view templates"
    ON public.email_templates FOR SELECT
    USING (has_permission(auth.uid(), 'notifications.manage'));

CREATE POLICY "Users with notifications.manage can manage templates"
    ON public.email_templates FOR ALL
    USING (has_permission(auth.uid(), 'notifications.manage'))
    WITH CHECK (has_permission(auth.uid(), 'notifications.manage'));

GRANT ALL ON TABLE public.email_templates TO authenticated;
GRANT ALL ON TABLE public.email_templates TO service_role;

-- =============================================================================
-- 3. Seed default templates
-- =============================================================================
-- The wrapper (header + footer) is stored as a separate template so it can
-- be edited once and applied to all emails.
-- =============================================================================

INSERT INTO public.email_templates (key, name, subject, html_body, variables, is_default) VALUES

-- ---- Shared wrapper ----
('wrapper', 'Email Wrapper (Header + Footer)', 'N/A',
'<div style="font-family: ''Segoe UI'', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 32px 24px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">{{app_name}}</h1>
  </div>
  <div style="padding: 32px 24px;">
    {{content}}
  </div>
  <div style="border-top: 1px solid #e5e7eb; padding: 20px 24px; text-align: center;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      This is an automated notification from {{app_name}}. Please do not reply to this email.
    </p>
  </div>
</div>',
'["content"]', true),

-- ---- booking_submitted ----
('booking_submitted', 'Booking Submitted (Admin)', 'New Booking Submitted – {{invoice_number}}',
'<h2 style="color: #1f2937; margin: 0 0 8px;">New Booking Submitted</h2>
<p style="color: #6b7280; margin: 0 0 20px;">A vendor has submitted a new booking that requires your attention.</p>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Invoice</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{invoice_number}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Vendor</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{vendor_name}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Market</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{market_name}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Stall</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{stall_label}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Days</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{days_count}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Dates</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{selected_dates}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Amount</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">£{{gross_amount}}</td></tr>
</table>
<p style="color: #6b7280; font-size: 14px;">Log in to the admin panel to review and manage this booking.</p>',
'["invoice_number","vendor_name","market_name","stall_label","days_count","selected_dates","gross_amount"]', true),

-- ---- payment_received ----
('payment_received', 'Payment Received (Admin)', 'Payment Received – {{invoice_number}}',
'<h2 style="color: #1f2937; margin: 0 0 8px;">Payment Received</h2>
<p style="color: #6b7280; margin: 0 0 20px;">An online payment has been captured for a booking.</p>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Invoice</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{invoice_number}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Vendor</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{vendor_name}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Market</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{market_name}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Stall</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{stall_label}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Amount</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">£{{gross_amount}}</td></tr>
</table>
<p style="color: #6b7280; font-size: 14px;">The booking is now awaiting approval.</p>',
'["invoice_number","vendor_name","market_name","stall_label","gross_amount"]', true),

-- ---- offline_payment_complete ----
('offline_payment_complete', 'Offline Payment Complete', 'Offline Payment Complete – {{invoice_number}}',
'<h2 style="color: #1f2937; margin: 0 0 8px;">Offline Payment Collected</h2>
<p style="color: #6b7280; margin: 0 0 20px;">A cash or POS payment has been fully collected for a booking.</p>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Invoice</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{invoice_number}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Vendor</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{vendor_name}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Market</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{market_name}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Stall</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{stall_label}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Amount</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">£{{gross_amount}}</td></tr>
</table>',
'["invoice_number","vendor_name","market_name","stall_label","gross_amount"]', true),

-- ---- vendor_onboarded ----
('vendor_onboarded', 'Vendor Onboarded (Admin)', 'New Vendor Onboarded',
'<h2 style="color: #1f2937; margin: 0 0 8px;">New Vendor Onboarded</h2>
<p style="color: #6b7280; margin: 0 0 20px;">A new vendor has been onboarded by a Field Collections Agent.</p>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Vendor</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{vendor_name}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Vendor Email</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{vendor_email}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Vendor Phone</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{vendor_phone}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Onboarded By</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{fca_name}} ({{fca_email}})</td></tr>
</table>
<p style="color: #6b7280; font-size: 14px;">Review the vendor''s profile and KYC status in the admin panel.</p>',
'["vendor_name","vendor_email","vendor_phone","fca_name","fca_email"]', true),

-- ---- booking_approved ----
('booking_approved', 'Booking Approved (Vendor)', 'Booking Approved – {{invoice_number}}',
'<h2 style="color: #059669; margin: 0 0 8px;">Booking Approved</h2>
<p style="color: #6b7280; margin: 0 0 20px;">Great news! Your booking has been approved.</p>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Invoice</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{invoice_number}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Market</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{market_name}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Stall</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{stall_label}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Dates</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{selected_dates}}</td></tr>
</table>
<div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <p style="color: #065f46; margin: 0; font-size: 14px;"><strong>Your QR code is now available.</strong> Log in to your {{app_name}} account to view your booking details and QR code for check-in.</p>
</div>',
'["invoice_number","market_name","stall_label","selected_dates"]', true),

-- ---- booking_rejected ----
('booking_rejected', 'Booking Rejected (Vendor)', 'Booking Update – {{invoice_number}}',
'<h2 style="color: #dc2626; margin: 0 0 8px;">Booking Rejected</h2>
<p style="color: #6b7280; margin: 0 0 20px;">Unfortunately, your booking has been rejected.</p>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Invoice</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{invoice_number}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Market</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{market_name}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Stall</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{stall_label}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Dates</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{selected_dates}}</td></tr>
</table>
<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <p style="color: #991b1b; margin: 0; font-size: 14px;">If a payment was captured, a refund will be processed. Please contact support if you have questions.</p>
</div>',
'["invoice_number","market_name","stall_label","selected_dates"]', true),

-- ---- vendor_checked_in ----
('vendor_checked_in', 'Check-In Confirmed (Vendor)', 'Check-In Confirmed – {{invoice_number}}',
'<h2 style="color: #1f2937; margin: 0 0 8px;">Check-In Confirmed</h2>
<p style="color: #6b7280; margin: 0 0 20px;">You have been successfully checked in.</p>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Market</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{market_name}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Stall</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{stall_label}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Date</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{checked_in_date}}</td></tr>
  <tr><td style="padding: 8px 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: 600; color: #374151; width: 40%; font-size: 14px;">Invoice</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">{{invoice_number}}</td></tr>
</table>
<div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <p style="color: #1e40af; margin: 0; font-size: 14px;">Welcome to the market! Have a great trading day.</p>
</div>',
'["market_name","stall_label","checked_in_date","invoice_number","selected_dates"]', true),

-- ---- vendor_welcome ----
('vendor_welcome', 'Vendor Welcome (FCA Onboarding)', 'Welcome to {{app_name}} — Set Up Your Password',
'<h2 style="color: #1f2937; margin: 0 0 8px;">Welcome to {{app_name}}!</h2>
<p style="color: #6b7280;">Hi {{vendor_name}},</p>
<p style="color: #6b7280;">An account has been created for you by <strong>{{fca_name}}</strong> on {{app_name}}, the market stall booking platform.</p>
<p style="color: #6b7280;">To get started, you''ll need to set a password for your account.</p>
<div style="text-align: center; margin: 28px 0;">
  <a href="{{reset_url}}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Set Your Password</a>
</div>
<div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="color: #1e40af; margin: 0; font-size: 14px;"><strong>Your login email:</strong> {{vendor_email}}<br/>Click the button above or go to the {{app_name}} login page and use "Forgot Password" to set your password.</p>
</div>
<p style="color: #6b7280; font-size: 14px;">If you didn''t expect this email, please ignore it or contact support.</p>',
'["vendor_name","vendor_email","fca_name","reset_url"]', true),

-- ---- otp_verification ----
('otp_verification', 'OTP Verification', 'Verify your {{app_name}} account',
'<h2 style="color: #1f2937; margin: 0 0 8px; text-align: center;">Welcome to {{app_name}}!</h2>
<p style="color: #6b7280;">Hi {{full_name}},</p>
<p style="color: #6b7280;">Thank you for registering with {{app_name}}. Please use the following verification code to complete your registration:</p>
<div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
  <h2 style="color: #2563eb; font-size: 32px; margin: 0; letter-spacing: 4px;">{{otp_code}}</h2>
</div>
<p style="color: #6b7280;"><strong>This code will expire in 10 minutes.</strong></p>
<p style="color: #6b7280;">If you didn''t create an account with {{app_name}}, please ignore this email.</p>',
'["full_name","otp_code"]', true)

ON CONFLICT (key) DO NOTHING;
