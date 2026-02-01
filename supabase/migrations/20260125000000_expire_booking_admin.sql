-- Update expire_booking: keep same name, remove user match when fetching (any authenticated
-- user can expire any booking by id). No admin/permission check. Stall holds are cleared
-- for the booking owner (v_booking.user_id).

CREATE OR REPLACE FUNCTION public.expire_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking bookings%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Authentication required');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking not found');
  END IF;

  -- Only block if a hold is set and still in the future (allow expire when NULL or in the past)
  IF v_booking.hold_expires_at IS NOT NULL AND v_booking.hold_expires_at > now() THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Booking is not expired');
  END IF;

  -- Check if already paid
  IF v_booking.payment_status = 'success' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Cannot expire a paid booking');
  END IF;

  -- Mark as expired and cancel payment
  UPDATE bookings
  SET
    status = 'expired',
    payment_status = 'cancelled',
    updated_at = now()
  WHERE id = p_booking_id;

  -- Mark booking_dates as 'available' so stall/date slots can be rebooked (keep rows for records)
  UPDATE booking_dates
  SET status = 'available'
  WHERE booking_id = p_booking_id;

  -- Remove all holds for the booking owner
  DELETE FROM stall_holds
  WHERE user_id = v_booking.user_id
  AND stall_instance_id IN (
    SELECT bs.stall_instance_id
    FROM booking_stalls bs
    WHERE bs.booking_id = p_booking_id
  );

  RETURN jsonb_build_object('status', 'success', 'message', 'Booking expired and holds released');
END;
$function$; 



-- ============================================================================
-- vendors.invite permission and related RLS policies
-- Allow users with vendors.invite to view permissions/role_permissions (for invite flow)
-- ============================================================================

-- Create vendors.invite permission
INSERT INTO public.permissions (key, name, description, category)
VALUES (
  'vendors.invite',
  'Invite Vendors',
  'Invite new vendors to the platform',
  'vendors'
)
ON CONFLICT (key) DO NOTHING;

-- Users with vendors.invite can view permissions
CREATE POLICY "Users with vendors.invite can view permissions"
  ON public.permissions FOR SELECT
  USING (public.has_permission(auth.uid(), 'vendors.invite'));

-- Users with vendors.invite can view role_permissions
CREATE POLICY "Users with vendors.invite can view role_permissions"
  ON public.role_permissions FOR SELECT
  USING (public.has_permission(auth.uid(), 'vendors.invite'));

-- Grant vendors.invite permission to admin and FCA roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key = 'vendors.invite'
WHERE r.key IN ('admin', 'fca')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant bookings.manage permission to FCA role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key = 'bookings.manage'
WHERE r.key = 'fca'
ON CONFLICT (role_id, permission_id) DO NOTHING;