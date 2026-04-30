import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v1 as uuidv1 } from "npm:uuid";

const CLIENT_BASEURL = Deno.env.get("CLIENT_BASEURL");
const SUPABASEURL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ZETTLE_CLIENT_ID = Deno.env.get("ZETTLE_CLIENT_ID");
const ZETTLE_CLIENT_SECRET = Deno.env.get("ZETTLE_CLIENT_SECRET");
const ZETTLE_CONTACT_EMAIL = Deno.env.get("ZETTLE_CONTACT_EMAIL");
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

const cached = {
  token: null as string | null,
  expiresAt: 0,
};

export async function getZettleAccessToken(): Promise<string> {
  const now = Date.now();
  if (cached.token && cached.expiresAt > now + 5000) {
    return cached.token;
  }

  const tokenUrl = "https://oauth.zettle.com/token";

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    client_id: ZETTLE_CLIENT_ID,
    assertion: ZETTLE_CLIENT_SECRET,
  });

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error("Zettle token error", resp.status, txt);
    throw new Error(`Failed to retrieve Zettle access token`);
  }

  const data = await resp.json();

  cached.token = data.access_token;
  cached.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;

  return cached.token!;
}

const deleteSubs = async (accessToken) => {
  const subscriptionResp = await fetch(
    "https://pusher.izettle.com/organizations/self/subscriptions",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!subscriptionResp.ok) {
    const errTxt = await subscriptionResp.json();
    return { status: false, message: errTxt };
  }



  const subs = await subscriptionResp.json();


  for (let i = 0; i < subs.length; i++) {
    const subscriptionDelResp = await fetch(
      `https://pusher.izettle.com/organizations/self/subscriptions/${subs[i].uuid}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!subscriptionDelResp.ok) {
      const errTxt = await subscriptionDelResp.json();
      return { status: false, message: errTxt };
    }
    const delData = await subscriptionDelResp.json()
  }

  return {status: true, message: "Successfully deleted all subs"}
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  const { source, key, meta } = await req.json();
  if (!source || !key) return responseJSON(400, { error: "Missing fields" });

  if (source === "zettle" && key === "webhook_signing_key") {
    const payload = {
      uuid: uuidv1(),
      transportName: "WEBHOOK",
      eventNames: ["PurchaseCreated"],
      destination: meta.url,
      contactEmail: ZETTLE_CONTACT_EMAIL,
    };

    const accessToken = await getZettleAccessToken();

    const deletedSubs = await deleteSubs(accessToken);

    if(!deletedSubs.status) return responseJSON(400, {message: deletedSubs.message});


    const subscriptionResp = await fetch(
      "https://pusher.izettle.com/organizations/self/subscriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!subscriptionResp.ok) {
      const errTxt = await subscriptionResp.json();
     
      return responseJSON(400, { message: errTxt });
    }


    const subData = await subscriptionResp.json();


    const supabase = createClient(SUPABASEURL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: createCredError, data: createCredData } = await supabase.rpc(
      "create_credentials",
      {
        p_source: source,
        p_key: key,
        p_value: subData.signingKey,
        p_meta: subData
      }
    );

    if (createCredError) {
      const err = createCredError.json()
      console.error(
        "Error saving webhook signing key:",
        createCredError.message
      );
      return responseJSON(500, {
        error: 'Error saving webhook url, kindly confirm url can accept requests',
      });
    }

    return responseJSON(200, {
      message: "Zettle webhook created successfully",
    });
  }

  return responseJSON(200, { message: "Webhook essentials function" });
});
