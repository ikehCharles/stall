import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Tag = Database["public"]["Tables"]["tags"]["Row"];

// ─── Queries ────────────────────────────────────────────────
export const useTags = () => {
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
};

/** Fetch tag IDs currently linked to a stall template */
export const useStallTemplateTags = (stallTemplateId: string | undefined) => {
  return useQuery({
    queryKey: ["stall-template-tags", stallTemplateId],
    enabled: !!stallTemplateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stall_template_tags")
        .select("tag_id")
        .eq("stall_template_id", stallTemplateId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.tag_id);
    },
  });
};

/** Sync the join table for a stall template (replace all) */
export const useSyncStallTemplateTags = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stallTemplateId, tagIds }: { stallTemplateId: string; tagIds: string[] }) => {
      // delete existing
      const { error: delErr } = await supabase
        .from("stall_template_tags")
        .delete()
        .eq("stall_template_id", stallTemplateId);
      if (delErr) throw delErr;

      // insert new
      if (tagIds.length > 0) {
        const rows = tagIds.map((tag_id) => ({ stall_template_id: stallTemplateId, tag_id }));
        const { error: insErr } = await supabase.from("stall_template_tags").insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["stall-template-tags", vars.stallTemplateId] });
    },
  });
};

// ─── Stall Instance Tags (override) ────────────────────────

/** Fetch tag IDs currently linked to a stall instance (override) */
export const useStallInstanceTags = (stallInstanceId: string | undefined) => {
  return useQuery({
    queryKey: ["stall-instance-tags", stallInstanceId],
    enabled: !!stallInstanceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stall_instance_tags")
        .select("tag_id")
        .eq("stall_instance_id", stallInstanceId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.tag_id);
    },
  });
};

/** Sync the join table for a stall instance (replace all). Pass empty array to clear overrides. */
export const useSyncStallInstanceTags = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stallInstanceId, tagIds }: { stallInstanceId: string; tagIds: string[] }) => {
      // delete existing
      const { error: delErr } = await supabase
        .from("stall_instance_tags")
        .delete()
        .eq("stall_instance_id", stallInstanceId);
      if (delErr) throw delErr;

      // insert new
      if (tagIds.length > 0) {
        const rows = tagIds.map((tag_id) => ({ stall_instance_id: stallInstanceId, tag_id }));
        const { error: insErr } = await supabase.from("stall_instance_tags").insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["stall-instance-tags", vars.stallInstanceId] });
      // Also refresh the stall instances query so the inline stall_instance_tags update
      qc.invalidateQueries({ queryKey: ["stall-instances"] });
    },
  });
};

// ─── Mutations ──────────────────────────────────────────────
export const useCreateTag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const { data, error } = await supabase
        .from("tags")
        .insert({ name, slug, color })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
};

export const useUpdateTag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const { data, error } = await supabase
        .from("tags")
        .update({ name, slug, color })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
};

export const useDeleteTag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
};
