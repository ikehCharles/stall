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
              *,
              stall_templates (
                id,
                name,
                price,
                shape,
                width,
                height,
                fill_color,
                stroke_color,
                capacity
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

// ── Cancel booking (no refund – just sets status to cancelled) ──
export const useCancelBooking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      bookingId,
      reason,
    }: {
      bookingId: string;
      reason: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "decline-booking",
        { body: { bookingId, reason, action: "cancel" } }
      );
      if (error) throw error;
      if (data?.error) {
        throw new Error(data.error || data.message || "Failed to cancel booking");
      }
      return data as { status: string; message: string };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      toast({ title: res.message });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel booking.",
        variant: "destructive",
      });
    },
  });
};

// ── Request a refund (requires cancelled + paid) ──
export const useRequestRefund = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      bookingId,
      reason,
    }: {
      bookingId: string;
      reason: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "decline-booking",
        { body: { bookingId, reason, action: "request_refund" } }
      );
      if (error) throw error;
      if (data?.error) {
        throw new Error(data.error || data.message || "Failed to request refund");
      }
      return data as { status: string; message: string };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      toast({ title: res.message });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to request refund.",
        variant: "destructive",
      });
    },
  });
};

// ── Approve & execute the refund (processes provider refund) ──
export const useApproveRefund = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      bookingId,
      reason,
    }: {
      bookingId: string;
      reason: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "decline-booking",
        { body: { bookingId, reason, action: "approve_refund" } }
      );
      if (error) throw error;
      if (data?.error) {
        throw new Error(data.error || data.message || "Failed to approve refund");
      }
      return data as {
        status: string;
        message: string;
        refund_method?: string;
        refund_details?: unknown;
      };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      toast({ title: res.message });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve refund.",
        variant: "destructive",
      });
    },
  });
};

// ── Reject a pending refund request ──
export const useRejectRefund = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      bookingId,
      reason,
    }: {
      bookingId: string;
      reason: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "decline-booking",
        { body: { bookingId, reason, action: "reject_refund" } }
      );
      if (error) throw error;
      if (data?.error) {
        throw new Error(data.error || data.message || "Failed to reject refund");
      }
      return data as { status: string; message: string };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      toast({ title: res.message });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject refund request.",
        variant: "destructive",
      });
    },
  });
};

// ── Admin cancel booking via RPC (bypasses vendor user_id check) ──
export const useAdminCancelBookingRpc = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.rpc("admin_cancel_booking", {
        p_booking_id: bookingId,
      });
      if (error) throw error;
      const result = data as { status: string; message: string };
      if (result.status === "error") {
        throw new Error(result.message || "Failed to cancel booking");
      }
      return result;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booking-details"] });
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      queryClient.invalidateQueries({ queryKey: ["stall-holds"] });
      queryClient.invalidateQueries({ queryKey: ["stall-instances"] });
      queryClient.invalidateQueries({ queryKey: ["booking-dates"] });
      toast({ title: res.message });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel booking.",
        variant: "destructive",
      });
    },
  });
};
