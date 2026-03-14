-- Clone market RPC: duplicates market config (stalls, positions, layout) without bookings
CREATE OR REPLACE FUNCTION public.clone_market(
  p_source_market_id uuid,
  p_name text,
  p_theme text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_banner_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_market_id uuid;
  v_user_id uuid;
  v_source_layout record;
  v_stall record;
  v_new_stall_id uuid;
  v_tag_id uuid;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify source market exists
  IF NOT EXISTS (SELECT 1 FROM markets WHERE id = p_source_market_id) THEN
    RAISE EXCEPTION 'Source market not found';
  END IF;

  -- 1. Create new market as DRAFT
  INSERT INTO markets (name, theme, banner_url, start_at, end_at, status, created_by)
  VALUES (p_name, p_theme, p_banner_url, p_start_at, p_end_at, 'DRAFT', v_user_id)
  RETURNING id INTO v_new_market_id;

  -- 2. Copy market layout (if exists)
  SELECT * INTO v_source_layout FROM market_layouts WHERE market_id = p_source_market_id;
  IF FOUND THEN
    INSERT INTO market_layouts (market_id, canvas_width, canvas_height, unit, grid_size)
    VALUES (v_new_market_id, v_source_layout.canvas_width, v_source_layout.canvas_height,
            v_source_layout.unit, v_source_layout.grid_size);
  END IF;

  -- 3. Copy stall instances with positions (no bookings)
  FOR v_stall IN
    SELECT * FROM stall_instances WHERE market_id = p_source_market_id
  LOOP
    INSERT INTO stall_instances (
      market_id, template_id, label, x, y, width, height, rotation,
      price_override, status, category_id, category_overridden, tags_overridden
    )
    VALUES (
      v_new_market_id, v_stall.template_id, v_stall.label,
      v_stall.x, v_stall.y, v_stall.width, v_stall.height, v_stall.rotation,
      v_stall.price_override, 'AVAILABLE', v_stall.category_id,
      v_stall.category_overridden, v_stall.tags_overridden
    )
    RETURNING id INTO v_new_stall_id;

    -- 4. Copy stall instance tags
    FOR v_tag_id IN
      SELECT tag_id FROM stall_instance_tags WHERE stall_instance_id = v_stall.id
    LOOP
      INSERT INTO stall_instance_tags (stall_instance_id, tag_id)
      VALUES (v_new_stall_id, v_tag_id);
    END LOOP;
  END LOOP;

  RETURN v_new_market_id;
END;
$$;

-- Grant execute to authenticated users (RLS on markets table handles permission checks)
GRANT EXECUTE ON FUNCTION public.clone_market(uuid, text, text, timestamptz, timestamptz, text) TO authenticated;
