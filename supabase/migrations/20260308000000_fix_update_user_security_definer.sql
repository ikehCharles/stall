-- Fix: update_user needs SECURITY DEFINER to bypass RLS when admin updates another user's profile
-- Also combines two separate profile UPDATEs into one atomic statement

CREATE OR REPLACE FUNCTION update_user(
  p_user_id     uuid,
  p_full_name   text,
  p_phone       text,
  p_role_id     uuid,
  p_email       text,
  p_tags        text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_role_id uuid;
BEGIN
  -- Permission check: must have users.manage
  IF NOT has_permission(auth.uid(), 'users.manage') THEN
    RAISE EXCEPTION
      'Permission denied (%). Required: users.manage permission',
      auth.uid() USING ERRCODE = 'P4030';
  END IF;

  -- Check if role is being changed
  SELECT role_id INTO v_current_role_id
  FROM user_roles
  WHERE user_id = p_user_id;

  IF v_current_role_id IS DISTINCT FROM p_role_id THEN
    IF NOT has_permission(auth.uid(), 'roles.manage') THEN
      RAISE EXCEPTION
        'Permission denied (%). Required: roles.manage permission',
        auth.uid() USING ERRCODE = 'P4030';
    END IF;
  END IF;

  -- Update profile fields (no longer storing tags in meta)
  UPDATE profiles
  SET
    full_name    = p_full_name,
    phone_number = p_phone,
    email        = p_email
  WHERE id = p_user_id;

  -- Update role in user_roles
  UPDATE user_roles
  SET role_id = p_role_id
  WHERE user_id = p_user_id;

  -- Sync vendor_tags junction table (replace all)
  DELETE FROM vendor_tags WHERE user_id = p_user_id;

  IF array_length(p_tags, 1) > 0 THEN
    INSERT INTO vendor_tags (user_id, tag_id)
    SELECT p_user_id, unnest(p_tags::uuid[])
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
