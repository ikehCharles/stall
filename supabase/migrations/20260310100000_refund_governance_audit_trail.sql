-- ============================================================
-- Refund Governance & Flexible Audit Trail
-- ============================================================
-- 1. Creates a generic audit_log table for cross-table action logging
-- 2. Adds refund_status / refund_reason columns to bookings
-- 3. Creates has_permissions() RPC (multi-permission check)
-- 4. Adds refund + audit_log permission keys
-- 5. Adds refund_requested notification type + receive permission
-- 6. Helper function log_audit_entry()
-- 7. DB functions: request_booking_refund, reject_refund_request
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Generic audit_log table
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  performed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);
CREATE INDEX idx_audit_log_performed_by ON public.audit_log(performed_by);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with audit_log.view can view audit logs"
  ON public.audit_log FOR SELECT
  USING (has_permission(auth.uid(), 'audit_log.view'));

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

GRANT ALL ON TABLE public.audit_log TO service_role;

-- ──────────────────────────────────────────────────────────────
-- 2. Helper function: log_audit_entry
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_audit_entry(
  p_table_name TEXT,
  p_record_id UUID,
  p_action TEXT,
  p_performed_by UUID,
  p_from_status TEXT DEFAULT NULL,
  p_to_status TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entry_id UUID;
BEGIN
  INSERT INTO public.audit_log (
    table_name, record_id, action, performed_by,
    from_status, to_status, reason, metadata
  )
  VALUES (
    p_table_name, p_record_id, p_action, p_performed_by,
    p_from_status, p_to_status, p_reason, p_metadata
  )
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 3. Add refund_status & refund_reason columns to bookings
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT NULL;

COMMENT ON COLUMN public.bookings.refund_status IS
  'Refund workflow status: NULL (no refund), requested, completed, rejected';

CREATE INDEX IF NOT EXISTS idx_bookings_refund_status
  ON public.bookings(refund_status)
  WHERE refund_status IS NOT NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS refund_reason TEXT DEFAULT NULL;

-- ──────────────────────────────────────────────────────────────
-- 4. has_permissions() – multi-permission check RPC
--    Accepts TEXT[] of permission keys and a BOOLEAN match_all flag.
--    match_all = true  → user must have ALL listed permissions
--    match_all = false → user must have ANY of the listed permissions
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_permissions(
  user_uuid UUID,
  permissions TEXT[],
  match_all BOOLEAN DEFAULT false
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN match_all THEN
      (
        SELECT COUNT(DISTINCT p.key) = array_length(permissions, 1)
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = user_uuid
          AND p.key = ANY(permissions)
      )
    ELSE
      EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = user_uuid
          AND p.key = ANY(permissions)
      )
  END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 5. Seed permissions
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.permissions (key, name, description, category)
VALUES
  ('refunds.request', 'Request Refund', 'Can initiate a refund request for a cancelled booking', 'refunds'),
  ('refunds.approve', 'Approve Refund', 'Can approve and execute a refund request', 'refunds'),
  ('audit_log.view', 'View Audit Log', 'Can view the audit log trail', 'audit_log'),
  ('notifications.receive.refund_requested', 'Receive Refund Requested', 'Receives notification when a refund is requested', 'notifications'),
  ('notifications.receive.refund_resolved', 'Receive Refund Resolved', 'Receives notification when a refund is approved or rejected', 'notifications')
ON CONFLICT (key) DO NOTHING;

-- Assign all four to the admin role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'admin'
  AND p.key IN (
    'refunds.request',
    'refunds.approve',
    'audit_log.view',
    'notifications.receive.refund_requested',
    'notifications.receive.refund_resolved'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 6. Add refund_requested notification type to the enum
-- ──────────────────────────────────────────────────────────────
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'refund_requested';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'refund_resolved';

-- ──────────────────────────────────────────────────────────────
-- 7. get_notification_recipients update moved to next migration
--    (PostgreSQL requires new enum values to be committed before use)
-- ──────────────────────────────────────────────────────────────

-- ──────────────────────────────────────────────────────────────
-- 8. DB function: request_booking_refund
--    Pre-conditions: booking_status = cancelled,
--                    payment_status = success,
--                    refund_status IS NULL
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_booking_refund(
  p_booking_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_booking RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Authentication required');
  END IF;

  IF NOT has_permission(v_user_id, 'refunds.request') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Permission denied: refunds.request required');
  END IF;

  SELECT id, status, payment_status, refund_status, total_amount
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF v_booking IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found');
  END IF;

  IF v_booking.status != 'cancelled' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking must be cancelled before requesting a refund');
  END IF;

  IF v_booking.payment_status != 'success' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'No successful payment found for this booking');
  END IF;

  IF v_booking.refund_status IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'A refund has already been ' || v_booking.refund_status || ' for this booking');
  END IF;

  UPDATE public.bookings
  SET refund_status = 'requested',
      refund_reason = p_reason
  WHERE id = p_booking_id;

  PERFORM log_audit_entry(
    'bookings', p_booking_id, 'refund_requested', v_user_id,
    NULL, 'requested', p_reason,
    jsonb_build_object(
      'total_amount', v_booking.total_amount,
      'payment_status', v_booking.payment_status
    )
  );

  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Refund request submitted for approval'
  );
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 9. DB function: reject_refund_request
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_refund_request(
  p_booking_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_booking RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Authentication required');
  END IF;

  IF NOT has_permission(v_user_id, 'refunds.approve') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Permission denied: refunds.approve required');
  END IF;

  SELECT id, refund_status, refund_reason
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF v_booking IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found');
  END IF;

  IF v_booking.refund_status != 'requested' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'No pending refund request for this booking');
  END IF;

  UPDATE public.bookings
  SET refund_status = 'rejected',
      refund_reason = p_reason
  WHERE id = p_booking_id;

  PERFORM log_audit_entry(
    'bookings', p_booking_id, 'refund_rejected', v_user_id,
    'requested', 'rejected', p_reason,
    jsonb_build_object('original_reason', v_booking.refund_reason)
  );

  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Refund request has been rejected'
  );
END;
$$;
