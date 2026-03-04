-- Add last_login_at to profiles to track if a user has ever logged in
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz DEFAULT NULL;

-- Index for quick lookups (e.g. "users who never logged in")
CREATE INDEX IF NOT EXISTS idx_profiles_last_login_at
  ON public.profiles (last_login_at);
