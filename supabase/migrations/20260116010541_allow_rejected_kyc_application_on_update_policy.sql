ALTER TABLE public.kyc_applications
ADD CONSTRAINT kyc_applications_reviewed_by_profiles_fkey
FOREIGN KEY (reviewed_by)
REFERENCES public.profiles(id);


alter policy "Users can update own pending KYC"
on "public"."kyc_applications"
to public
using  ((user_id = auth.uid()) AND ((status = 'PENDING'::kyc_status) OR (status = 'REJECTED'::kyc_status)) AND has_permission(auth.uid(), 'kyc.create.self'::text));


ALTER TABLE public.kyc_audit_log
ADD COLUMN user_id uuid;

ALTER TABLE public.kyc_audit_log
ADD CONSTRAINT kyc_audit_log_user_id_profiles_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

CREATE POLICY "Users can read their own KYC audit logs"
ON public.kyc_audit_log
FOR SELECT
USING (user_id = auth.uid());