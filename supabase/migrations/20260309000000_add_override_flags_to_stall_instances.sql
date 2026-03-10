-- ============================================================
-- Add override flags to stall_instances
-- ============================================================
-- These booleans track whether category / tags were explicitly
-- set at the instance level. When TRUE, the instance value is
-- used as-is (even if NULL / empty). When FALSE (default), the
-- system falls back to the template default.
-- ============================================================

ALTER TABLE public.stall_instances
  ADD COLUMN IF NOT EXISTS category_overridden BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.stall_instances
  ADD COLUMN IF NOT EXISTS tags_overridden BOOLEAN NOT NULL DEFAULT FALSE;

-- Back-fill: any instance that already has a non-null category_id was explicitly set
UPDATE public.stall_instances
SET category_overridden = TRUE
WHERE category_id IS NOT NULL;

-- Back-fill: any instance that already has rows in stall_instance_tags was explicitly set
UPDATE public.stall_instances si
SET tags_overridden = TRUE
WHERE EXISTS (
  SELECT 1 FROM public.stall_instance_tags sit
  WHERE sit.stall_instance_id = si.id
);
