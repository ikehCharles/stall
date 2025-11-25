import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

export type KYCApplication = Database['public']['Tables']['kyc_applications']['Row']

export const useKYCAnalytics = () => {
  return useQuery({
    queryKey: ['kyc-analytics'],
    queryFn: async () => {
      const { data: applications, error } = await supabase
        .from('kyc_applications')
        .select('status');

      if (error) {
        console.error('Error fetching KYC applications:', error);
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
