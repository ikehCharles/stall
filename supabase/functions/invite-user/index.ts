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

    return responseJSON(200, data);
  } catch (err) {
    console.error("Error creating user:", err);
    return responseJSON(500, { message: "Failed to create user" });
  }
});
