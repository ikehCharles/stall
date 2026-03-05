// supabase/functions/create-user/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASEURL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const responseJSON = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  const access_token = req.headers.get("Authorization")?.replace("Bearer ", "");

  const supabaseClient = createClient(
    SUPABASEURL ?? "",
    SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      global: {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      },
    }
  );


  try {
    // Identify the user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return responseJSON(401, { message: "Unauthorized" });
    }

    // Fetch the user’s role_id from user_roles
    const { data: userRole, error: userRoleError } = await supabaseClient
      .from("user_roles")
      .select("role_id")
      .eq("user_id", user.id)
      .single();

    if (userRoleError || !userRole) {
      return responseJSON(401, { message: "Profile not found" });
    }

    // Check if role has permission "invite_users"
    const { data: permissions } = await supabaseClient
      .from("role_permissions")
      .select("permissions:permission_id(key)")
      .eq("role_id", userRole.role_id);

    const hasUsersInvitePermission = permissions?.some(
      (p) => p?.permissions?.key === "users.invite"
    );
    const hasVendorsInvitePermission = permissions?.some(
      (p) => p?.permissions?.key === "vendors.invite"
    );

    // if user does not have users.invite permission or vendors.invite permission, return forbidden
    if (!hasUsersInvitePermission && !hasVendorsInvitePermission) {
      return responseJSON(403, {
        error: "Forbidden: Missing necessary permissions",
      });
    }

    const { fullName, email, phoneNumber, roleId, password, confirmEmail } =
      await req.json();
    if (!fullName || !email || !phoneNumber) {
      return responseJSON(400, { message: "Missing fields" });
    }

    // if user does not have users.invite permission and a role is assigned to them, return forbidden
    if (!hasUsersInvitePermission && roleId) {
      return responseJSON(403, {
        error: "Forbidden: Missing permission invite_users",
      });
    }

    

    

    const supabaseAdmin = createClient(
      SUPABASEURL ?? "",
      SUPABASE_SERVICE_ROLE_KEY ?? ""
    );


    let data, error;
    if (confirmEmail && password) {
      // create user in supabase
      ({ data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: confirmEmail,
        user_metadata: {
          full_name: fullName,
          phone_number: phoneNumber,
          role_id: roleId,
        },
      }));
    } else {
      // invite user
      ({ data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            full_name: fullName,
            phone_number: phoneNumber,
            role_id: roleId,
          },
        }
      ));
    }


    if (error) {
      return responseJSON(200, {
        success: false,
        message: error.message
      });
    }

    // -----------------------------------------------------------------------
    // FCA vendor onboarding: notifications + welcome email
    // -----------------------------------------------------------------------
    if (hasVendorsInvitePermission && !roleId && data?.user) {
      // Fetch configured app name from settings
      const { data: appNameRow } = await supabaseAdmin
        .from('settings')
        .select('value')
        .eq('key', 'app_name')
        .eq('source', 'platform')
        .maybeSingle();
      const appName = appNameRow?.value || 'Stall Inc';

      // Get the FCA's profile for display in notifications
      const { data: fcaProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      const fcaName = fcaProfile?.full_name || "Field Collections Agent";
      const fcaEmail = fcaProfile?.email || user.email || "Unknown";

      // --- 1. Send welcome email to the new vendor (from DB template) ---
      try {
        const resetUrl = `${Deno.env.get("CLIENT_BASEURL") || SUPABASEURL}/auth/callback?type=recovery`;

        // Load vendor_welcome + wrapper templates from DB
        const { data: tplRows } = await supabaseAdmin
          .from("email_templates")
          .select("key, subject, html_body")
          .in("key", ["vendor_welcome", "wrapper"]);

        const tplMap = new Map<string, { subject: string; html_body: string }>();
        for (const row of tplRows ?? []) tplMap.set(row.key, row);

        const vars: Record<string, string> = {
          vendor_name: fullName,
          vendor_email: email,
          fca_name: fcaName,
          reset_url: resetUrl,
          app_name: appName,
        };

        const interpolate = (s: string) =>
          s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);

        const welcomeTpl = tplMap.get("vendor_welcome");
        const wrapperTpl = tplMap.get("wrapper");

        const welcomeSubject = welcomeTpl ? interpolate(welcomeTpl.subject) : `Welcome to ${appName} — Set Up Your Password`;
        let welcomeBody = welcomeTpl ? interpolate(welcomeTpl.html_body) : `<h2>Welcome to ${appName}!</h2><p>Hi ${fullName}, please set your password.</p>`;

        if (wrapperTpl) {
          welcomeBody = wrapperTpl.html_body.replace("{{content}}", welcomeBody);
        }

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${appName} <contact@contact.geekgrin.com>`,
            to: [email],
            subject: welcomeSubject,
            html: welcomeBody,
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send vendor welcome email:", emailErr);
      }

      // --- 2. Dispatch vendor_onboarded notification to admins ---
      try {
        const { data: recipients } = await supabaseAdmin.rpc(
          "get_notification_recipients",
          { p_notification_type: "vendor_onboarded" }
        );

        if (recipients && recipients.length > 0) {
          const notifications = recipients.map(
            (recipient: { user_id: string; email: string }) => ({
              recipient_id: recipient.user_id,
              recipient_email: recipient.email,
              type: "vendor_onboarded",
              title: "New Vendor Onboarded",
              body: `A new vendor ${fullName} (${email}) has been onboarded by ${fcaName} (${fcaEmail}).`,
              metadata: {
                vendor_name: fullName,
                vendor_email: email,
                vendor_phone: phoneNumber,
                onboarded_by: user.id,
                fca_name: fcaName,
                fca_email: fcaEmail,
              },
              idempotency_key: `vendor_onboarded:${data.user.id}:${recipient.user_id}`,
            })
          );

          await supabaseAdmin.from("notifications").insert(notifications);
        }
      } catch (notifyErr) {
        console.error("Failed to dispatch vendor_onboarded notification:", notifyErr);
      }
    }

    return responseJSON(200, data);
  } catch (err) {
    console.error("Error creating user:", err);
    return responseJSON(500, { message: "Failed to create user" });
  }
});
