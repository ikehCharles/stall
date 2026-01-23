/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from '@/integrations/supabase/client';
import { Database } from "@/integrations/supabase/types";


export type KYCAuditHistory = Database['public']['Tables']['kyc_audit_log']['Row'] & {
    profiles: any;
}

export const useKYCAuditHistory = (kycId: string) => {
    return useQuery({
      queryKey: ['kyc-audit-history'],
      queryFn: async () => {
        const { data, error } = await supabase
        .from('kyc_audit_log')
        .select(`
          *,
          profiles (
            full_name
          )
        `)
        .eq('kyc_id', kycId)
        .order('created_at', { ascending: false })
        
        if (error) throw error;
        const auditData = data?.map((entry: KYCAuditHistory) => ({
            ...entry,
            reviewer_name: entry.profiles?.full_name || 'Unknown Admin'
          })) || [];
        return auditData;
      },
      enabled: !!kycId,
    });
  };

