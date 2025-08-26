-- Add foreign key constraint from kyc_applications.user_id to profiles.id
ALTER TABLE kyc_applications 
ADD CONSTRAINT fk_kyc_applications_user_id 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add database indexes for performance
CREATE INDEX IF NOT EXISTS idx_kyc_applications_user_id ON kyc_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_applications_status ON kyc_applications(status);
CREATE INDEX IF NOT EXISTS idx_kyc_applications_submitted_at ON kyc_applications(submitted_at);