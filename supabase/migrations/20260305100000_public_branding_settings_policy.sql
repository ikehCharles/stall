-- Allow unauthenticated (anon) users to read branding settings (app_name, app_logo_url)
-- so the login page can display the configured app name and logo.
CREATE POLICY "Public can read branding settings"
  ON public.settings FOR SELECT
  USING (
    source = 'platform'
    AND key IN ('app_name', 'app_logo_url', 'app_slogan')
  );

-- Public storage bucket for app branding assets (logo)
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-branding', 'app-branding', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read branding assets (public bucket)
CREATE POLICY "Public can read branding assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'app-branding');

-- Authenticated users with settings.manage can upload/update branding assets
CREATE POLICY "Admins can manage branding assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'app-branding'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Admins can update branding assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'app-branding'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Admins can delete branding assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'app-branding'
    AND auth.role() = 'authenticated'
  );
