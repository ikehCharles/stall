import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";



export const useSyncOfflineBooking = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
  
    return useMutation({
      mutationFn: async () => {
        const { data, error } = await supabase.functions.invoke("sync-offline-orders");
        if (error) throw error;
        return data as {synced: number, message:string};
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
          description: error.message || "Failed to reconcile booking.",
          variant: "destructive",
        });
      },
    });
  };


export const useReconcileOfflineBooking = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
  
    return useMutation({
      mutationFn: async () => {
        const { data, error } = await supabase.functions.invoke("reconcile-offline-orders");
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
          description: error.message || "Failed to reconcile booking.",
          variant: "destructive",
        });
      },
    });
  };