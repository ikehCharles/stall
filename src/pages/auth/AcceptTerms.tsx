import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useAppBranding } from "@/hooks/useAppBranding";
import { usePlatformSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { FileText } from "lucide-react";
import { sanitizeEditorHtml } from "@/lib/sanitizeHtml";

const AcceptTerms = () => {
  const { user, refreshProfile } = useAuth();
  const { appName, appLogoUrl, appInitial } = useAppBranding();
  const { data: settings, isLoading } = usePlatformSettings();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAccept = async () => {
    if (!user || !accepted) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("profiles" as never) as any)
        .update({ terms_accepted_at: new Date().toISOString() })
        .eq("id", user.id);

      if (error) throw error;

      await refreshProfile();

      toast({
        title: "Terms Accepted",
        description: "Thank you for accepting the terms and conditions.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center space-y-3">
          {/* Logo */}
          <div className="flex justify-center">
            {appLogoUrl ? (
              <img
                src={appLogoUrl}
                alt={appName}
                className="h-14 w-14 rounded-xl object-cover shadow ring-1 ring-slate-200"
              />
            ) : (
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow">
                <span className="text-2xl font-bold text-white">{appInitial}</span>
              </div>
            )}
          </div>

          <CardTitle className="text-2xl font-bold">Terms &amp; Conditions</CardTitle>
          <CardDescription>
            Please review and accept the {appName} terms and conditions to continue.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Terms content */}
          <ScrollArea className="h-[350px] rounded-md border p-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Refund Policy */}
                {settings?.refundPolicy && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      Refund Policy
                    </h3>
                    <div
                      className="prose prose-sm max-w-none text-muted-foreground [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1"
                      dangerouslySetInnerHTML={{ __html: sanitizeEditorHtml(settings.refundPolicy) }}
                    />
                  </div>
                )}

                {/* Terms & Conditions */}
                {settings?.termsAndConditions && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      Terms &amp; Conditions
                    </h3>
                    <div
                      className="prose prose-sm max-w-none text-muted-foreground [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1"
                      dangerouslySetInnerHTML={{ __html: sanitizeEditorHtml(settings.termsAndConditions) }}
                    />
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Accept checkbox */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <Checkbox
              checked={accepted}
              onCheckedChange={(c) => setAccepted(c === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground leading-snug">
              I have read and agree to the <strong>{appName}</strong> Terms &amp; Conditions and Refund Policy.
            </span>
          </label>

          {/* Action */}
          <Button
            className="w-full"
            size="lg"
            disabled={!accepted || saving}
            onClick={handleAccept}
          >
            {saving ? "Saving…" : "Accept & Continue"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptTerms;
