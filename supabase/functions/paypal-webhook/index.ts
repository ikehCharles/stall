export const config = {
  auth: false
};
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const PAYPAL_WEBHOOK_ID = Deno.env.get('PAYPAL_WEBHOOK_ID');
const PAYPAL_API_BASE = Deno.env.get('PAYPAL_API');
const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_API_CLIENT');
const PAYPAL_SECRET = Deno.env.get('PAYPAL_API_SECRET');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false
  }
});
const PAYPAL_WEBHOOK_EVENTS = {
  paymentCaptureCompleted: 'PAYMENT.CAPTURE.COMPLETED',
  checkoutOrderApproved: 'CHECKOUT.ORDER.APPROVED'
  
}
async function getPaypalAccessToken() {
  const creds = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`);
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Failed to get PayPal token: ' + text);
  }
  const j = await res.json();
  return j.access_token;
}
async function verifyPaypalWebhook(rawBody, headers) {
  const accessToken = await getPaypalAccessToken();
  const transmissionId = headers.get('paypal-transmission-id');
  const transmissionTime = headers.get('paypal-transmission-time');
  const certUrl = headers.get('paypal-cert-url');
  const authAlgo = headers.get('paypal-auth-algo');
  const transmissionSig = headers.get('paypal-transmission-sig');
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return false;
  }
  const payload = JSON.parse(rawBody);
  const verifyRes = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: payload
    })
  });
  if (!verifyRes.ok) return false;
  const jr = await verifyRes.json();
  return jr.verification_status === 'SUCCESS';
}
async function upsertPayment(event) {
  const resource = event.resource || {};
  const provider = 'paypal';
  const provider_payment_id = resource.id || resource.sale_id || resource.billing_agreement_id || null;
  const provider_event_id = event.id;
  const statusRaw = (resource.state || resource.status || event.event_type || '').toString();
  const status = statusRaw.toLowerCase();
  const amount = resource.amount?.total ? Number(resource.amount.total) : null;
  const currency = resource.amount?.currency || resource.amount?.currency_code || null;
  const metadata = resource;
  const payload = {
    booking_id: resource.custom_id,
    provider,
    provider_payment_id: provider_payment_id || provider_event_id,
    provider_event_id,
    status,
    amount,
    currency,
    raw_payload: event,
    metadata,
    processed_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from('payments').upsert(payload, {
    onConflict: [
      'provider',
      'provider_payment_id'
    ]
  }).select();
  if (error) throw error;
  return {
    data
  };
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const rawBody = await req.text();
    const headers = req.headers;
    // validate paypal webhook event
    const valid = await verifyPaypalWebhook(rawBody, headers);
    if (!valid) {
      console.error(valid, 'invalid webhook signature');
      return new Response(JSON.stringify({
        error: 'invalid webhook signature'
      }), {
        status: 200
      });
    }
    const event = JSON.parse(rawBody);

    // update payment table
    await upsertPayment(event);
    const eventType = (event.event_type || '').toString();
    const resource = event.resource || {};
    const status = (resource.state || resource.status || eventType || '').toString().toLowerCase();
    // verify payment status and update booking
    if (status.includes('completed') || status.includes('succeeded') || eventType === 'PAYMENT.SALE.COMPLETED') {
      // For checkoutOrderApproved, simulate payment success and update booking status as success and payment status as pending
      if (event.event_type === PAYPAL_WEBHOOK_EVENTS.checkoutOrderApproved) {
        const { error } = await supabase.rpc('simulate_payment_success_admin', {
          p_booking_id: resource?.purchase_units?.[0].custom_id
        });
        if (error) {
          console.error('Error simulating payment success', error);
          return new Response(JSON.stringify({
            error: 'Error simulating payment failure for payment success'
          }), {
            status: 200
          });
        }
      }
      // For paymentCaptureCompleted, simulate payment success and update booking status as success and payment status as completed
      if (event.event_type === PAYPAL_WEBHOOK_EVENTS.paymentCaptureCompleted) {
        const { error } = await supabase.rpc('simulate_payment_confirmed_admin', {
          p_booking_id: resource.custom_id
        });
        if (error) {
          console.error('Error simulating payment success for payment capture', error);
          return new Response(JSON.stringify({
            error: 'Error simulating payment failure'
          }), {
            status: 200
          });
        }
      }
      // On any failure event, simulate payment failure
    } else if (status.includes('failed') || status.includes('denied') || eventType.includes('FAILED')) {
      const { error } = await supabase.rpc('simulate_payment_failure', {
        p_booking_id: resource.custom_id
      });
      if (error) {
        console.error('Error simulating payment failure', error);
        return new Response(JSON.stringify({
          error: 'Error simulating payment failure'
        }), {
          status: 200
        });
      }
    }
    return new Response(JSON.stringify({
      ok: true
    }), {
      status: 200
    });
  } catch (err) {
    console.error("UnknownError", err);
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500
    });
  }
});
