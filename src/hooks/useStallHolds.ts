import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type StallHold = Database['public']['Tables']['stall_holds']['Row'];

export const useStallHolds = (marketId: string) => {
  return useQuery({
    queryKey: ['stall-holds', marketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stall_holds')
        .select('*')
        .eq('market_id', marketId)
        .gt('expires_at', new Date().toISOString());
      
      if (error) throw error;
      return data;
    },
    enabled: !!marketId,
    refetchInterval: 10000, // Refresh every 10 seconds to clean up expired holds
  });
};

export const useCreateStallHold = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      stallId, 
      marketId, 
      dates 
    }: { 
      stallId: string; 
      marketId: string; 
      dates: string[]; 
    }) => {
      const { data, error } = await supabase.rpc('create_stall_hold', {
        stall_id: stallId,
        market_id: marketId,
        dates: dates
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stall-holds', variables.marketId] });
    },
  });
};

export const useCheckStallAvailability = () => {
  return useMutation({
    mutationFn: async ({ 
      stallId, 
      marketId, 
      dates 
    }: { 
      stallId: string; 
      marketId: string; 
      dates: string[]; 
    }) => {
      const { data, error } = await supabase.rpc('check_stall_date_availability', {
        stall_id: stallId,
        market_id: marketId,
        dates: dates
      });
      
      if (error) throw error;
      return data;
    },
  });
};

export const useCleanupExpiredHolds = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('cleanup_expired_holds');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stall-holds'] });
    },
  });
};