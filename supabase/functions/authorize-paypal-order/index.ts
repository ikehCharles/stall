// supabase/functions/authorize-paypal-order/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

async function upsertPayment(event, supabase) {
  const resource = event.purchase_units[0];
  const authorization = resource.payments.authorizations[0];
  const provider = "paypal";
  const provider_event_id = event.id;
  const status = "authorized";
  const amount = authorization ? Number(authorization.amount.value) : null;
  const currency = authorization ? authorization.amount.currency_code : null;
  const metadata = authorization;
  const payload = {
    booking_id: resource.reference_id,
    provider,
    provider_payment_id: authorization.id,
    provider_event_id,
    status,
    amount,
    currency,
    raw_payload: authorization,
    metadata,
    processed_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("payments")
    .upsert(payload, {
      onConflict: ["provider", "provider_payment_id"],
    })
    .select();
  if (error) throw error;
  return {
    data,
  };
}

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

  const supabaseClient = createClient(
    SUPABASEURL ?? "",
    SUPABASE_SERVICE_ROLE_KEY ?? ""
  );

  try {
    // grab token on redirect after payment
    const { orderID } = await req.json();
    if (!orderID) return responseJSON(400, { error: "Missing order ID" });
    if (typeof orderID !== "string" || !/^[A-Z0-9]{8,20}$/.test(orderID)) {
      return responseJSON(400, { error: "Invalid order ID format" });
    }

    // verify payment against paypal API using token and credentials
    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`);
    const res = await fetch(
      `${PAYPAL_BASE}/v2/checkout/orders/${orderID}/authorize`,
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
      if (
        res.status === 422 &&
        err.details?.[0]?.issue === "ORDER_ALREADY_AUTHORIZED"
      ) {
        return responseJSON(200, { message: "Booking already reserved" });
      }

      throw new Error(err);
    }

    const data = await res.json();

    if (!data?.purchase_units.length) {
      return responseJSON(400, {
        error: "No purchase units found",
      });
    }
    if (!data?.purchase_units?.[0].payments?.authorizations.length) {
      return responseJSON(400, {
        error: "Authorization not found in response",
      });
    }

    await upsertPayment(data, supabaseClient);

    const bookingId = data.purchase_units[0].reference_id;

    // change booking status to "reserved" in bookings table
    const { error: bookingError } = await supabaseClient
      .from("bookings")
      .update({
        status: "reserved",
        payment_status: "authorized",
      })
      .eq("id", bookingId);

    if (bookingError) {
      return responseJSON(400, { error: bookingError.message });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("Error authorizing payment", err);
    return new Response(
      JSON.stringify({
        error: "Failed to authorize payment",
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
