import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useAppBranding } from "@/hooks/useAppBranding";
import { usePlatformSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { sanitizeEditorHtml } from "@/lib/sanitizeHtml";

/* ── Stylesheet injected into the combined iframe ── */
const IFRAME_STYLES = `
  html,body{margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a;}
  body{padding:16px 20px;overflow-y:auto;}
  h1{font-size:1.25em;font-weight:700;margin:.4em 0}
  h2{font-size:1.1em;font-weight:600;margin:.4em 0}
  h3{font-size:1em;font-weight:600;margin:.3em 0}
  p{margin:.35em 0}
  ul,ol{margin:.35em 0;padding-left:1.5em}
  li{margin:.15em 0}
  a{color:#2563eb;text-decoration:underline}
  table{border-collapse:collapse;width:100%;margin:.5em 0}
  th,td{border:1px solid #d1d5db;padding:6px 10px;text-align:left}
  th{background:#f3f4f6;font-weight:600}
  blockquote{border-left:3px solid #d1d5db;margin:.5em 0;padding:.25em .75em;color:#4b5563}
  .section-title{font-size:1.15em;font-weight:700;margin:0 0 .5em;padding-bottom:.35em;border-bottom:2px solid #e5e7eb;display:flex;align-items:center;gap:6px;}
  .section-title svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
  hr.divider{border:none;border-top:1px solid #e5e7eb;margin:1.25em 0;}
`;

const FILE_ICON_SVG = `<svg viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`;

/** Builds a single srcdoc with all policy sections combined */
function buildCombinedSrcdoc(terms?: string, refund?: string) {
  const sections: string[] = [];

  if (terms) {
    sections.push(
      `<div class="section-title">${FILE_ICON_SVG} Terms &amp; Conditions</div>${sanitizeEditorHtml(terms)}`
    );
  }
  if (refund) {
    if (sections.length > 0) sections.push(`<hr class="divider"/>`);
    sections.push(
      `<div class="section-title">${FILE_ICON_SVG} Refund Policy</div>${sanitizeEditorHtml(refund)}`
    );
  }

  const body = sections.length
    ? sections.join("")
    : `<p style="color:#6b7280;font-style:italic;">No terms or policies have been configured yet.</p>`;

  return `<!DOCTYPE html><html><head><style>${IFRAME_STYLES}</style></head><body>${body}</body></html>`;
}

/**
 * Non-dismissable modal that requires users to accept the platform
 * terms & conditions before they can use any part of the app.
 * Renders on top of the current page — no redirect needed.
 */
const TermsAcceptanceModal = () => {
  const { user, refreshProfile } = useAuth();
  const { appName } = useAppBranding();
  const { data: settings, isLoading: settingsLoading } = usePlatformSettings();
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
        description:
          err instanceof Error
            ? err.message
            : "Failed to save. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  /** Memoise the combined srcdoc so it only rebuilds when settings change */
  const srcdoc = useMemo(
    () => buildCombinedSrcdoc(settings?.termsAndConditions, settings?.refundPolicy),
    [settings?.termsAndConditions, settings?.refundPolicy]
  );

  return (
    <Dialog open>
      <DialogContent
        disableClose
        className="max-w-[calc(100vw-2rem)] sm:max-w-2xl h-[95dvh] max-h-[95dvh] flex flex-col p-0 gap-0 rounded-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Fixed header */}
        <div className="shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogHeader className="text-center space-y-1.5">
            <DialogTitle className="text-xl font-bold">
              Terms &amp; Conditions
            </DialogTitle>
            <DialogDescription>
              Please review and accept the {appName} terms and conditions to
              continue.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Single-scroll content area — the iframe itself scrolls */}
        <div className="flex-1 min-h-0 px-0 py-0">
          {settingsLoading ? (
            <div className="space-y-3 px-6 py-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <iframe
              srcDoc={srcdoc}
              title="Terms & Conditions"
              className="w-full h-full border-0"
            />
          )}
        </div>

        {/* Fixed footer */}
        <div className="shrink-0 px-6 pb-6 pt-4 border-t space-y-4">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="accept-terms"
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              disabled={saving}
            />
            <label
              htmlFor="accept-terms"
              className="text-sm leading-snug cursor-pointer select-none"
            >
              I have read and agree to the terms and conditions
              {settings?.refundPolicy ? " and refund policy" : ""}.
            </label>
          </div>

          <Button
            className="w-full"
            disabled={!accepted || saving}
            onClick={handleAccept}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Accept &amp; Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TermsAcceptanceModal;
