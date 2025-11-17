import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BookingWithStalls } from "./useBookings";
import { INTENT } from "@/lib/enums";

export const useAdminBookings = () => {
  return useQuery({
    queryKey: ["admin-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          booking_stalls (
            *,
            stall_instances (
              id,
              label,
              x,
              y,
              width,
              height,
              stall_templates (
                id,
                name,
                price,
                shape,
                width,
                height
              )
            )
          ),
          markets (
            id,
            name,
            start_at,
            end_at,
            theme
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as BookingWithStalls[];
    },
  });
};

export const useAdminToggleAuthorizedBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (param: { bookingId: string; intent: INTENT }) => {
      const { data, error } = await supabase.functions.invoke(
        "manage-authorized-paypal-order",
        {
          body: {
            action: param.intent,
            bookingId: param.bookingId,
          },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      toast({
        title: res.message,
        // description: res.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle booking.",
        variant: "destructive",
      });
    },
  });
};

export const useAdminToggleBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: { bookingId: string; intent: INTENT }) => {
      let data, error;
      if (payload.intent === INTENT.REFUND) {
        ({ data, error } = await supabase.functions.invoke(
          "refund-paypal-order",
          {
            body: {
              bookingId: payload.bookingId,
            },
          }
        ));
      } else if (payload.intent === INTENT.VOID) {
        ({ data, error } = await supabase.rpc("admin_decline_booking", {
          p_booking_id: payload.bookingId,
        }));
      } else {
        ({ data, error } = await supabase.rpc("admin_approve_booking", {
          p_booking_id: payload.bookingId,
        }));
      }
      if (error) throw error;
      return data;
    },
    onSuccess: (res: { message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      toast({
        title: res.message,
        // description: res.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to decline booking.",
        variant: "destructive",
      });
    },
  });
};
