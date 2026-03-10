-- Originally added meta jsonb column to profiles, now removed.
-- The vendor tags are stored in the vendor_tags junction table.
-- This migration now only recreates get_profiles_with_roles and update_user.

CREATE OR REPLACE FUNCTION get_profiles_with_roles(
  p_page       int DEFAULT 1,
  p_page_size  int DEFAULT 10,
  p_search     text DEFAULT '',
  p_role_id    uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_offset int := (p_page - 1) * p_page_size;
  v_total  int;
  v_users  json;
BEGIN
  -- Get total count
  SELECT COUNT(DISTINCT p.id)
  INTO v_total
  FROM profiles p
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  WHERE
    (p_search = '' OR p.full_name ILIKE '%' || p_search || '%' OR p.email ILIKE '%' || p_search || '%')
    AND (p_role_id IS NULL OR ur.role_id = p_role_id);

  -- Get paginated users
  SELECT json_agg(rows)
  INTO v_users
  FROM (
    SELECT
      p.id,
      p.email,
      p.full_name,
      p.phone_number,
      p.created_at,
      ur.role_id,
      r.key  AS role_key,
      r.name AS role_name
    FROM profiles p
    LEFT JOIN user_roles ur ON ur.user_id = p.id
    LEFT JOIN roles r       ON r.id = ur.role_id
    WHERE
      (p_search = '' OR p.full_name ILIKE '%' || p_search || '%' OR p.email ILIKE '%' || p_search || '%')
      AND (p_role_id IS NULL OR ur.role_id = p_role_id)
    ORDER BY p.created_at DESC
    LIMIT p_page_size OFFSET v_offset
  ) rows;

  RETURN json_build_object(
    'users', COALESCE(v_users, '[]'),
    'total', v_total
  );
END;
$$;

