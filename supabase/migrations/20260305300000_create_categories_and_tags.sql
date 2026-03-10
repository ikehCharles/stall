-- ============================================================
-- Migration: Categories & Tags system
-- One shared pool of categories and tags, managed via Stalls.
-- Categories  → stall_templates.category_id (base), stall_instances.category_id (override), kyc_applications.business_type_id
-- Tags        → stall_template_tags (base m2m), stall_instance_tags (override m2m), vendor_tags (vendor m2m)
-- ============================================================

-- ---------- 1. Categories table (flat, no type discriminator) ----------
CREATE TABLE IF NOT EXISTS public.categories (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT          NOT NULL,
  slug        TEXT          NOT NULL UNIQUE,
  description TEXT,
  color       TEXT,                       -- optional hex colour for UI badges
  icon        TEXT,                       -- optional icon name (e.g. Lucide icon)
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order  INTEGER       NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TRIGGER set_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 2. Tags table (flat, shared pool) ----------
CREATE TABLE IF NOT EXISTS public.tags (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT          NOT NULL UNIQUE,
  slug        TEXT          NOT NULL UNIQUE,
  color       TEXT,                       -- optional hex colour for UI badges
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order  INTEGER       NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TRIGGER set_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 3. Stall ↔ Category ----------
-- Base category on template (default for all instances of this template)
ALTER TABLE public.stall_templates
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stall_templates_category
  ON public.stall_templates(category_id);

-- Instance-level override (takes priority over template when set)
ALTER TABLE public.stall_instances
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stall_instances_category
  ON public.stall_instances(category_id);

-- ---------- 4. KYC ↔ Category as business type ----------
-- KYC picks from the same categories list created by admins under Stalls
ALTER TABLE public.kyc_applications
  ADD COLUMN IF NOT EXISTS business_type_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kyc_applications_business_type
  ON public.kyc_applications(business_type_id);

-- ---------- 5. Stall ↔ Tags (many-to-many join table) ----------
CREATE TABLE IF NOT EXISTS public.stall_template_tags (
  stall_template_id UUID NOT NULL REFERENCES public.stall_templates(id) ON DELETE CASCADE,
  tag_id            UUID NOT NULL REFERENCES public.tags(id)            ON DELETE CASCADE,
  PRIMARY KEY (stall_template_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_stall_template_tags_tag
  ON public.stall_template_tags(tag_id);

-- ---------- 5b. Stall Instance ↔ Tags (instance-level override, same pattern as category) ----------
CREATE TABLE IF NOT EXISTS public.stall_instance_tags (
  stall_instance_id UUID NOT NULL REFERENCES public.stall_instances(id) ON DELETE CASCADE,
  tag_id            UUID NOT NULL REFERENCES public.tags(id)            ON DELETE CASCADE,
  PRIMARY KEY (stall_instance_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_stall_instance_tags_tag
  ON public.stall_instance_tags(tag_id);

-- ---------- 6. Vendor ↔ Tags (many-to-many, mirrors category → KYC pattern) ----------
CREATE TABLE IF NOT EXISTS public.vendor_tags (
  user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tag_id   UUID NOT NULL REFERENCES public.tags(id)     ON DELETE CASCADE,
  PRIMARY KEY (user_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_tags_tag
  ON public.vendor_tags(tag_id);

-- ---------- 7. Seed default categories ----------
INSERT INTO public.categories (name, slug, sort_order) VALUES
  ('Food & Beverage', 'food-beverage', 1),
  ('Retail',          'retail',        2),
  ('Arts & Crafts',   'arts-crafts',   3),
  ('Services',        'services',      4),
  ('Other',           'other',         5)
ON CONFLICT (slug) DO NOTHING;

-- ---------- 9. RLS – categories (read-public, write via stalls.manage) ----------
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT
  USING (TRUE);

CREATE POLICY "Users with stalls.manage can insert categories"
  ON public.categories FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'stalls.manage'));

CREATE POLICY "Users with stalls.manage can update categories"
  ON public.categories FOR UPDATE
  USING (has_permission(auth.uid(), 'stalls.manage'));

CREATE POLICY "Users with stalls.manage can delete categories"
  ON public.categories FOR DELETE
  USING (has_permission(auth.uid(), 'stalls.manage'));

-- ---------- 10. RLS – tags (read-public, write via stalls.manage) ----------
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tags"
  ON public.tags FOR SELECT
  USING (TRUE);

CREATE POLICY "Users with stalls.manage can insert tags"
  ON public.tags FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'stalls.manage'));

CREATE POLICY "Users with stalls.manage can update tags"
  ON public.tags FOR UPDATE
  USING (has_permission(auth.uid(), 'stalls.manage'));

CREATE POLICY "Users with stalls.manage can delete tags"
  ON public.tags FOR DELETE
  USING (has_permission(auth.uid(), 'stalls.manage'));

-- ---------- 11. RLS – stall_template_tags ----------
ALTER TABLE public.stall_template_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with stalls.manage can manage stall template tags"
  ON public.stall_template_tags FOR ALL
  USING (has_permission(auth.uid(), 'stalls.manage'));

CREATE POLICY "Anyone can view stall template tags"
  ON public.stall_template_tags FOR SELECT
  USING (TRUE);

-- ---------- 11b. RLS – stall_instance_tags ----------
ALTER TABLE public.stall_instance_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with stalls.manage can manage stall instance tags"
  ON public.stall_instance_tags FOR ALL
  USING (has_permission(auth.uid(), 'stalls.manage'));

CREATE POLICY "Anyone can view stall instance tags"
  ON public.stall_instance_tags FOR SELECT
  USING (TRUE);

-- ---------- 11c. RLS – vendor_tags ----------
ALTER TABLE public.vendor_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with users.manage can manage vendor tags"
  ON public.vendor_tags FOR ALL
  USING (has_permission(auth.uid(), 'users.manage'));

CREATE POLICY "Vendors can view their own tags"
  ON public.vendor_tags FOR SELECT
  USING (auth.uid() = user_id);

-- ---------- 12. Migrate existing business_type text → business_type_id ----------
UPDATE public.kyc_applications ka
SET business_type_id = c.id
FROM public.categories c
WHERE ka.business_type IS NOT NULL
  AND ka.business_type_id IS NULL
  AND (
    (ka.business_type = 'retail'        AND c.slug = 'retail')       OR
    (ka.business_type = 'food_beverage' AND c.slug = 'food-beverage') OR
    (ka.business_type = 'services'      AND c.slug = 'services')     OR
    (ka.business_type = 'crafts'        AND c.slug = 'arts-crafts')  OR
    (ka.business_type = 'other'         AND c.slug = 'other')
  );
