import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

export type KYCApplication = Database['public']['Tables']['kyc_applications']['Row']

interface DateRange {
  start: Date;
  end: Date;
}

export const useKYCAnalytics = (dateRange?: DateRange) => {
  return useQuery({
    queryKey: ['kyc-analytics', dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('kyc_applications')
        .select('status, created_at');

      if (dateRange?.start) {
        query = query.gte('created_at', dateRange.start.toISOString());
      }
      if (dateRange?.end) {
        query = query.lte('created_at', dateRange.end.toISOString());
      }

      const { data: applications, error } = await query;

      if (error) {
        throw error;
      }

      const total = applications?.length || 0;
      const pending = applications?.filter(a => a.status === 'PENDING').length || 0;
      const approved = applications?.filter(a => a.status === 'APPROVED').length || 0;
      const rejected = applications?.filter(a => a.status === 'REJECTED').length || 0;
      
      const approvalRate = total > 0 ? ((approved / total) * 100).toFixed(1) : '0.0';

      return { total, pending, approved, rejected, approvalRate };
    },
    staleTime: 30000,
  });
};
