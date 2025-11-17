// supabase/functions/capture-paypal-order/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_API_CLIENT");
const PAYPAL_SECRET = Deno.env.get("PAYPAL_API_SECRET");
const PAYPAL_BASE = Deno.env.get("PAYPAL_API");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const SUPABASEURL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function insertPayment(event, supabase) {
  const resource = event.purchase_units[0];
  const capture = resource.payments.captures[0];
  const provider = "paypal";
  const provider_event_id = event.id;
  const status = "completed";
  const amount = capture ? Number(capture.amount.value) : null;
  const currency = capture ? capture.amount.currency_code : null;
  const metadata = capture;
  const payload = {
    booking_id: capture.custom_id,
    provider,
    provider_payment_id: capture.id,
    provider_event_id,
    status,
    amount,
    currency,
    raw_payload: event,
    metadata,
    processed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("payments")
    .upsert(payload, {
      onConflict: "provider,provider_payment_id"
    })
    .select();
  if (error) throw error;
  return {
    data,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }
  try {

    const supabase = createClient(
      SUPABASEURL ?? "",
      SUPABASE_SERVICE_ROLE_KEY ?? "",
    );
    // grab token on redirect after payment
    const { token } = await req.json();
    if (!token) {
      return new Response(
        JSON.stringify({
          error: "Missing token",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    // verify payment against paypal API using token and credentials
    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`);
    const res = await fetch(
      `${PAYPAL_BASE}/v2/checkout/orders/${token}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err);
    }
    const data = await res.json();

    const access_token = req.headers
      .get("Authorization")
      ?.replace("Bearer ", "");

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
    


    const bookingId = data.purchase_units?.[0]?.reference_id;

    // no booking, nothing to update. we can track that via webhook

    if (bookingId) {

      await insertPayment(data, supabase);


      if (data.status == "COMPLETED") {
        const { error, data: paymentConfirmed } = await supabaseClient.rpc(
          "simulate_payment_success",
          {
            p_booking_id: bookingId,
          }
        );

        if (error) {
          console.error(
            "Error simulating payment success for payment capture",
            error
          );
          return new Response(
            JSON.stringify({
              message: "Error simulating payment success",
            }),
            {
              status: 400,
            }
          );
        }
      } else {
        const { error, data: failedRes } = await supabaseClient.rpc(
          "simulate_payment_failure",
          {
            p_booking_id: bookingId,
          }
        );
        if (error) {
          console.error("Error simulating payment cancelled", error);
          return new Response(
            JSON.stringify({
              error: "Error simulating payment cancelled",
            }),
            {
              status: 200,
            }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        message:
          data.status == "COMPLETED"
            ? "Booking approved successfully"
            : "Booking rejected successfully",
      }),
      {
        status: 200,

        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Error verifying payment", err);
    return new Response(
      JSON.stringify({
        error: "Failed to verify payment",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
