// supabase/functions/sync-zettle-payments/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const PROVIDER = 'zettle'
const ZETTLE_CLIENT_ID = Deno.env.get("ZETTLE_CLIENT_ID");
const ZETTLE_CLIENT_SECRET = Deno.env.get("ZETTLE_CLIENT_SECRET");
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

const cached = {
  token: null as string | null,
  expiresAt: 0,
};

export async function getZettleAccessToken(): Promise<string> {
  const now = Date.now();
  if (cached.token && cached.expiresAt > now + 5000) {
    return cached.token;
  }

  const tokenUrl = "https://oauth.zettle.com/token";

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    client_id: ZETTLE_CLIENT_ID,
    assertion: ZETTLE_CLIENT_SECRET,
  });

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error("Zettle token error", resp.status, txt);
    throw new Error(`Failed to retrieve Zettle access token`);
  }

  const data = await resp.json();

  cached.token = data.access_token;
  cached.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;

  return cached.token!;
}

Deno.serve(async () => {
  try {
    // 1. Get last sync time
    const { data: state } = await supabase
      .from('payment_sync')
      .select('last_synced_at')
      .eq('provider', PROVIDER)
      .eq('account_id', 'default')
      .single()

    const fromDate = state?.last_synced_at
      ? new Date(new Date(state.last_synced_at).getTime() + 1000)
      : new Date(Date.now() - 24 * 60 * 60 * 1000)


      const accessToken = await getZettleAccessToken();
    const url = new URL('https://purchase.izettle.com/purchases/v2')
    url.searchParams.append('limit', '1000')
    url.searchParams.append('descending', 'true')
    url.searchParams.append('from', fromDate.toISOString())
    url.searchParams.append('to', new Date().toISOString())

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) throw new Error(`Zettle error: ${await res.text()}`)
    const { purchases = [] } = await res.json()
    if (purchases.length === 0) return new Response('No new purchases', { status: 200 })

    let processed = 0
    let refunded = 0

    for (const purchase of purchases) {
      const isRefundedPurchase = purchase.refunded === true || purchase.refund === true
      const refundPayment = purchase.payments?.find(p => 
        p.type?.includes('REFUND') || p.type === 'IZETTLE_CARD_REFUND'
      )
      const isRefund = isRefundedPurchase || !!refundPayment

      // Determine status and amount (refunds have negative amount in Zettle)
      const status = isRefund ? 'refunded' : 'completed'
      const amount = purchase.amount / 100  // can be negative for full refund

      for (const product of purchase.products || []) {
        const sku = product.sku?.trim()
        if (!sku) continue

        const { data: booking } = await supabase
          .from('bookings')
          .select('id, payment_status')
          .eq('id', sku)
          .single()

        if (!booking) continue

        // Skip if already in final state
        if (booking.payment_status === 'success' && status === 'completed') continue
        if (booking.payment_status === 'refunded' && status === 'cancelled') continue
        if (booking.payment_status === 'cancelled' && status === 'cancelled') continue

        // Use the actual payment UUID (original or refund)
        const paymentUuid = refundPayment?.uuid || purchase.payments?.[0]?.uuid

        // Upsert payment record
        await supabase.from('payments').upsert({
          booking_id: booking.id,
          provider: PROVIDER,
          provider_payment_id: paymentUuid,
          provider_event_id: purchase.purchaseUUID,
          invoice_number: product.name,
          status,
          amount: Math.abs(amount),           // store positive amount
          currency: purchase.currency,
          raw_payload: purchase,
          metadata: {
            source: 'zettle_pos',
            is_refund: isRefund,
            original_amount: purchase.amount / 100,
            refund_flags: { refunded: purchase.refunded, refund: purchase.refund },
            payment_type: purchase.payments?.[0]?.type
          },
          processed_at: new Date().toISOString(),
        }, { onConflict: ['provider', 'provider_payment_id'] })

        // Trigger correct RPC
        if (status === 'completed') {
          await supabase.rpc('simulate_booking_confirm_admin', { p_booking_id: booking.id })
          processed++
        } else if (status === 'refunded') {
          await supabase.rpc('simulate_payment_refund_admin', { p_booking_id: booking.id })
          refunded++
        }
      }
    }

    // Update sync state
    await supabase
      .from('payment_sync')
      .update({ last_synced_at: purchases[0]?.timestamp || new Date().toISOString() })
      .eq('provider', PROVIDER)
      .eq('account_id', 'default')


      return responseJSON(200, {
        message: `Payments refreshed from ${PROVIDER} successfully`,
        status: true
      });

    

  } catch (err) {
    console.error('Sync failed:', err)
    return new Response(`Error: ${err.message}`, { status: 500 })
  }
})