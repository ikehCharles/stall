-- ============================================================
-- Drop kyc_audit_log table — consolidated into audit_log
-- ============================================================
-- All KYC approval/rejection actions now go through log_audit_entry()
-- into the unified audit_log table with table_name = 'kyc_applications'.
-- ============================================================

DROP TABLE IF EXISTS public.kyc_audit_log CASCADE;
