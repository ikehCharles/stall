import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useCreateCred = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      source,
      key,
      meta,
    }: {
      source: string;
      key: string;
      meta: Record<string, any>;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const { data, error } = await supabase.functions.invoke(
        "create-cred",
        {
          body: {
            source,
            key,
            meta,
          },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ["markets"] });
    },
  });
};
