-- Create storage bucket for template assets (images, etc.)
INSERT INTO storage.buckets (id, name, public) VALUES ('template-assets', 'template-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Admins with notifications.manage permission can upload
CREATE POLICY "Admins can upload template assets" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'template-assets' AND
        public.has_permission(auth.uid(), 'notifications.manage')
    );

-- Admins with notifications.manage permission can update
CREATE POLICY "Admins can update template assets" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'template-assets' AND
        public.has_permission(auth.uid(), 'notifications.manage')
    );

-- Admins with notifications.manage permission can delete
CREATE POLICY "Admins can delete template assets" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'template-assets' AND
        public.has_permission(auth.uid(), 'notifications.manage')
    );

-- Anyone can view template assets (needed for email rendering)
CREATE POLICY "Public can view template assets" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'template-assets'
    );
