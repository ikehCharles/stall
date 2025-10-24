// supabase/functions/create-paypal-order/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_API_CLIENT");
const PAYPAL_SECRET = Deno.env.get("PAYPAL_API_SECRET");
const PAYPAL_BASE = Deno.env.get("PAYPAL_API");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // grab token on redirect after payment
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({
        error: "Missing token"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // verify payment against paypal API using token and credentials
    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`);
    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${token}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
    if (!res.ok) {
      throw new Error(res.statusText);
    }
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error("Error verifying payment", err);
    return new Response(JSON.stringify({
      error: "Failed to verify payment"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
