-- =============================================================================
-- Add app_name and app_logo_url from platform settings into every notification
-- metadata payload, so email templates can reference {{app_name}} and
-- {{app_logo_url}} directly from the stored notification context.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Redefine build_booking_notification_metadata to include branding fields
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.build_booking_notification_metadata(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_metadata    JSONB;
    v_app_name    TEXT;
    v_app_logo    TEXT;
BEGIN
    -- Gather booking context
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

    v_metadata := COALESCE(v_metadata, '{}'::jsonb);

    -- Fetch platform branding from settings
    SELECT value INTO v_app_name
    FROM settings
    WHERE key = 'app_name' AND source = 'platform'
    LIMIT 1;

    SELECT value INTO v_app_logo
    FROM settings
    WHERE key = 'app_logo_url' AND source = 'platform'
    LIMIT 1;

    v_metadata := v_metadata || jsonb_build_object(
        'app_name',     COALESCE(v_app_name, 'StallBook'),
        'app_logo_url', COALESCE(v_app_logo, '')
    );

    RETURN v_metadata;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Redefine notify_kyc_status_changed to include branding fields
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_kyc_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vendor_name    TEXT;
    v_vendor_email   TEXT;
    v_reviewer_name  TEXT;
    v_reviewer_email TEXT;
    v_app_name       TEXT;
    v_app_logo       TEXT;
    v_ntype          public.notification_type;
    v_title          TEXT;
    v_body           TEXT;
    v_metadata       JSONB;
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

    -- Fetch platform branding from settings
    SELECT value INTO v_app_name
    FROM settings
    WHERE key = 'app_name' AND source = 'platform'
    LIMIT 1;

    SELECT value INTO v_app_logo
    FROM settings
    WHERE key = 'app_logo_url' AND source = 'platform'
    LIMIT 1;

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
        'reviewed_at',      to_char(COALESCE(NEW.reviewed_at, now()), 'YYYY-MM-DD HH24:MI'),
        'app_name',         COALESCE(v_app_name, 'StallBook'),
        'app_logo_url',     COALESCE(v_app_logo, '')
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
