import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CashDenominations {
  "50"?: number;
  "20"?: number;
  "10"?: number;
  "5"?: number;
  "2"?: number;
  "1"?: number;
  "0.50"?: number;
  "0.20"?: number;
  "0.10"?: number;
  "0.05"?: number;
  "0.02"?: number;
  "0.01"?: number;
}

export interface RecordCashPaymentData {
  bookingId: string;
  amount: number;
  collectedBy: string;
  denominations?: CashDenominations | null;
  notes?: string;
}

export interface CashPaymentRecord {
  id: string;
  booking_id: string;
  amount: number;
  denominations: CashDenominations | null;
  collected_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  collector_name?: string;
  collector_email?: string;
  invoice_number?: string;
  market_name?: string;
  vendor_name?: string;
  booking_total?: number;
}

// Record a cash payment for a booking
export const useRecordCashPayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: RecordCashPaymentData) => {
      const { data: result, error } = await supabase.rpc(
        "record_cash_payment",
        {
          p_booking_id: data.bookingId,
          p_amount: data.amount,
          p_collected_by: data.collectedBy,
          p_denominations: data.denominations
            ? (JSON.parse(JSON.stringify(data.denominations)) as Record<string, never>)
            : undefined,
          p_notes: data.notes || undefined,
        }
      );

      if (error) throw error;
      return result as string; // cash_payment_id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["cash-payments"] });
      queryClient.invalidateQueries({ queryKey: ["cash-reconciliation"] });
      toast({
        title: "Cash Payment Recorded",
        description: "The cash payment has been successfully recorded and the invoice updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Payment Error",
        description: error.message || "Failed to record cash payment.",
        variant: "destructive",
      });
    },
  });
};

// Fetch cash payments for reconciliation (admin view)
export const useCashPaymentsReconciliation = (filters?: {
  dateFrom?: string;
  dateTo?: string;
  collectedBy?: string;
}) => {
  return useQuery({
    queryKey: ["cash-reconciliation", filters],
    queryFn: async () => {
      // Step 1: Fetch cash payments with booking info
      let query = supabase
        .from("cash_payments")
        .select(
          `
          *,
          bookings:booking_id (
            invoice_number,
            total_amount,
            gross_amount,
            paid_amount,
            user_id,
            markets ( name )
          )
        `
        )
        .order("created_at", { ascending: false });

      if (filters?.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("created_at", filters.dateTo);
      }
      if (filters?.collectedBy) {
        query = query.eq("collected_by", filters.collectedBy);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Step 2: Fetch profiles for collectors and vendors
      const collectorIds = [
        ...new Set(data.map((r: Record<string, unknown>) => r.collected_by as string)),
      ];
      const vendorIds = [
        ...new Set(
          data
            .map((r: Record<string, unknown>) => {
              const booking = r.bookings as Record<string, unknown> | null;
              return booking?.user_id as string | undefined;
            })
            .filter(Boolean) as string[]
        ),
      ];
      const allProfileIds = [...new Set([...collectorIds, ...vendorIds])];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", allProfileIds);

      const profileMap = new Map(
        (profiles || []).map((p: { id: string; full_name: string | null; email: string }) => [
          p.id,
          p,
        ])
      );

      // Step 3: Transform to flat records
      return data.map((row: Record<string, unknown>) => {
        const booking = row.bookings as Record<string, unknown> | null;
        const markets = booking?.markets as Record<string, unknown> | null;
        const collectorProfile = profileMap.get(row.collected_by as string);
        const vendorProfile = booking?.user_id
          ? profileMap.get(booking.user_id as string)
          : null;

        return {
          id: row.id as string,
          booking_id: row.booking_id as string,
          amount: row.amount as number,
          denominations: row.denominations as CashDenominations | null,
          collected_by: row.collected_by as string,
          notes: row.notes as string | null,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
          collector_name: (collectorProfile?.full_name as string) || "N/A",
          collector_email: (collectorProfile?.email as string) || "N/A",
          invoice_number: (booking?.invoice_number as string) || "N/A",
          market_name: (markets?.name as string) || "N/A",
          vendor_name: (vendorProfile?.full_name as string) || "N/A",
          booking_total: (booking?.gross_amount as number) ?? (booking?.total_amount as number) ?? 0,
        } satisfies CashPaymentRecord;
      });
    },
  });
};
