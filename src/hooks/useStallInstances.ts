import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type StallInstance = Database["public"]["Tables"]["stall_instances"]["Row"] & {
  stall_templates?: {
    name: string;
    shape: Database["public"]["Enums"]["stall_shape"];
    fill_color: string;
    stroke_color: string;
    price: number;
    capacity: number;
    category_id: string | null;
    stall_template_tags?: { tag_id: string }[];
  };
  stall_instance_tags?: { tag_id: string }[];
  isSelected?: boolean;
  isHeld?: boolean;
  isIneligible?: boolean;
  ineligibleReason?: string;
  selectedDates?: Date[];
};
type StallInstanceInsert =
  Database["public"]["Tables"]["stall_instances"]["Insert"];
type StallInstanceUpdate =
  Database["public"]["Tables"]["stall_instances"]["Update"];

export const useStallInstances = (marketId: string) => {
  return useQuery({
    queryKey: ["stall-instances", marketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stall_instances")
        .select(
          `
          *,
          stall_templates (
            name,
            shape,
            fill_color,
            stroke_color,
            price,
            capacity,
            category_id,
            stall_template_tags (
              tag_id
            )
          ),
          stall_instance_tags (
            tag_id
          )
        `
        )
        .eq("market_id", marketId);

      if (error) throw error;
      return data;
    },
    enabled: !!marketId,
  });
};

export const useCreateStallInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (instance: StallInstanceInsert) => {
      const { data, error } = await supabase
        .from("stall_instances")
        .insert(instance)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["stall-instances", variables.market_id],
      });
    },
  });
};

export const useUpdateStallInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      market_id,
      ...updates
    }: StallInstanceUpdate & { id: string; market_id: string }) => {
      const { data, error } = await supabase
        .from("stall_instances")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["stall-instances", variables.market_id],
      });
    },
  });
};

export const useDeleteStallInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      market_id,
    }: {
      id: string;
      market_id: string;
    }) => {
      const { error } = await supabase
        .from("stall_instances")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["stall-instances", variables.market_id],
      });
    },
  });
};
