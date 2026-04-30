// supabase/functions/create-paypal-order/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_API_CLIENT");
const PAYPAL_SECRET = Deno.env.get("PAYPAL_API_SECRET");
const PAYPAL_BASE = Deno.env.get("PAYPAL_API");
const CLIENT_BASEURL = Deno.env.get("CLIENT_BASEURL");
const SUPABASEURL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};


enum INTENT {
  AUTHORIZE,
  CAPTURE,
  VOID
}

// get access token using paypal credentials
async function getAccessToken() {
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`);
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const data = await res.json();
  return data.access_token;
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(SUPABASEURL ?? '', SUPABASE_SERVICE_ROLE_KEY ?? '');
    const { amount, bookingId, intent } = await req.json();
    if (!amount || !bookingId) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    if (typeof amount !== "number" || amount <= 0) {
      return new Response(JSON.stringify({ error: "amount must be a positive number" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
      return new Response(JSON.stringify({ error: "Invalid bookingId" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    // get access token and branding in parallel
    const [accessToken, brandingRows] = await Promise.all([
      getAccessToken(),
      supabaseClient
        .from('settings')
        .select('key, value')
        .eq('source', 'platform')
        .in('key', ['app_name'])
        .then(({ data }) => data ?? []),
    ]);
    const brandingMap = Object.fromEntries(
      (brandingRows as { key: string; value: string }[]).map((r) => [r.key, r.value])
    );
    const appName = brandingMap['app_name'] || 'Stall Inc';

    // get actual amount from booking
    const { data, error } = await supabaseClient.from('bookings').select(`gross_amount`).eq('id', bookingId).single();

    if(error){
      return new Response(JSON.stringify({
        error: error.message
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }


    // create order and generate unique url for client to pay
    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: INTENT.AUTHORIZE == intent ? "AUTHORIZE" : "CAPTURE",
        purchase_units: [
          {
            reference_id: bookingId,
            custom_id: bookingId,
            amount: {
              currency_code: "USD",
              value: data.gross_amount
            }
          }
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: appName,
              landing_page: "NO_PREFERENCE",
              // user_action: "PAY_NOW",
              return_url: `${CLIENT_BASEURL}/vendor/bookings/${bookingId}/confirmation?intent=${intent}`,
              cancel_url: `${CLIENT_BASEURL}/vendor/bookings`
            }
          }
        }
      })
    });
    if (!orderRes.ok) {
      throw new Error(orderRes.statusText);
    }
    const orderData = await orderRes.json();
    return new Response(JSON.stringify(orderData), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error("Error creating PayPal order:", err);
    return new Response(JSON.stringify({
      error: "Failed to create order"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
