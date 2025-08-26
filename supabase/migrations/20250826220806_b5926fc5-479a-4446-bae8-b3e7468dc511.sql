-- Create audit log table for KYC status changes
CREATE TABLE public.kyc_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kyc_id UUID NOT NULL REFERENCES public.kyc_applications(id) ON DELETE CASCADE,
  from_status kyc_status,
  to_status kyc_status NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.kyc_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view all audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.kyc_audit_log
FOR SELECT
USING (get_user_role(auth.uid()) = 'admin'::app_role);

-- Create policy for admins to insert audit logs
CREATE POLICY "Admins can insert audit logs"
ON public.kyc_audit_log
FOR INSERT
WITH CHECK (get_user_role(auth.uid()) = 'admin'::app_role);

-- Add indexes for better performance
CREATE INDEX idx_kyc_applications_status ON public.kyc_applications(status);
CREATE INDEX idx_kyc_applications_submitted_at ON public.kyc_applications(submitted_at DESC);
CREATE INDEX idx_kyc_applications_user_id ON public.kyc_applications(user_id);
CREATE INDEX idx_kyc_audit_log_kyc_id ON public.kyc_audit_log(kyc_id);
CREATE INDEX idx_kyc_audit_log_created_at ON public.kyc_audit_log(created_at DESC);