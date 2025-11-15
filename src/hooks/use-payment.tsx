import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams } from "react-router-dom";
import { INTENT, QueryKeysEnum } from "@/lib/enums";

export const useCreatePayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: { bookingId: string; amount: number, intent: INTENT }) => {
      const { data, error } = await supabase.functions.invoke(
        "create-paypal-order",
        {
          body: payload,
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QueryKeysEnum.vendorBookings] });
      toast({
        title: "Payment Booking Created",
        description: "The payment booking has been created successfully.",
      });
      window.location.href = data.links.find((l) => l.rel === "payer-action")?.href;
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create payment.",
        variant: "destructive",
      });
    },
  });
};

export const useCapturePayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.functions.invoke(
        "capture-paypal-order",
        {
          
          body: {token},
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: [QueryKeysEnum.vendorBookings] });
      toast({
        title: "Payment Booking Confirmed",
        description: "The payment booking has been confirmed successfully.",
      });
      navigate(`/vendor/bookings/${id}?status=processing`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Error verifying payment.",
        variant: "destructive",
      });
    },
  });
};

export const useAuthorizePayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.functions.invoke(
        "authorize-paypal-order",
        {
          
          body: {orderID:token},
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: [QueryKeysEnum.vendorBookings] });
      toast({
        title: "Payment Booking Reserved",
        description: "The payment booking has been reserved successfully.",
      });
      navigate(`/vendor/bookings/${id}?status=processing`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Error verifying payment.",
        variant: "destructive",
      });
    },
  });
};