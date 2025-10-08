-- Security Fix: Restrict email_verifications table access to authenticated users only
-- This prevents unauthorized access to sensitive email addresses and OTP codes

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own verifications" ON public.email_verifications;
DROP POLICY IF EXISTS "Users can view own verifications" ON public.email_verifications;

-- Create restrictive policies that explicitly require authentication
-- Users can only view their own email verifications when authenticated
CREATE POLICY "Authenticated users can view own verifications"
ON public.email_verifications
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

-- Users can only insert their own email verifications when authenticated
CREATE POLICY "Authenticated users can insert own verifications"
ON public.email_verifications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

-- Explicitly deny all UPDATE operations (verification codes should never be updated)
-- No policy created = default deny

-- Explicitly deny all DELETE operations (keep audit trail)
-- No policy created = default deny

-- Add comment for documentation
COMMENT ON TABLE public.email_verifications IS 
'Contains sensitive email verification data. RLS policies ensure only authenticated users can access their own verification records. No UPDATE or DELETE policies to prevent tampering with verification codes.';