import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KYCAuditEntry {
  id: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  created_at: string;
  reviewer_name: string;
}

/**
 * Fetch KYC-related audit entries from the unified audit_log table.
 * Filters by table_name = 'kyc_applications' and record_id = kycId.
 */
export const useKYCAuditHistory = (kycId: string | undefined) => {
  return useQuery({
    queryKey: ["kyc-audit-history", kycId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("table_name", "kyc_applications")
        .eq("record_id", kycId!)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Resolve performer names
      const performerIds = (data ?? [])
        .map((e) => e.performed_by)
        .filter(Boolean) as string[];

      let profileMap = new Map<string, string>();
      if (performerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", [...new Set(performerIds)]);
        profileMap = new Map(
          profiles?.map((p) => [p.id, p.full_name]) || []
        );
      }

      return (data ?? []).map((entry): KYCAuditEntry => ({
        id: entry.id,
        from_status: entry.from_status,
        to_status: entry.to_status,
        reason: entry.reason,
        created_at: entry.created_at,
        reviewer_name: entry.performed_by
          ? profileMap.get(entry.performed_by) || "Unknown Admin"
          : "System",
      }));
    },
    enabled: !!kycId,
  });
};

