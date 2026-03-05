import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME_DEFAULT, appInitial } from "@/lib/appBranding";

/**
 * Lightweight hook that fetches app branding (name + logo) from the
 * public-readable `settings` table.  Works on unauthenticated pages
 * (login, email-pending) because the branding rows have a public SELECT
 * policy.
 *
 * Returns `{ appName, appInitial, appLogoUrl, isLoading }`.
 */
export const useAppBranding = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["app-branding"],
    queryFn: async () => {
      const { data: rows, error } = await (
        supabase.from("settings" as never) as any
      )
        .select("key, value")
        .in("key", ["app_name", "app_logo_url", "app_slogan"])
        .eq("source", "platform");

      if (error || !rows) return { appName: APP_NAME_DEFAULT, appLogoUrl: "", appSlogan: "" };

      const map: Record<string, string> = {};
      for (const r of rows as { key: string; value: string }[]) {
        map[r.key] = r.value;
      }

      return {
        appName: map["app_name"] || APP_NAME_DEFAULT,
        appLogoUrl: map["app_logo_url"] || "",
        appSlogan: map["app_slogan"] || "",
      };
    },
    staleTime: 5 * 60 * 1000, // cache for 5 min – branding rarely changes
  });

  const appName = data?.appName ?? APP_NAME_DEFAULT;
  const appLogoUrl = data?.appLogoUrl ?? "";
  const appSlogan = data?.appSlogan ?? "";

  return {
    appName,
    appInitial: appInitial(appName),
    appLogoUrl,
    appSlogan,
    isLoading,
  };
};
