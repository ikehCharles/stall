-- Clean up duplicate phone numbers and emails, then add unique constraints
-- First, find and remove duplicates keeping the most recent record

-- Remove duplicate phone numbers (keep the most recent created_at)
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY phone_number ORDER BY created_at DESC) as rn
  FROM profiles
  WHERE phone_number IS NOT NULL
)
UPDATE profiles 
SET phone_number = NULL 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Remove duplicate emails (keep the most recent created_at)  
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
  FROM profiles
  WHERE email IS NOT NULL
)
DELETE FROM profiles 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_unique;
-- Now add unique constraints
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_unique UNIQUE (email);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_number_unique;
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_phone_number_unique UNIQUE (phone_number);