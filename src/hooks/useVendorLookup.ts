import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VendorLookupResult {
  user_id: string;
  email: string;
  full_name: string;
  phone_number: string;
  company_name: string;
  kyc_status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'NONE';
  kyc_id: string;
  has_unpaid_bookings: boolean;
}

export const useVendorLookup = () => {
  return useMutation({
    mutationFn: async (email: string): Promise<VendorLookupResult | null> => {
      const { data, error } = await supabase.rpc('lookup_vendor_by_email', {
        p_email: email.trim()
      });
      
      if (error) throw error;
      if (!data?.[0]) return null;
      
      // Cast kyc_status to the expected type
      const result = data[0];
      return {
        ...result,
        kyc_status: result.kyc_status as VendorLookupResult['kyc_status']
      };
    }
  });
};

export const useUnpaidInvoice = () => {
  return useMutation({
    mutationFn: async ({ 
      stallId, 
      vendorId 
    }: { 
      stallId: string; 
      vendorId: string;
    }) => {
      const { data, error } = await supabase.rpc('get_unpaid_invoice_for_stall', {
        p_stall_id: stallId,
        p_vendor_id: vendorId
      });
      
      if (error) throw error;
      return data?.[0] || null;
    }
  });
};
