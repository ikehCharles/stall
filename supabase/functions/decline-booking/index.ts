import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_API_CLIENT");
const PAYPAL_SECRET = Deno.env.get("PAYPAL_API_SECRET");
const PAYPAL_BASE = Deno.env.get("PAYPAL_API");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── PayPal helpers ──────────────────────────────────────────

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

// ── Supported actions ───────────────────────────────────────
type Action = "cancel" | "request_refund" | "approve_refund" | "reject_refund";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const jsonResponse = (status: number, data: Record<string, unknown>) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, reason, action } = await req.json() as {
      bookingId: string;
      reason?: string;
      action: Action;
    };

    if (!bookingId) return jsonResponse(400, { error: "Missing bookingId" });
    if (!action) return jsonResponse(400, { error: "Missing action" });

    // ── Authenticate ──────────────────────────────────────────
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

    // ── Check permissions via has_permissions RPC ─────────────
    const permissionsNeeded: Record<Action, string[]> = {
      cancel: ["bookings.manage"],
      request_refund: ["refunds.request"],
      approve_refund: ["refunds.approve"],
      reject_refund: ["refunds.approve"],
    };

    const { data: hasPerms } = await supabase.rpc("has_permissions", {
      user_uuid: user.id,
      permissions: permissionsNeeded[action],
      match_all: true,
    });

    if (!hasPerms) {
      return jsonResponse(403, {
        error: `Insufficient permissions. Required: ${permissionsNeeded[action].join(", ")}`,
      });
    }

    // ── Fetch booking ─────────────────────────────────────────
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        "id, status, payment_status, total_amount, gross_amount, paid_amount, refund_status, refund_reason, invoice_number"
      )
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking)
      return jsonResponse(404, { error: "Booking not found" });

    // ════════════════════════════════════════════════════════════
    // ACTION: CANCEL
    // Sets booking_status → cancelled. Payment status stays same.
    // No refund processing here.
    // ════════════════════════════════════════════════════════════
    if (action === "cancel") {
      if (booking.status === "cancelled") {
        return jsonResponse(400, { error: "Booking is already cancelled" });
      }

      const previousStatus = booking.status;

      // Cancel the booking but keep payment_status as-is
      await supabase
        .from("bookings")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", bookingId);

      // Release booking_dates
      await supabase.from("booking_dates").delete().eq("booking_id", bookingId);

      // Release stall holds
      const { data: stallRows } = await supabase
        .from("booking_stalls")
        .select("stall_instance_id")
        .eq("booking_id", bookingId);

      if (stallRows && stallRows.length > 0) {
        const instanceIds = stallRows.map((r: { stall_instance_id: string }) => r.stall_instance_id);
        await supabase.from("stall_holds").delete().in("stall_instance_id", instanceIds);
      }

      // Audit log
      await supabase.rpc("log_audit_entry", {
        p_table_name: "bookings",
        p_record_id: bookingId,
        p_action: "booking_cancelled",
        p_performed_by: user.id,
        p_from_status: previousStatus,
        p_to_status: "cancelled",
        p_reason: reason || "No reason provided",
        p_metadata: JSON.stringify({
          payment_status: booking.payment_status,
          total_amount: booking.total_amount,
        }),
      });

      return jsonResponse(200, {
        status: "cancelled",
        message: "Booking has been cancelled.",
      });
    }

    // ════════════════════════════════════════════════════════════
    // ACTION: REQUEST_REFUND
    // Pre-conditions: booking cancelled, payment success, no refund yet
    // Sets refund_status → requested. Sends notification.
    // ════════════════════════════════════════════════════════════
    if (action === "request_refund") {
      if (!reason) {
        return jsonResponse(400, { error: "A reason is required to request a refund" });
      }
      if (booking.status !== "cancelled") {
        return jsonResponse(400, { error: "Booking must be cancelled before requesting a refund" });
      }
      if (booking.payment_status !== "success") {
        return jsonResponse(400, { error: "No successful payment found for this booking" });
      }
      if (booking.refund_status != null) {
        return jsonResponse(400, {
          error: `A refund has already been ${booking.refund_status} for this booking`,
        });
      }

      await supabase
        .from("bookings")
        .update({ refund_status: "requested", refund_reason: reason })
        .eq("id", bookingId);

      // Audit log
      await supabase.rpc("log_audit_entry", {
        p_table_name: "bookings",
        p_record_id: bookingId,
        p_action: "refund_requested",
        p_performed_by: user.id,
        p_from_status: null,
        p_to_status: "requested",
        p_reason: reason,
        p_metadata: JSON.stringify({
          total_amount: booking.total_amount,
          payment_status: booking.payment_status,
        }),
      });

      // ── Send notification to admins with refund approval permission ──
      try {
        const { data: recipients } = await supabase.rpc(
          "get_notification_recipients",
          { p_notification_type: "refund_requested" }
        );

        if (recipients && recipients.length > 0) {
          const notifications = recipients.map(
            (r: { user_id: string; email: string }) => ({
              recipient_id: r.user_id,
              recipient_email: r.email,
              type: "refund_requested",
              title: "Refund Requested",
              body: `A refund has been requested for booking ${booking.invoice_number}. Reason: ${reason}`,
              metadata: {
                booking_id: bookingId,
                invoice_number: booking.invoice_number,
                total_amount: booking.total_amount,
                reason,
                requested_by: user.id,
              },
              idempotency_key: `refund_requested:${bookingId}:${new Date().toISOString()}:${crypto.randomUUID()}`,
            })
          );

          await supabase.from("notifications").insert(notifications);
        }
      } catch (notifyErr) {
        // Don't fail the request if notification fails
        console.error("Failed to dispatch refund_requested notification:", notifyErr);
      }

      return jsonResponse(200, {
        status: "requested",
        message: "Refund request submitted for approval.",
      });
    }

    // ════════════════════════════════════════════════════════════
    // ACTION: REJECT_REFUND
    // Pre-condition: refund_status = requested
    // Sets refund_status → rejected
    // ════════════════════════════════════════════════════════════
    if (action === "reject_refund") {
      if (booking.refund_status !== "requested") {
        return jsonResponse(400, { error: "No pending refund request to reject" });
      }

      await supabase
        .from("bookings")
        .update({ refund_status: "rejected", refund_reason: reason || null })
        .eq("id", bookingId);

      await supabase.rpc("log_audit_entry", {
        p_table_name: "bookings",
        p_record_id: bookingId,
        p_action: "refund_rejected",
        p_performed_by: user.id,
        p_from_status: "requested",
        p_to_status: "rejected",
        p_reason: reason || "No reason provided",
        p_metadata: JSON.stringify({
          original_reason: booking.refund_reason,
        }),
      });

      // Notify admins that the refund was rejected
      try {
        const { data: recipients } = await supabase.rpc(
          "get_notification_recipients",
          { p_notification_type: "refund_resolved" }
        );
        if (recipients && recipients.length > 0) {
          const notifications = recipients.map(
            (r: { user_id: string; email: string }) => ({
              recipient_id: r.user_id,
              recipient_email: r.email,
              type: "refund_resolved",
              title: "Refund Request Rejected",
              body: `The refund request for booking ${booking.invoice_number} has been rejected. Reason: ${reason || "No reason provided"}`,
              metadata: {
                booking_id: bookingId,
                invoice_number: booking.invoice_number,
                total_amount: booking.total_amount,
                outcome: "rejected",
                reason: reason || "No reason provided",
                resolved_by: user.id,
              },
              idempotency_key: `refund_resolved:${bookingId}:rejected:${new Date().toISOString()}:${crypto.randomUUID()}`,
            })
          );
          await supabase.from("notifications").insert(notifications);
        }
      } catch (notifyErr) {
        console.error("Failed to dispatch refund_resolved notification:", notifyErr);
      }

      return jsonResponse(200, {
        status: "rejected",
        message: "Refund request has been rejected.",
      });
    }

    // ════════════════════════════════════════════════════════════
    // ACTION: APPROVE_REFUND
    // Pre-condition: refund_status = requested
    // Executes the actual refund via provider. On success →
    // refund_status = completed. On failure → keeps requested.
    // ════════════════════════════════════════════════════════════
    if (action === "approve_refund") {
      if (booking.refund_status !== "requested") {
        return jsonResponse(400, { error: "No pending refund request to approve" });
      }
      if (!reason) {
        return jsonResponse(400, { error: "A reason is required to approve a refund" });
      }

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
          // PayPal captured → refund
          const result = await refundPayPalCapture(provider_payment_id);
          if (!result.ok) {
            console.error("PayPal refund failed:", result.data);

            // Log the failure but keep refund_status as 'requested'
            await supabase.rpc("log_audit_entry", {
              p_table_name: "bookings",
              p_record_id: bookingId,
              p_action: "refund_failed",
              p_performed_by: user.id,
              p_from_status: "requested",
              p_to_status: "requested",
              p_reason: reason,
              p_metadata: JSON.stringify({
                refund_method: "paypal_refund",
                error: result.data,
              }),
            });

            return jsonResponse(400, {
              error: "PayPal refund failed. Refund request remains pending.",
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
          // PayPal authorized → void
          const result = await voidPayPalAuthorization(provider_payment_id);
          if (!result.ok) {
            console.error("PayPal void failed:", result.data);

            await supabase.rpc("log_audit_entry", {
              p_table_name: "bookings",
              p_record_id: bookingId,
              p_action: "refund_failed",
              p_performed_by: user.id,
              p_from_status: "requested",
              p_to_status: "requested",
              p_reason: reason,
              p_metadata: JSON.stringify({
                refund_method: "paypal_void",
                error: result.data,
              }),
            });

            return jsonResponse(400, {
              error: "PayPal void failed. Refund request remains pending.",
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
          refundMethod = "cash";
          await supabase
            .from("payments")
            .update({ status: "refunded" })
            .eq("id", payment.id);
          await supabase.rpc("simulate_payment_refund_admin", {
            p_booking_id: bookingId,
          });
        } else if (provider === "zettle") {
          refundMethod = "zettle";
          await supabase
            .from("payments")
            .update({ status: "refunded" })
            .eq("id", payment.id);
          await supabase.rpc("simulate_payment_refund_admin", {
            p_booking_id: bookingId,
          });
        } else {
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
        // No active payment found — just mark completed
        refundMethod = "void";
        await supabase.rpc("simulate_payment_cancelled_admin", {
          p_booking_id: bookingId,
        });
      }

      // Mark refund as completed
      await supabase
        .from("bookings")
        .update({ refund_status: "completed", refund_reason: reason })
        .eq("id", bookingId);

      // Audit log
      await supabase.rpc("log_audit_entry", {
        p_table_name: "bookings",
        p_record_id: bookingId,
        p_action: "refund_completed",
        p_performed_by: user.id,
        p_from_status: "requested",
        p_to_status: "completed",
        p_reason: reason,
        p_metadata: JSON.stringify({
          refund_method: refundMethod,
          total_amount: booking.total_amount,
          payment_status: booking.payment_status,
          refund_details: refundDetails,
        }),
      });

      // Notify admins that the refund was approved
      try {
        const { data: recipients } = await supabase.rpc(
          "get_notification_recipients",
          { p_notification_type: "refund_resolved" }
        );
        if (recipients && recipients.length > 0) {
          const notifications = recipients.map(
            (r: { user_id: string; email: string }) => ({
              recipient_id: r.user_id,
              recipient_email: r.email,
              type: "refund_resolved",
              title: "Refund Approved & Processed",
              body: `The refund for booking ${booking.invoice_number} has been approved and processed via ${refundMethod}. Amount: ${booking.total_amount}`,
              metadata: {
                booking_id: bookingId,
                invoice_number: booking.invoice_number,
                total_amount: booking.total_amount,
                outcome: "approved",
                refund_method: refundMethod,
                reason,
                resolved_by: user.id,
              },
              idempotency_key: `refund_resolved:${bookingId}:approved:${new Date().toISOString()}:${crypto.randomUUID()}`,
            })
          );
          await supabase.from("notifications").insert(notifications);
        }
      } catch (notifyErr) {
        console.error("Failed to dispatch refund_resolved notification:", notifyErr);
      }

      const messages: Record<string, string> = {
        paypal_refund: "Refund approved. PayPal payment has been refunded.",
        paypal_void: "Refund approved. PayPal authorization has been voided.",
        cash: "Refund approved. Cash refund must be handled manually.",
        zettle: "Refund approved. POS refund must be processed at the terminal.",
        manual: "Refund approved. Refund must be handled manually.",
        void: "Refund approved and completed.",
      };

      return jsonResponse(200, {
        status: "completed",
        message: messages[refundMethod] || "Refund approved.",
        refund_method: refundMethod,
        refund_details: refundDetails,
      });
    }

    return jsonResponse(400, { error: `Unknown action: ${action}` });
  } catch (err) {
    console.error("Decline booking error:", err);
    return jsonResponse(500, {
      error: "Unexpected error",
      details: err?.message ?? String(err),
    });
  }
});
