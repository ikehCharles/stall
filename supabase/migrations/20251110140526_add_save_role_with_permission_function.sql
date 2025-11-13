set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.save_role_with_permissions(p_key text, p_name text, p_description text, p_permission_keys text[], p_role_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_role_id uuid;
  v_permission_id uuid;
BEGIN
  IF p_role_id IS NULL THEN
    -- 1️⃣ Create new role
    INSERT INTO roles (key, name, description, is_system)
    VALUES (p_key, p_name, p_description, false)
    RETURNING id INTO v_role_id;
  ELSE
    -- 2️⃣ Update existing role
    UPDATE roles
    SET
      key = p_key,
      name = p_name,
      description = p_description,
      updated_at = NOW()
    WHERE id = p_role_id
    RETURNING id INTO v_role_id;

    -- 3️⃣ Remove old permissions
    DELETE FROM role_permissions WHERE role_id = v_role_id;
  END IF;

  -- 4️⃣ Add new permissions
  IF array_length(p_permission_keys, 1) > 0 THEN
    FOR v_permission_id IN
      SELECT id FROM permissions WHERE key = ANY(p_permission_keys)
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_permission_id);
    END LOOP;
  END IF;

  RETURN v_role_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$DECLARE
  v_vendor_role_id UUID;
  v_role_id UUID;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name, phone_number)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone_number', ''), NULL)
  );
  -- Initialize role id if supplied (case for inviting users)
  v_role_id := NULLIF(NEW.raw_user_meta_data->>'role_id', '') ::UUID;

  -- If not provided, fallback to default "vendor" role
  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id
    FROM public.roles
    WHERE key = 'vendor'
    LIMIT 1;
  END IF;

  -- Assign role if found
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, v_role_id);
  END IF;
  
  RETURN NEW;
END;$function$
;

INSERT INTO public.permissions (key, name, description, category)
VALUES (
  'users.view.self',
  'View Own Profile',
  'View and update own user profile details',
  'users'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key = 'users.view.self'
WHERE r.key IN ('admin', 'fca')
ON CONFLICT (role_id, permission_id) DO NOTHING;


