-- Enable RLS on payment_sync
ALTER TABLE public.payment_sync ENABLE ROW LEVEL SECURITY;

-- service_role: full CRU access (edge functions use service_role key)
CREATE POLICY "service_role_all_payment_sync"
  ON public.payment_sync
  TO service_role
  USING (true)
  WITH CHECK (true);

-- authenticated: CRU restricted to users with payments.manage permission
CREATE POLICY "authenticated_select_payment_sync"
  ON public.payment_sync
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), 'payments.manage'));

CREATE POLICY "authenticated_insert_payment_sync"
  ON public.payment_sync
  FOR INSERT
  TO authenticated
  WITH CHECK (has_permission(auth.uid(), 'payments.manage'));

CREATE POLICY "authenticated_update_payment_sync"
  ON public.payment_sync
  FOR UPDATE
  TO authenticated
  USING (has_permission(auth.uid(), 'payments.manage'))
  WITH CHECK (has_permission(auth.uid(), 'payments.manage'));
