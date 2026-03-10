import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type StallTemplate = Database['public']['Tables']['stall_templates']['Row'];
type StallTemplateInsert = Database['public']['Tables']['stall_templates']['Insert'];
type StallTemplateUpdate = Database['public']['Tables']['stall_templates']['Update'];

export const useStallTemplates = () => {
  return useQuery({
    queryKey: ['stall-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stall_templates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateStallTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (template: StallTemplateInsert) => {
      const { data, error } = await supabase
        .from('stall_templates')
        .insert(template)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stall-templates'] });
    },
  });
};

export const useUpdateStallTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: StallTemplateUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('stall_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stall-templates'] });
    },
  });
};

export const useDeleteStallTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stall_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stall-templates'] });
    },
  });
};