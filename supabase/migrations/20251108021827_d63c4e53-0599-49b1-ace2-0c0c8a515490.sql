-- Phase 1: RBAC System - Database Schema & Core Functions

-- ============================================================================
-- 1. Create RBAC Tables
-- ============================================================================

-- Permissions catalog
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_permissions_key ON public.permissions(key);
CREATE INDEX idx_permissions_category ON public.permissions(category);

-- Roles (replaces enum as source of truth)
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roles_key ON public.roles(key);

-- Role-Permission mapping
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON public.role_permissions(permission_id);

-- Audit log for RBAC changes
CREATE TABLE IF NOT EXISTS public.rbac_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rbac_audit_actor ON public.rbac_audit_log(actor_id);
CREATE INDEX idx_rbac_audit_entity ON public.rbac_audit_log(entity_type, entity_id);
CREATE INDEX idx_rbac_audit_created ON public.rbac_audit_log(created_at DESC);

-- ============================================================================
-- 2. Update user_roles to enforce single role per user
-- ============================================================================

-- Drop existing table and recreate with single role constraint
DROP TABLE IF EXISTS public.user_roles CASCADE;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id) -- ENFORCE SINGLE ROLE PER USER
);

CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role_id);

-- ============================================================================
-- 3. Seed Default Permissions
-- ============================================================================

INSERT INTO public.permissions (key, name, description, category) VALUES
  -- Markets
  ('markets.view', 'View Markets', 'View published markets and their details', 'markets'),
  ('markets.manage', 'Manage Markets', 'Create, edit, delete, and publish markets', 'markets'),
  
  -- Stalls
  ('stalls.view', 'View Stalls', 'View stall layouts and availability', 'stalls'),
  ('stalls.book.self', 'Book Stalls (Self)', 'Book stalls for own account', 'stalls'),
  ('stalls.book.any', 'Book Stalls (Any User)', 'Book stalls on behalf of any vendor', 'stalls'),
  ('stalls.manage', 'Manage Stalls', 'Create, edit, and configure stall templates', 'stalls'),
  
  -- Vendors
  ('vendors.view.self', 'View Own Profile', 'View and edit own vendor profile', 'vendors'),
  ('vendors.view.all', 'View All Vendors', 'View all vendor profiles', 'vendors'),
  ('vendors.lookup', 'Lookup Vendors', 'Search vendors by email/details', 'vendors'),
  
  -- KYC
  ('kyc.create.self', 'Submit KYC', 'Submit own KYC application', 'kyc'),
  ('kyc.create.pending', 'Create Pending KYC', 'Create KYC applications on behalf of vendors', 'kyc'),
  ('kyc.review', 'Review KYC', 'Approve or reject KYC applications', 'kyc'),
  ('kyc.view.self', 'View Own KYC', 'View own KYC status', 'kyc'),
  ('kyc.view.all', 'View All KYC', 'View all KYC applications', 'kyc'),
  
  -- Bookings
  ('bookings.view.self', 'View Own Bookings', 'View own booking history', 'bookings'),
  ('bookings.view.all', 'View All Bookings', 'View all bookings across platform', 'bookings'),
  ('bookings.create.self', 'Create Own Bookings', 'Create bookings for own account', 'bookings'),
  ('bookings.create.any', 'Create Any Booking', 'Create bookings for any vendor', 'bookings'),
  ('bookings.cancel.self', 'Cancel Own Bookings', 'Cancel own pending bookings', 'bookings'),
  ('bookings.manage', 'Manage Bookings', 'Approve, decline, or modify any booking', 'bookings'),
  
  -- Invoices
  ('invoices.view.self', 'View Own Invoices', 'View own invoices and payment history', 'invoices'),
  ('invoices.view.all', 'View All Invoices', 'View all invoices across platform', 'invoices'),
  ('invoices.create', 'Create Invoices', 'Generate invoices for bookings', 'invoices'),
  
  -- Payments
  ('payments.pay.self', 'Pay Own Invoices', 'Pay own outstanding invoices', 'payments'),
  ('payments.collect', 'Collect Payments', 'Collect on-site payments from vendors', 'payments'),
  ('payments.manage', 'Manage Payments', 'View and manage all payment transactions', 'payments'),
  
  -- Users & Roles
  ('users.view', 'View Users', 'View user list and details', 'users'),
  ('users.invite', 'Invite Users', 'Invite new users and assign roles', 'users'),
  ('users.manage', 'Manage Users', 'Edit user details and status', 'users'),
  ('roles.view', 'View Roles', 'View roles and permissions', 'roles'),
  ('roles.create', 'Create Roles', 'Create new roles and assign permissions', 'roles'),
  ('roles.assign', 'Assign Roles', 'Assign roles to users', 'roles'),
  ('roles.manage', 'Manage Roles', 'Edit or delete roles and permissions', 'roles');

-- ============================================================================
-- 4. Seed Default Roles
-- ============================================================================

INSERT INTO public.roles (key, name, description, is_system) VALUES
  ('admin', 'Administrator', 'Full platform access including user and role management', true),
  ('vendor', 'Vendor', 'Market vendors who book stalls and manage their business', true),
  ('fca', 'Field Collections Agent', 'On-site agents who assist vendors and collect payments', true);

-- ============================================================================
-- 5. Map Permissions to Roles
-- ============================================================================

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  r.id as role_id,
  p.id as permission_id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE 
  -- ADMIN: Gets ALL permissions
  (r.key = 'admin') 
  OR
  -- VENDOR: Limited to self-service permissions
  (r.key = 'vendor' AND p.key IN (
    'markets.view',
    'stalls.view',
    'stalls.book.self',
    'vendors.view.self',
    'kyc.create.self',
    'kyc.view.self',
    'bookings.view.self',
    'bookings.create.self',
    'bookings.cancel.self',
    'invoices.view.self',
    'payments.pay.self'
  ))
  OR
  -- FCA: Field operations permissions
  (r.key = 'fca' AND p.key IN (
    'markets.view',
    'stalls.view',
    'stalls.book.any',
    'vendors.view.all',
    'vendors.lookup',
    'kyc.create.pending',
    'kyc.view.all',
    'bookings.view.all',
    'bookings.create.any',
    'invoices.view.all',
    'invoices.create',
    'payments.collect',
    'payments.manage'
  ));

-- ============================================================================
-- 6. Create Permission Check Functions
-- ============================================================================

-- Get user's role ID
CREATE OR REPLACE FUNCTION public.get_user_role_id(user_uuid UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role_id 
  FROM public.user_roles 
  WHERE user_id = user_uuid 
  LIMIT 1;
$$;

-- Check if user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(user_uuid UUID, permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = user_uuid
      AND p.key = permission_key
  );
$$;

-- Check if user has ANY of the given permissions
CREATE OR REPLACE FUNCTION public.has_any_permission(user_uuid UUID, permission_keys TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = user_uuid
      AND p.key = ANY(permission_keys)
  );
$$;

-- Check if user has ALL of the given permissions
CREATE OR REPLACE FUNCTION public.has_all_permissions(user_uuid UUID, permission_keys TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT p.key) = array_length(permission_keys, 1)
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = user_uuid
    AND p.key = ANY(permission_keys);
$$;

-- Get all user permissions (for session serialization)
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_uuid UUID)
RETURNS TEXT[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(p.key ORDER BY p.key)
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = user_uuid;
$$;

-- Get user's role key (for backward compatibility)
CREATE OR REPLACE FUNCTION public.get_user_role_key(user_uuid UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.key
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = user_uuid
  LIMIT 1;
$$;

-- Get user role with permissions (for auth context)
CREATE OR REPLACE FUNCTION public.get_user_role_with_permissions(user_uuid UUID)
RETURNS TABLE (
  role_key TEXT,
  role_name TEXT,
  permissions TEXT[]
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    r.key as role_key,
    r.name as role_name,
    get_user_permissions(user_uuid) as permissions
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = user_uuid
  LIMIT 1;
$$;

-- ============================================================================
-- 7. Create Audit Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_rbac_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_entity_type TEXT;
  v_before JSONB;
  v_after JSONB;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_before := to_jsonb(OLD);
  END IF;
  
  v_entity_type := TG_TABLE_NAME;
  
  INSERT INTO rbac_audit_log (
    actor_id,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state
  ) VALUES (
    auth.uid(),
    v_action,
    v_entity_type,
    COALESCE(NEW.id, OLD.id),
    v_before,
    v_after
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit triggers
CREATE TRIGGER audit_user_roles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION log_rbac_change();

CREATE TRIGGER audit_roles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION log_rbac_change();

CREATE TRIGGER audit_role_permissions_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION log_rbac_change();

-- ============================================================================
-- 8. Enable RLS on New Tables
-- ============================================================================

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for permissions
CREATE POLICY "Users with roles.view can see permissions"
  ON public.permissions FOR SELECT
  USING (has_permission(auth.uid(), 'roles.view'));

-- RLS Policies for roles
CREATE POLICY "Users with roles.view can see roles"
  ON public.roles FOR SELECT
  USING (has_permission(auth.uid(), 'roles.view'));

CREATE POLICY "Users with roles.create can create roles"
  ON public.roles FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'roles.create'));

CREATE POLICY "Users with roles.manage can update roles"
  ON public.roles FOR UPDATE
  USING (has_permission(auth.uid(), 'roles.manage'));

CREATE POLICY "Users with roles.manage can delete custom roles"
  ON public.roles FOR DELETE
  USING (has_permission(auth.uid(), 'roles.manage') AND NOT is_system);

-- RLS Policies for role_permissions
CREATE POLICY "Users with roles.view can see role permissions"
  ON public.role_permissions FOR SELECT
  USING (has_permission(auth.uid(), 'roles.view'));

CREATE POLICY "Users with roles.create can assign permissions"
  ON public.role_permissions FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'roles.create'));

CREATE POLICY "Users with roles.manage can modify permissions"
  ON public.role_permissions FOR DELETE
  USING (has_permission(auth.uid(), 'roles.manage'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users with users.view can see all user roles"
  ON public.user_roles FOR SELECT
  USING (has_permission(auth.uid(), 'users.view'));

CREATE POLICY "Users with roles.assign can assign roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'roles.assign'));

CREATE POLICY "Users with roles.assign can change roles"
  ON public.user_roles FOR UPDATE
  USING (has_permission(auth.uid(), 'roles.assign'));

CREATE POLICY "Users with roles.assign can revoke roles"
  ON public.user_roles FOR DELETE
  USING (has_permission(auth.uid(), 'roles.assign'));

-- RLS Policies for audit log
CREATE POLICY "Users with users.manage can view audit log"
  ON public.rbac_audit_log FOR SELECT
  USING (has_permission(auth.uid(), 'users.manage'));

-- ============================================================================
-- 9. Update handle_new_user Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_role_id UUID;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name, phone_number)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', '')
  );
  
  -- Get vendor role ID
  SELECT id INTO v_vendor_role_id FROM public.roles WHERE key = 'vendor' LIMIT 1;
  
  -- Assign default vendor role
  IF v_vendor_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, v_vendor_role_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 10. Migrate Existing Users to New Structure
-- ============================================================================

-- Assign existing users to roles based on old get_user_role function
-- This handles users created before this migration
DO $$
DECLARE
  v_admin_role_id UUID;
  v_vendor_role_id UUID;
  v_user_record RECORD;
BEGIN
  -- Get role IDs
  SELECT id INTO v_admin_role_id FROM public.roles WHERE key = 'admin';
  SELECT id INTO v_vendor_role_id FROM public.roles WHERE key = 'vendor';
  
  -- For each existing profile without a role assignment
  FOR v_user_record IN 
    SELECT p.id 
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.id IS NULL
  LOOP
    -- Default to vendor role for existing users
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_user_record.id, v_vendor_role_id)
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END $$;