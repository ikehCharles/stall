ALTER TABLE public.kyc_audit_log
ADD CONSTRAINT kyc_audit_log_reviewed_by_profiles_fkey
FOREIGN KEY (reviewed_by)
REFERENCES public.profiles(id);


alter policy "Users can update own pending KYC"
on "public"."kyc_applications"
to public
using  ((user_id = auth.uid()) AND ((status = 'PENDING'::kyc_status) OR (status = 'REJECTED'::kyc_status)) AND has_permission(auth.uid(), 'kyc.create.self'::text))