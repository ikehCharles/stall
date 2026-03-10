import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { PostgrestError } from "@supabase/supabase-js";

export interface VendorLookupResult {
  user_id: string;
  email: string;
  full_name: string;
  phone_number: string;
  company_name: string;
  kyc_status: "APPROVED" | "PENDING" | "REJECTED" | "NONE";
  kyc_id: string;
  has_unpaid_bookings: boolean;
}

export interface Profile {
  email: string;
  kyc_id: string;
  user_id: string;
  full_name: string;
  kyc_status: Database['public']['Tables']['kyc_applications']['Row']['status']
  company_name: string | null;
  phone_number: string;
  kyc_contact_email: string;
  last_login_at: string | null;
  business_type_id: string | null;
  vendor_tag_ids: string[];
}

interface Booking {
  id: string;
  status: "completed" | "approved" | "pending" | string;
  market_id: string;
  created_at: string;
  days_count: number;
  paid_amount: number;
  total_amount: number;
  gross_amount: number | null;
  invoice_number: string;
  payment_status: "success" | null;
  selected_dates: string[];
  hold_expires_at: string | null;
}

export interface UserBookingsResponse {
  profile: Profile;
  bookings: Booking[];
}

// Optional: if you want to export it

export type UnpaidInvoice =
  Database["public"]["Functions"]["get_unpaid_invoice_for_stall"]["Returns"][0];

export const useVendorLookup = () => {
  return useMutation({
    mutationFn: async (email: string): Promise<VendorLookupResult | null> => {
      const { data, error } = await supabase.rpc("lookup_vendor_by_email", {
        p_email: email.trim(),
      });

      if (error) throw error;
      if (!data?.[0]) return null;

      // Cast kyc_status to the expected type
      const result = data[0];
      return {
        ...result,
        kyc_status: result.kyc_status as VendorLookupResult["kyc_status"],
      };
    },
  });
};

export const useVendorLookupInMarket = () => {
  return useMutation<
    UserBookingsResponse | null,
    PostgrestError,
    {
      email: string;
      marketId: string;
    }
  >({
    mutationFn: async (param: {
      email: string;
      marketId: string;
    }): Promise<UserBookingsResponse | null> => {
      const { data, error } = await supabase.rpc("lookup_vendor_in_market", {
        p_email: param.email.trim(),
        p_market_id: param.marketId,
      });

      if (error) throw error;

      // Cast kyc_status to the expected type
      return data as unknown as UserBookingsResponse;
    },
  });
};

export const useUnpaidInvoice = () => {
  return useMutation({
    mutationFn: async ({
      stallId,
      vendorId,
    }: {
      stallId: string;
      vendorId: string;
    }) => {
      const { data, error } = await supabase.rpc(
        "get_unpaid_invoice_for_stall",
        {
          p_stall_id: stallId,
          p_vendor_id: vendorId,
        }
      );

      if (error) throw error;
      return data?.[0] || null;
    },
  });
};
