-- Add missing fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN company_name TEXT,
ADD COLUMN address TEXT,
ADD COLUMN business_logo_url TEXT;

-- Create business logos storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('business-logos', 'business-logos', true);

-- Create RLS policies for business logos
CREATE POLICY "Users can view business logos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'business-logos');

CREATE POLICY "Users can upload their own business logo" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'business-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own business logo" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'business-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own business logo" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'business-logos' AND auth.uid()::text = (storage.foldername(name))[1]);