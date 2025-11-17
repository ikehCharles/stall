export const config = { auth: false };

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PAYPAL_WEBHOOK_ID = Deno.env.get("PAYPAL_WEBHOOK_ID");
const PAYPAL_API_BASE = Deno.env.get("PAYPAL_API");
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_API_CLIENT");
const PAYPAL_SECRET = Deno.env.get("PAYPAL_API_SECRET");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

enum PAYPAL_EVENT {
  created = "created",
  approved = "approved",
  authorized = "authorized",
  completed = "completed",
  failed = "failed",
  voided = "voided",
  reversed = "reversed",
}

// Map PayPal events to internal payment status
const statusRank: Record<string, number> = {
  [PAYPAL_EVENT.created]: 1,
  [PAYPAL_EVENT.approved]: 2,
  [PAYPAL_EVENT.authorized]: 3,
  [PAYPAL_EVENT.completed]: 4,
  [PAYPAL_EVENT.failed]: 99,
  [PAYPAL_EVENT.voided]: 100,
  [PAYPAL_EVENT.reversed]: 100,
};

function mapPayPalEventToStatus(event: any): string | null {
  switch (event.event_type) {
    case "CHECKOUT.ORDER.APPROVED":
      return PAYPAL_EVENT.approved;
    case "PAYMENT.AUTHORIZATION.CREATED":
      return PAYPAL_EVENT.authorized;
    case "PAYMENT.CAPTURE.COMPLETED":
    case "PAYMENT.ORDER.COMPLETED":
      return PAYPAL_EVENT.completed;
    case "PAYMENT.AUTHORIZATION.VOIDED":
      return PAYPAL_EVENT.voided;
    case "PAYMENT.CAPTURE.DENIED":
    case "PAYMENT.ORDER.FAILED":
      return PAYPAL_EVENT.failed;
    case "PAYMENT.CAPTURE.REVERSED":
      return PAYPAL_EVENT.reversed;
    default:
      return null;
  }
}

async function getPaypalAccessToken() {
  const creds = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`);
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok)
    throw new Error("Failed to get PayPal token: " + (await res.text()));
  const j = await res.json();
  return j.access_token;
}

async function verifyPaypalWebhook(
  rawBody: string,
  headers: Headers
): Promise<boolean> {
  const accessToken = await getPaypalAccessToken();
  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");
  const transmissionSig = headers.get("paypal-transmission-sig");

  if (
    !transmissionId ||
    !transmissionTime ||
    !certUrl ||
    !authAlgo ||
    !transmissionSig
  )
    return false;

  const payload = JSON.parse(rawBody);
  const verifyRes = await fetch(
    `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: payload,
      }),
    }
  );

  if (!verifyRes.ok) return false;
  const jr = await verifyRes.json();
  return jr.verification_status === "SUCCESS";
}

async function upsertPayment(event: any, mappedStatus: string) {
  const resource = event.resource || {};
  const purchaseUnit = resource.purchase_units?.[0] || {};
  const provider = "paypal";
  const provider_payment_id =
    resource.id || resource.sale_id || resource.billing_agreement_id || null;
  const provider_event_id = event.id;
  const amount = purchaseUnit.amount?.value
    ? Number(purchaseUnit.amount.value)
    : resource?.amount?.value
    ? Number(resource?.amount?.value)
    : null;
  const currency = purchaseUnit.amount?.currency_code
    ? purchaseUnit.amount?.currency_code
    : resource?.amount?.currency_code
    ? resource?.amount?.currency_code
    : null;

  const bookingId = resource.custom_id || purchaseUnit.custom_id;
  const payload = {
    booking_id: bookingId,
    provider,
    provider_payment_id: provider_payment_id || provider_event_id,
    provider_event_id,
    status: mappedStatus,
    amount,
    currency,
    raw_payload: event,
    metadata: resource,
    processed_at: new Date().toISOString(),
  };


  const { data, error } = await supabase
    .from("payments")
    .upsert(payload, {
      onConflict: ["provider", "provider_payment_id"],
    })
    .select();


  if (error) throw error;
  return data;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const headers = req.headers;

    // Validate webhook
    const valid = await verifyPaypalWebhook(rawBody, headers);
    if (!valid)
      return new Response(
        JSON.stringify({ error: "invalid webhook signature" }),
        { status: 200 }
      );

    const event = JSON.parse(rawBody);
    const incomingStatus = mapPayPalEventToStatus(event);
    if (!incomingStatus) return new Response("Ignored event", { status: 200 });

    const resource = event.resource || {};
    const bookingId =
      resource.custom_id || resource.purchase_units?.[0]?.custom_id;


    // Fetch current payment status
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("status")
      .eq("provider_payment_id", resource.id || resource.sale_id)
      .single();


    if (paymentError && paymentError.code !== "PGRST116") {
      // PGRST116 = not found
      console.error("Error fetching payment:", paymentError);
      return new Response("Error fetching payment", { status: 400 });
    }

    const currentStatus = payment?.status || "created";
    const currentRank = statusRank[currentStatus] || 0;
    const incomingRank = statusRank[incomingStatus] || 0;

    if (incomingRank <= currentRank) {
      console.error(
        `Ignoring past event: current status "${currentStatus}" >= incoming "${incomingStatus}"`
      );
      return new Response("Payment processed already", { status: 200 }); // exit early, do not update or record
    }

    // Upsert payment
    await upsertPayment(event, incomingStatus);

    // Update booking status according to the payment event
    if ([`${PAYPAL_EVENT.completed}`].includes(incomingStatus)) {
      const { error, data } = await supabase.rpc(
        "simulate_payment_success_admin",
        {
          p_booking_id: bookingId,
        }
      );

      if (error)
        throw new Error(
          `RPC 'simulate_payment_success_admin' failed: ${error.message}`
        );
    } else if ([`${PAYPAL_EVENT.authorized}`].includes(incomingStatus)) {
      const { error, data } = await supabase.rpc(
        "simulate_payment_reserved_admin",
        {
          p_booking_id: bookingId,
        }
      );

      if (error)
        throw new Error(
          `RPC simulate_payment_reserved_admin failed: ${error.message}`
        );
    } else if ([`${PAYPAL_EVENT.voided}`].includes(incomingStatus)) {
      const { error, data } = await supabase.rpc(
        "simulate_payment_cancelled_admin",
        {
          p_booking_id: bookingId,
        }
      );

      if (error)
        throw new Error(
          `RPC simulate_payment_cancelled_admin failed: ${error.message}`
        );
    } else if ([`${PAYPAL_EVENT.reversed}`].includes(incomingStatus)) {
      const { error, data } = await supabase.rpc(
        "simulate_payment_refund_admin",
        {
          p_booking_id: bookingId,
        }
      );

      if (error)
        throw new Error(
          `RPC simulate_payment_refund_admin failed: ${error.message}`
        );
    } else if ([`${PAYPAL_EVENT.failed}`].includes(incomingStatus)) {
      const { error, data } = await supabase.rpc(
        "simulate_payment_failure_admin",
        {
          p_booking_id: bookingId,
        }
      );

      if (error)
        throw new Error(
          `RPC simulate_payment_failure_admin failed: ${error.message}`
        );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("WebhookHandlerError:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
