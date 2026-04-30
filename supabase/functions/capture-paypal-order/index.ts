// supabase/functions/capture-paypal-order/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_API_CLIENT");
const PAYPAL_SECRET = Deno.env.get("PAYPAL_API_SECRET");
const PAYPAL_BASE = Deno.env.get("PAYPAL_API");
const SUPABASEURL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const TERMINAL_BOOKING_STATUSES = ["cancelled", "expired"];

interface PayPalCapture {
  id: string;
  custom_id: string;
  amount: { value: string; currency_code: string };
}

interface PayPalOrderResponse {
  id: string;
  status: string;
  purchase_units: Array<{
    reference_id?: string;
    custom_id?: string;
    payments: { captures: PayPalCapture[] };
  }>;
}

async function getOrderDetails(token: string, auth: string): Promise<PayPalOrderResponse> {
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${token}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error("Failed to fetch order details: " + (await res.text()));
  return res.json() as Promise<PayPalOrderResponse>;
}

async function insertPayment(event: PayPalOrderResponse, supabase: ReturnType<typeof createClient>) {
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
    .upsert(payload, { onConflict: "provider,provider_payment_id" })
    .select();
  if (error) throw error;
  return { data };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASEURL ?? "", SUPABASE_SERVICE_ROLE_KEY ?? "");

    const { token } = await req.json();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (typeof token !== "string" || !/^[A-Z0-9]{8,20}$/.test(token)) {
      return new Response(
        JSON.stringify({ error: "Invalid token format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`);

    // Fetch order details first so we can validate before charging
    const orderDetails = await getOrderDetails(token, auth);
    const bookingId =
      orderDetails.purchase_units?.[0]?.reference_id ||
      orderDetails.purchase_units?.[0]?.custom_id;

    if (bookingId) {
      // Guard: reject captures for cancelled/expired bookings before hitting PayPal
      const { data: booking } = await supabase
        .from("bookings")
        .select("status")
        .eq("id", bookingId)
        .single();

      if (booking && TERMINAL_BOOKING_STATUSES.includes(booking.status)) {
        return new Response(
          JSON.stringify({
            error: `Cannot capture payment: booking is ${booking.status}`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Idempotency: skip if we've already recorded a completed payment for this order
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("status")
        .eq("provider_event_id", orderDetails.id)
        .eq("status", "completed")
        .maybeSingle();

      if (existingPayment) {
        return new Response(
          JSON.stringify({ message: "Payment already processed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Capture the payment
    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${token}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(JSON.stringify(err));
    }

    const data = await res.json() as PayPalOrderResponse;

    if (bookingId) {
      await insertPayment(data, supabase);

      if (data.status === "COMPLETED") {
        const { error } = await supabase.rpc("simulate_payment_success_admin", {
          p_booking_id: bookingId,
        });

        if (error) {
          return new Response(
            JSON.stringify({ message: "Error simulating payment success" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        const { error } = await supabase.rpc("simulate_payment_failure_admin", {
          p_booking_id: bookingId,
        });
        if (error) {
          return new Response(
            JSON.stringify({ error: "Error simulating payment cancelled" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        message:
          data.status === "COMPLETED"
            ? "Booking approved successfully"
            : "Booking rejected successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (_err) {
    return new Response(
      JSON.stringify({ error: "Failed to verify payment" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
