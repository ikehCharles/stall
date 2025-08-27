import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type MarketLayout = Database['public']['Tables']['market_layouts']['Row'];
type MarketLayoutInsert = Database['public']['Tables']['market_layouts']['Insert'];
type MarketLayoutUpdate = Database['public']['Tables']['market_layouts']['Update'];

export const useMarketLayout = (marketId: string) => {
  return useQuery({
    queryKey: ['market-layout', marketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_layouts')
        .select('*')
        .eq('market_id', marketId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!marketId,
  });
};

export const useUpsertMarketLayout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (layout: MarketLayoutInsert) => {
      const { data, error } = await supabase
        .from('market_layouts')
        .upsert(layout, { onConflict: 'market_id' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['market-layout', data.market_id] });
    },
  });
};