-- ============================================================
-- Tighten overly-permissive RLS policies
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. cash_payments
--    Old: SELECT USING(true) + INSERT WITH CHECK(true)
--    Fix: scope SELECT to own bookings or payments.manage;
--         scope INSERT to bookings.manage (FCA/admin collectors only)
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read cash payments" ON public.cash_payments;
DROP POLICY IF EXISTS "FCA users can insert cash payments" ON public.cash_payments;

-- Vendors can view cash payments for their own bookings
CREATE POLICY "Users can view own cash payments"
  ON public.cash_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = cash_payments.booking_id
        AND bookings.user_id = auth.uid()
    )
  );

-- Admins / FCA staff with payments.manage can view all cash payments
CREATE POLICY "Users with payments.manage can view all cash payments"
  ON public.cash_payments FOR SELECT
  USING (has_permission(auth.uid(), 'payments.manage'));

-- Only FCA / admin staff with bookings.manage permission can record cash payments
CREATE POLICY "Users with bookings.manage can insert cash payments"
  ON public.cash_payments FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'bookings.manage'));

-- ──────────────────────────────────────────────────────────────
-- 2. audit_log
--    Old: any authenticated user can insert with WITH CHECK(true)
--    Fix: drop the policy entirely — all inserts must go through
--         log_audit_entry() which is SECURITY DEFINER and bypasses
--         RLS, so legitimate inserts are unaffected
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_log;
