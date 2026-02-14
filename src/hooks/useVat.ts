import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VatPeriod = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  closed_at: string | null;
  closed_by: string | null;
  total_vat_collected: number;
  total_vat_outstanding: number;
  total_vat_due: number;
  created_at: string;
  updated_at: string;
};

export type VatLedgerEntry = {
  id: string;
  booking_id: string;
  vendor_id: string;
  invoice_number: string;
  vat_amount: number;
  net_amount: number;
  gross_amount: number;
  vat_rate: number;
  vat_mode: string;
  period_id: string | null;
  status: string;
  refund_of: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  vendor?: {
    full_name: string | null;
    email: string;
    company_name: string | null;
  };
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export const useVatPeriods = () => {
  return useQuery({
    queryKey: ["vat-periods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vat_periods")
        .select("*")
        .order("start_date", { ascending: false });

      if (error) throw error;
      return data as VatPeriod[];
    },
  });
};

export const useVatLedgerByPeriod = (periodId: string | null) => {
  return useQuery({
    queryKey: ["vat-ledger", periodId],
    queryFn: async () => {
      if (!periodId) return [];

      const { data, error } = await supabase
        .from("vat_ledger")
        .select(`
          *,
          vendor:profiles!vat_ledger_vendor_id_fkey(full_name, email, company_name)
        `)
        .eq("period_id", periodId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as VatLedgerEntry[];
    },
    enabled: !!periodId,
  });
};

// ─── Mutations ───────────────────────────────────────────────────────────────

export const useCreateVatPeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      startDate,
      endDate,
    }: {
      name: string;
      startDate: string;
      endDate?: string;
    }) => {
      const { data, error } = await supabase.rpc("create_vat_period", {
        p_name: name,
        p_start_date: startDate,
        ...(endDate ? { p_end_date: endDate } : {}),
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vat-periods"] });
    },
  });
};

export const useReconcileVatPeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (periodId: string) => {
      const { data, error } = await supabase.rpc("reconcile_vat_period", {
        p_period_id: periodId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vat-periods"] });
      queryClient.invalidateQueries({ queryKey: ["vat-ledger"] });
    },
  });
};

export const useUpdateVatPeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      periodId,
      name,
      endDate,
    }: {
      periodId: string;
      name: string;
      endDate?: string;
    }) => {
      const { data, error } = await supabase.rpc("update_vat_period", {
        p_period_id: periodId,
        p_name: name,
        ...(endDate ? { p_end_date: endDate } : {}),
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vat-periods"] });
    },
  });
};

export const useDeleteVatPeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (periodId: string) => {
      const { data, error } = await supabase.rpc("delete_vat_period", {
        p_period_id: periodId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vat-periods"] });
    },
  });
};

export const useVatLedgerCount = (periodId: string | null) => {
  return useQuery({
    queryKey: ["vat-ledger-count", periodId],
    queryFn: async () => {
      if (!periodId) return 0;
      const { count, error } = await supabase
        .from("vat_ledger")
        .select("*", { count: "exact", head: true })
        .eq("period_id", periodId);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!periodId,
  });
};

