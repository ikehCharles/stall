-- Add unique constraints for email and phone number in profiles table
-- This will prevent duplicate registrations and enable proper error handling

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_unique UNIQUE (email);

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_phone_number_unique UNIQUE (phone_number);