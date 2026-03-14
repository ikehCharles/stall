import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationRecord {
  id: string;
  recipient_id: string;
  recipient_email: string;
  type: string;
  status: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
}

interface EmailTemplate {
  key: string;
  subject: string;
  html_body: string;
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

/**
 * Replace all {{variable}} placeholders in a string with values from the
 * metadata object. Unknown variables are left as-is.
 */
function interpolate(
  template: string,
  vars: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const val = vars[key];
    if (val === undefined || val === null) return `{{${key}}}`;
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  });
}

/**
 * Load templates from the email_templates table. Returns a map keyed by
 * template key. Falls back to a minimal default if DB is unreachable.
 */
async function loadTemplates(
  supabase: ReturnType<typeof createClient>
): Promise<Map<string, EmailTemplate>> {
  const map = new Map<string, EmailTemplate>();

  const { data, error } = await supabase
    .from("email_templates")
    .select("key, subject, html_body");

  if (error) {
    console.error("Failed to load email templates:", error.message);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.key, row as EmailTemplate);
  }
  return map;
}

/**
 * Build the final HTML for an email by wrapping the body template inside
 * the shared wrapper template, then interpolating all variables.
 */
function buildEmail(
  templates: Map<string, EmailTemplate>,
  notification: NotificationRecord,
  appName: string,
  appLogoUrl: string
): { subject: string; html: string } {
  const meta = notification.metadata;
  const templateKey = notification.type;
  const bodyTemplate = templates.get(templateKey);
  const wrapperTemplate = templates.get("wrapper");

  // Build variable map from metadata + notification fields
  const vars: Record<string, unknown> = {
    ...meta,
    title: notification.title,
    body: notification.body,
    recipient_email: notification.recipient_email,
    app_name: appName,
    app_logo_url: appLogoUrl,
  };

  // Resolve any relative URL variables (e.g. review_url, action_url) to full
  // URLs using CLIENT_BASEURL so email templates get absolute links.
  const clientBase = (Deno.env.get("CLIENT_BASEURL") || "").replace(/\/$/, "");
  if (clientBase) {
    for (const key of Object.keys(vars)) {
      if (
        key.endsWith("_url") &&
        typeof vars[key] === "string" &&
        (vars[key] as string).startsWith("/")
      ) {
        vars[key] = clientBase + vars[key];
      }
    }
  }

  // If selected_dates is an array, join for display
  if (Array.isArray(vars.selected_dates)) {
    vars.selected_dates = (vars.selected_dates as string[]).join(", ");
  }

  let subject: string;
  let bodyHtml: string;

  if (bodyTemplate) {
    subject = interpolate(bodyTemplate.subject, vars);
    bodyHtml = interpolate(bodyTemplate.html_body, vars);
  } else {
    // Fallback: use notification title/body directly
    subject = notification.title;
    bodyHtml = `<h2>${notification.title}</h2><p>${notification.body}</p>`;
  }

  // Wrap in the shared wrapper if available
  let html: string;
  if (wrapperTemplate) {
    html = interpolate(wrapperTemplate.html_body, { ...vars, content: bodyHtml });
  } else {
    // Minimal fallback wrapper
    html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">${appName}</h1>
        </div>
        <div style="padding: 32px 24px;">${bodyHtml}</div>
        <div style="border-top: 1px solid #e5e7eb; padding: 20px 24px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            This is an automated notification from ${appName}. Please do not reply to this email.
          </p>
        </div>
      </div>`;
  }

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch configured branding from settings
    const { data: brandingRows } = await supabase
      .from('settings')
      .select('key, value')
      .eq('source', 'platform')
      .in('key', ['app_name', 'app_logo_url']);
    const brandingMap = Object.fromEntries(
      (brandingRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
    );
    const appName = brandingMap['app_name'] || 'Stall Inc';
    const appLogoUrl = brandingMap['app_logo_url'] || '';

    const body = await req.json();

    // Support three invocation styles:
    //   1. Supabase Database Webhook  → { type: "INSERT", record: { id, ... } }
    //   2. Direct single dispatch     → { notification_id: "<uuid>" }
    //   3. Batch / cron sweep         → { process_pending: 50 }
    const webhookRecord = body?.record as NotificationRecord | undefined;
    const notification_id: string | undefined =
      body?.notification_id ?? webhookRecord?.id;
    const process_pending = body?.process_pending;

    let notifications: NotificationRecord[] = [];

    if (notification_id) {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("id", notification_id)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Notification not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      notifications = [data as NotificationRecord];
    } else if (process_pending) {
      const limit = typeof process_pending === "number" ? process_pending : 50;
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch pending notifications" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      notifications = (data || []) as NotificationRecord[];
    } else {
      return new Response(
        JSON.stringify({ error: "Provide notification_id, record, or process_pending" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load all templates once for this invocation
    const templates = await loadTemplates(supabase);

    const results: { id: string; status: string; error?: string }[] = [];

    for (const notification of notifications) {
      if (notification.status === "sent" || notification.status === "read") {
        results.push({ id: notification.id, status: "skipped" });
        continue;
      }

      try {
        const { subject, html } = buildEmail(templates, notification, appName, appLogoUrl);

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${appName} <contact@contact.geekgrin.com>`,
            to: [notification.recipient_email],
            subject,
            html,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`Resend API error for ${notification.id}:`, errorText);

          await supabase
            .from("notifications")
            .update({ status: "failed", error_message: errorText.substring(0, 500) })
            .eq("id", notification.id);

          results.push({ id: notification.id, status: "failed", error: errorText });
          continue;
        }

        await supabase
          .from("notifications")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", notification.id);

        results.push({ id: notification.id, status: "sent" });
      } catch (err) {
        console.error(`Error processing notification ${notification.id}:`, err);

        await supabase
          .from("notifications")
          .update({ status: "failed", error_message: String(err).substring(0, 500) })
          .eq("id", notification.id);

        results.push({ id: notification.id, status: "failed", error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
