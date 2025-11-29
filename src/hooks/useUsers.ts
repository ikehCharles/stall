import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { QueryKeysEnum } from "@/lib/enums";
import { toast } from "./use-toast";
import { useLoading } from "@/contexts/LoadingContext";

export interface UserPayload {
  email: string;
  fullName: string;
  phoneNumber: string;
  roleId?: string;
  confirmEmail: boolean;
  password: string;
}

export const useUsers = () => {
  const { startLoading, stopLoading } = useLoading();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UserPayload) => {
      startLoading();
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body,
      });

      if (error || data.success === false) throw data || error;
      return data;
    },
    onSuccess: () => {
      stopLoading();
      queryClient.invalidateQueries({
        queryKey: [QueryKeysEnum.userManagement],
      });
      toast({
        title: "User Invite Sent Successfully",
        // description: 'User can ',
        variant: "default",
      });
    },
    onError(error) {

      stopLoading();
      // Handle unique constraint violations
      if (
        error.message.includes("profiles_email_unique") ||
        (error.message.includes("duplicate") && error.message.includes("email"))
      ) {
        toast({
          title: "This email is already registered.",
          // description: 'User can ',
          variant: "destructive",
        });
      } else if (
        error.message.includes("profiles_phone_number_unique") ||
        (error.message.includes("duplicate") && error.message.includes("phone"))
      ) {
        toast({
          title: "This phone number is already registered.",
          // description: 'User can ',
          variant: "destructive",
        });
      } else {
        toast({
          title: "Registration failed: " + error.message,
          // description: 'User can ',
          variant: "destructive",
        });
      }
    },
  });
};


export function useUserProfile(userId?: string) {
  return useQuery({
    queryKey: ["user-profile", userId],
    enabled: !!userId, // only run when user exists

    queryFn: async () => {
      const [{ data: profile }, { data: roleData }, { data: kycData }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
          supabase.rpc("get_user_role_with_permissions", {
            user_uuid: userId,
          }),
          supabase
            .from("kyc_applications")
            .select("status")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

      const roleInfo = Array.isArray(roleData) ? roleData[0] : roleData;

      return {
        id: userId,
        email: profile?.email ?? "",
        full_name: profile?.full_name ?? null,
        phone_number: profile?.phone_number ?? null,
        company_name: profile?.company_name ?? null,
        address: profile?.address ?? null,
        business_logo_url: profile?.business_logo_url ?? null,
        role_key: roleInfo?.role_key ?? null,
        role_name: roleInfo?.role_name ?? null,
        permissions: roleInfo?.permissions ?? [],
        role:
          roleInfo?.role_key === "admin"
            ? "admin"
            : roleInfo?.role_key === "vendor"
            ? "vendor"
            : null,
        kyc_status: kycData?.status ?? null,
      };
    },
  });
}
