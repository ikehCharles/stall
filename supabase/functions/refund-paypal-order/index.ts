// supabase/functions/refund-paypal-order/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_API_CLIENT");
const PAYPAL_SECRET = Deno.env.get("PAYPAL_API_SECRET");
const PAYPAL_BASE = Deno.env.get("PAYPAL_API");

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  const supabase = createClient(
    SUPABASEURL ?? "",
    SUPABASE_SERVICE_ROLE_KEY ?? ""
  );

  try {
    const { bookingId } = await req.json();

    if (!bookingId) return responseJSON(400, { error: "Missing field(s)" });

    // Get PayPal Access Token (same credentials you already use)
    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`);

    // check if authorized payment exists for the booking
    const { data: existingPayment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("booking_id", bookingId)
      .eq("status", "completed")
      .single();
    if (paymentError || !existingPayment) {
      return responseJSON(400, {
        message: "No authorized payment found for this booking",
      });
    }

    const capture_id = existingPayment.provider_payment_id;

    const refundRes = await fetch(
      `${PAYPAL_BASE}/v2/payments/captures/${capture_id}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    const refundData = await refundRes.json();

    if (!refundRes.ok) {
      if (
        refundData.name === "UNPROCESSABLE_ENTITY" &&
        refundData.details?.[0]?.issue === "CAPTURE_FULLY_REFUNDED"
      ) {
        return new Response(
          JSON.stringify({ message: "Capture already fully refunded" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.error("Refund failed:", refundData);
      return new Response(
        JSON.stringify({ error: "Refund failed", details: refundData }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Supabase client with SR key
    const access_token = req.headers
      .get("Authorization")
      ?.replace("Bearer ", "");

    const supabaseClient = createClient(
      SUPABASEURL ?? "",
      SUPABASE_SERVICE_ROLE_KEY ?? "",
      {
        global: {
          headers: { Authorization: `Bearer ${access_token}` },
        },
      }
    );

    const { error: refundError, data } = await supabaseClient.rpc(
      "simulate_payment_refund",
      {
        p_booking_id: bookingId,
      }
    );


    if (refundError) {
      console.error("Error simulating refund:", refundError);
      return new Response(
        JSON.stringify({ error: "Failed to update refund status" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        message: "Refund processed successfully",
        refund: refundData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Refund error:", err);
    return new Response(
      JSON.stringify({
        error: "Unexpected refund error",
        details: err?.message ?? err,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
