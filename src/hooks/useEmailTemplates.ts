import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  subject: string;
  html_body: string;
  variables: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (table: string) => (supabase as any).from(table);

const TEMPLATES_KEY = ["email-templates"];

export function useEmailTemplates() {
  return useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: async () => {
      const { data, error } = await from("email_templates")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as EmailTemplate[];
    },
  });
}

export function useEmailTemplate(id: string | null) {
  return useQuery({
    queryKey: [...TEMPLATES_KEY, id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await from("email_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as EmailTemplate;
    },
    enabled: !!id,
  });
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      subject,
      html_body,
    }: {
      id: string;
      subject: string;
      html_body: string;
    }) => {
      const { error } = await from("email_templates")
        .update({ subject, html_body })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
      toast({ title: "Template saved", description: "Email template updated successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      key,
      name,
      subject,
      html_body,
      variables,
    }: {
      key: string;
      name: string;
      subject: string;
      html_body: string;
      variables: string[];
    }) => {
      const { data, error } = await from("email_templates")
        .insert({ key, name, subject, html_body, variables, is_default: false })
        .select()
        .single();

      if (error) throw error;
      return data as EmailTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
      toast({ title: "Template created", description: "New email template created successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Create failed", description: err.message, variant: "destructive" });
    },
  });
}
