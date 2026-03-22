-- Add terms_accepted_at column to profiles so we can track
-- whether a vendor has accepted the platform Terms & Conditions.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN public.profiles.terms_accepted_at IS
  'Timestamp when the user accepted the platform Terms & Conditions. NULL = not yet accepted.';
