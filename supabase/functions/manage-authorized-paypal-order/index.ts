// supabase/functions/manage-authorized-paypal-order/index.ts
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

const responseJSON = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

enum INTENT {
  AUTHORIZE,
  CAPTURE,
  VOID,
}

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
    const { action, bookingId } = await req.json();
    if (!bookingId || !action)
      return responseJSON(400, { error: "Missing fields" });

    // check if authorized payment exists for the booking
    const { data: existingPayment, error: paymentError } = await supabaseClient
      .from("payments")
      .select("*")
      .eq("booking_id", bookingId)
      .eq("status", "authorized")
      .single();
    if (paymentError || !existingPayment) {
      return responseJSON(400, {
        message: "No authorized payment found for this booking",
      });
    }

    const authorizationId = existingPayment.provider_payment_id;

    const { expiration_time } = existingPayment.raw_payload;
    // confirm authorized payment isn't expired
    if (!expiration_time || new Date(expiration_time) < new Date()) {
      return responseJSON(400, { error: "Authorized payment has expired" });
    }

    // fetch booking
    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return responseJSON(400, { message: "Booking not found" });
    }
    // check if booking is reserved
    if (booking.status !== "reserved") {
      return responseJSON(400, {
        message: "Booking is not reserved",
      });
    }

    // verify if booking amount is same as authorized amount
    if (Number(booking.total_amount) !== Number(existingPayment.amount)) {
      return responseJSON(400, {
        message: "Booking amount does not match authorized amount",
      });
    }

    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`);
    const url = `${PAYPAL_BASE}/v2/payments/authorizations/${authorizationId}/${
      action == INTENT.VOID ? "void" : "capture"
    }`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error("PayPal authorization action error", res);
      throw new Error(res.statusText);
    }

    // change payment status to "approved"  in bookings table
    const { error: paymentUpdateError } = await supabaseClient
      .from("payments")
      .update({
        status: action == INTENT.VOID ? "cancelled" : "success",
      })
      .eq("id", existingPayment.id);

    if (paymentUpdateError) {
      return responseJSON(400, { error: paymentUpdateError.message });
    }

    if (action != INTENT.VOID) {
      const { error, data } = await supabaseClient.rpc(
        "simulate_payment_confirmed_admin",
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
      const { error, data } = await supabaseClient.rpc(
        "simulate_payment_cancelled_admin",
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

    return new Response(
      JSON.stringify({
        message:
          action == INTENT.CAPTURE
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
