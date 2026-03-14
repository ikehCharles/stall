import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  performed_by: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  performer?: {
    full_name: string;
  };
}

/** Helper: resolve performer names for a set of audit entries */
async function resolvePerformers(
  entries: AuditLogEntry[]
): Promise<AuditLogEntry[]> {
  const performerIds = entries
    .map((e) => e.performed_by)
    .filter(Boolean) as string[];

  if (performerIds.length === 0) return entries;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", [...new Set(performerIds)]);

  const profileMap = new Map(
    profiles?.map((p) => [p.id, p.full_name]) || []
  );

  return entries.map((entry) => ({
    ...entry,
    performer: entry.performed_by
      ? { full_name: profileMap.get(entry.performed_by) || "Unknown" }
      : undefined,
  }));
}

/**
 * Fetch audit log entries for a specific record (e.g. a booking).
 */
export const useAuditLog = (tableName: string, recordId: string | undefined) => {
  return useQuery({
    queryKey: ["audit-log", tableName, recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("table_name", tableName)
        .eq("record_id", recordId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return resolvePerformers(data as AuditLogEntry[]);
    },
    enabled: !!recordId && !!tableName,
  });
};

/**
 * Fetch all recent audit log entries (for activity feed / dashboard).
 */
export const useRecentAuditLog = (limit: number = 20) => {
  return useQuery({
    queryKey: ["audit-log-recent", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return resolvePerformers(data as AuditLogEntry[]);
    },
  });
};

// ── Filters for the full Audit Log reporting page ──

export interface AuditLogFilters {
  search: string;
  action: string;
  tableName: string;
  dateFrom: string;
  dateTo: string;
}

/**
 * Fetch paginated audit log with server-side filtering.
 * Returns { entries, totalCount } so the UI can render pagination.
 */
export const useAllAuditLog = (
  filters: AuditLogFilters,
  page: number = 1,
  pageSize: number = 25
) => {
  return useQuery({
    queryKey: ["audit-log-all", filters, page, pageSize],
    queryFn: async () => {
      // ── Count query (for pagination) ──
      let countQuery = supabase
        .from("audit_log")
        .select("id", { count: "exact", head: true });

      // ── Data query ──
      let dataQuery = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Apply filters to both queries
      if (filters.action && filters.action !== "all") {
        countQuery = countQuery.eq("action", filters.action);
        dataQuery = dataQuery.eq("action", filters.action);
      }
      if (filters.tableName && filters.tableName !== "all") {
        countQuery = countQuery.eq("table_name", filters.tableName);
        dataQuery = dataQuery.eq("table_name", filters.tableName);
      }
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom).toISOString();
        countQuery = countQuery.gte("created_at", from);
        dataQuery = dataQuery.gte("created_at", from);
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo + "T23:59:59").toISOString();
        countQuery = countQuery.lte("created_at", to);
        dataQuery = dataQuery.lte("created_at", to);
      }
      if (filters.search) {
        // Split on whitespace and join with % so "kyc appro" matches "kyc_approval"
        const term = `%${filters.search.trim().split(/\s+/).join("%")}%`;
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isUuid = uuidRegex.test(filters.search.trim());
        const orFilter = isUuid
          ? `action.ilike.${term},reason.ilike.${term},table_name.ilike.${term},record_id.eq.${filters.search.trim()}`
          : `action.ilike.${term},reason.ilike.${term},table_name.ilike.${term}`;
        countQuery = countQuery.or(orFilter);
        dataQuery = dataQuery.or(orFilter);
      }

      const [{ count, error: countError }, { data, error: dataError }] =
        await Promise.all([countQuery, dataQuery]);

      if (countError) throw countError;
      if (dataError) throw dataError;

      const entries = await resolvePerformers(data as AuditLogEntry[]);
      return { entries, totalCount: count ?? 0 };
    },
  });
};

/**
 * Fetch distinct action values for the filter dropdown.
 */
export const useAuditLogActions = () => {
  return useQuery({
    queryKey: ["audit-log-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("action")
        .order("action");

      if (error) throw error;
      const unique = [...new Set(data?.map((r) => r.action) || [])];
      return unique;
    },
    staleTime: 60_000,
  });
};
