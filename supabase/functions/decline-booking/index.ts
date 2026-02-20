import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_API_CLIENT");
const PAYPAL_SECRET = Deno.env.get("PAYPAL_API_SECRET");
const PAYPAL_BASE = Deno.env.get("PAYPAL_API");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getPayPalAuth(): string {
  return btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`);
}

async function refundPayPalCapture(
  captureId: string
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const auth = getPayPalAuth();
  const res = await fetch(
    `${PAYPAL_BASE}/v2/payments/captures/${captureId}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  const data = await res.json();

  if (
    !res.ok &&
    data.name === "UNPROCESSABLE_ENTITY" &&
    data.details?.[0]?.issue === "CAPTURE_FULLY_REFUNDED"
  ) {
    return { ok: true, data: { message: "Already refunded" } };
  }

  return { ok: res.ok, data };
}

async function voidPayPalAuthorization(
  authorizationId: string
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const auth = getPayPalAuth();
  const res = await fetch(
    `${PAYPAL_BASE}/v2/payments/authorizations/${authorizationId}/void`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (res.ok || res.status === 204) {
    return { ok: true, data: { message: "Authorization voided" } };
  }

  const data = await res.json().catch(() => ({}));
  return { ok: false, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();
    if (!bookingId) return jsonResponse(400, { error: "Missing bookingId" });

    // Authenticate the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse(401, { error: "Unauthorized" });

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user)
      return jsonResponse(401, { error: "Unauthorized" });

    // Service role client for privileged operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Permission check
    const { data: hasPerm } = await supabase.rpc("has_permission", {
      user_uuid: user.id,
      permission_key: "bookings.manage",
    });
    if (!hasPerm)
      return jsonResponse(403, { error: "Admin access required" });

    // Fetch booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, status, payment_status, total_amount, gross_amount, paid_amount")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking)
      return jsonResponse(404, { error: "Booking not found" });

    if (booking.status === "cancelled")
      return jsonResponse(400, { error: "Booking is already cancelled" });

    // Find the most recent active payment record
    const { data: payment } = await supabase
      .from("payments")
      .select("id, provider, provider_payment_id, status, amount")
      .eq("booking_id", bookingId)
      .in("status", ["completed", "authorized"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let refundMethod = "void";
    let refundDetails: Record<string, unknown> | null = null;

    if (payment) {
      const { provider, status: paymentStatus, provider_payment_id } = payment;

      if (provider === "paypal" && paymentStatus === "completed") {
        // PayPal captured payment → refund via PayPal API
        const result = await refundPayPalCapture(provider_payment_id);
        if (!result.ok) {
          console.error("PayPal refund failed:", result.data);
          return jsonResponse(400, {
            error: "PayPal refund failed",
            details: result.data,
          });
        }
        refundMethod = "paypal_refund";
        refundDetails = result.data;

        await supabase
          .from("payments")
          .update({ status: "refunded" })
          .eq("id", payment.id);

        await supabase.rpc("simulate_payment_refund_admin", {
          p_booking_id: bookingId,
        });
      } else if (provider === "paypal" && paymentStatus === "authorized") {
        // PayPal authorized payment → void via PayPal API
        const result = await voidPayPalAuthorization(provider_payment_id);
        if (!result.ok) {
          console.error("PayPal void failed:", result.data);
          return jsonResponse(400, {
            error: "PayPal void failed",
            details: result.data,
          });
        }
        refundMethod = "paypal_void";
        refundDetails = result.data;

        await supabase
          .from("payments")
          .update({ status: "cancelled" })
          .eq("id", payment.id);

        await supabase.rpc("simulate_payment_cancelled_admin", {
          p_booking_id: bookingId,
        });
      } else if (provider === "cash") {
        // Cash payment → DB-only (physical cash refund handled manually)
        refundMethod = "cash";

        await supabase
          .from("payments")
          .update({ status: "refunded" })
          .eq("id", payment.id);

        await supabase.rpc("simulate_payment_refund_admin", {
          p_booking_id: bookingId,
        });
      } else if (provider === "zettle") {
        // Zettle POS payment → DB-only (terminal refund handled manually)
        refundMethod = "zettle";

        await supabase
          .from("payments")
          .update({ status: "refunded" })
          .eq("id", payment.id);

        await supabase.rpc("simulate_payment_refund_admin", {
          p_booking_id: bookingId,
        });
      } else {
        // Unknown provider → treat as manual refund
        refundMethod = "manual";

        await supabase
          .from("payments")
          .update({ status: "refunded" })
          .eq("id", payment.id);

        await supabase.rpc("simulate_payment_refund_admin", {
          p_booking_id: bookingId,
        });
      }
    } else {
      // No active payment record → simple cancel
      refundMethod = "void";
      await supabase.rpc("simulate_payment_cancelled_admin", {
        p_booking_id: bookingId,
      });
    }

    const messages: Record<string, string> = {
      paypal_refund: "Booking declined. PayPal payment has been refunded.",
      paypal_void: "Booking declined. PayPal authorization has been voided.",
      cash: "Booking declined. Cash refund must be handled manually.",
      zettle:
        "Booking declined. POS refund must be processed at the terminal.",
      manual: "Booking declined. Refund must be handled manually.",
      void: "Booking declined successfully.",
    };

    return jsonResponse(200, {
      status: "success",
      message: messages[refundMethod] || "Booking declined.",
      refund_method: refundMethod,
      refund_details: refundDetails,
    });
  } catch (err) {
    console.error("Decline booking error:", err);
    return jsonResponse(500, {
      error: "Unexpected error",
      details: err?.message ?? String(err),
    });
  }
});
