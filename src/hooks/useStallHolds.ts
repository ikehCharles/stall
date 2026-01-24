import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type StallHold = Database['public']['Tables']['stall_holds']['Row'];

// Type for the new JSON response from create_stall_hold RPC
interface StallHoldResponse {
  status: 'ok' | 'conflict' | 'error';
  message?: string;
  days?: number;
  price_per_day?: number;
  total?: number;
}

/** Current user's active hold for a specific stall (for restoring modal state after refresh). */
export const useMyStallHold = (
  stallId: string,
  marketId: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ['my-stall-hold', stallId, marketId],
    queryFn: async (): Promise<{ expiresAt: string; dates: string[] } | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('stall_holds')
        .select('expires_at, selected_dates')
        .eq('stall_instance_id', stallId)
        .eq('market_id', marketId)
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.selected_dates?.length) return null;
      const dates = Array.isArray(data.selected_dates) ? data.selected_dates : [];
      return { expiresAt: data.expires_at, dates };
    },
    enabled: !!(stallId && marketId && (options?.enabled !== false)),
    refetchInterval: 5000,
  });
};

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
      
      // Group holds by stall_instance_id and collect hold_date values
      const holdsByStall = data?.reduce((acc: Record<string, string[]>, hold) => {
        if (hold.hold_date) {
          if (!acc[hold.stall_instance_id]) {
            acc[hold.stall_instance_id] = [];
          }
          acc[hold.stall_instance_id].push(hold.hold_date);
        }
        return acc;
      }, {}) || {};
      
      return holdsByStall;
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
        p_stall_id: stallId,
        p_market_id: marketId,
        p_dates: dates
      });
      
      if (error) throw error;
      
      // Handle the new JSON response format
      const response = data as unknown as StallHoldResponse;
      if (response.status === 'error') {
        throw new Error(response.message || 'Unknown error occurred');
      }
      
      if (response.status === 'conflict') {
        throw new Error(response.message || 'Selected dates are not available');
      }
      
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stall-holds', variables.marketId] });
      queryClient.invalidateQueries({
        queryKey: ['my-stall-hold', variables.stallId, variables.marketId],
      });
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