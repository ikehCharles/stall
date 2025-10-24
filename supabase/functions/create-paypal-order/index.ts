// supabase/functions/create-paypal-order/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(SUPABASEURL ?? '', SUPABASE_SERVICE_ROLE_KEY ?? '');
    const { amount, bookingId } = await req.json();
    if (!amount || !bookingId) {
      return new Response(JSON.stringify({
        error: "Missing fields"
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    // get access token to create order
    const accessToken = await getAccessToken();

    // get actual amount from booking
    const { data } = await supabaseClient.from('bookings').select(`amount`).eq('id', bookingId).single();

    console.warn(data, "data");
    // create order and generate unique url for client to pay
    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: bookingId,
            custom_id: bookingId,
            amount: {
              currency_code: "USD",
              value: data.amount
            }
          }
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "Example Inc.",
              landing_page: "NO_PREFERENCE",
              user_action: "PAY_NOW",
              return_url: `${CLIENT_BASEURL}/vendor/bookings/${bookingId}/confirmation`,
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
