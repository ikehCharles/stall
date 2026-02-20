// supabase/functions/sync-offline-bookings-to-zettle/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v1 as uuidv1 } from "https://esm.sh/uuid@9";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CLIENT_BASEURL = Deno.env.get("CLIENT_BASEURL")!;
const ZETTLE_CLIENT_ID = Deno.env.get("ZETTLE_CLIENT_ID")!;
const ZETTLE_CLIENT_SECRET = Deno.env.get("ZETTLE_CLIENT_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (status: number, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Simple in-memory token cache
const tokenCache = { token: "", expiresAt: 0 };

async function getZettleAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt > now + 10_000) {
    return tokenCache.token;
  }

  const resp = await fetch("https://oauth.zettle.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      client_id: ZETTLE_CLIENT_ID!,
      assertion: ZETTLE_CLIENT_SECRET!,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error("Zettle auth failed:", resp.status, err);
    throw new Error("Failed to get Zettle access token");
  }

  const data = await resp.json();
  tokenCache.token = data.access_token;
  tokenCache.expiresAt = now + (data.expires_in || 3600) * 1000 - 10_000; // 10s buffer

  return tokenCache.token;
}

Deno.serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const isCron = req.headers.get("x-supabase-trigger") === "cron";

  // If this is NOT cron, we must authenticate the user
  if (!isCron) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // user is authenticated – continue with your logic
    return handleRequest("user", user, req);
  }

  // If CRON, authenticate using SERVICE ROLE (no JWT needed)
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  return handleRequest("cron", supabaseAdmin, req);
});

async function handleRequest(
  type: "user" | "cron",
  supabaseUser,
  req: Request
) {
  if (type === "user") {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return jsonResponse(405, { error: "Method not allowed" });
    }
  }

  try {
    const accessToken = await getZettleAccessToken();

    // Fetch bookings ready for offline sync
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(
        `
        id,
        invoice_number,
        total_amount,
        market:market_id!inner (name, banner_url)
      `
      )
      .in("status", ["approved", "reserved", "pending"])
      .is("offline_invoice_id", null)
      .is("offline_synced_at", null)
      .or("payment_status.eq.pending,payment_status.is.null");

    if (error) throw error;
    if (!bookings || bookings.length === 0) {
      return jsonResponse(200, { message: "No bookings to sync", synced: 0 });
    }

    let successCount = 0;
    let failCount = 0;

    // Process sequentially to avoid rate limits (Zettle allows ~10 req/s)
    for (const booking of bookings) {
      try {
        const productUuid = uuidv1(); // Required: time-based v1
        const categoryUuid = uuidv1();

        const payload = {
          uuid: productUuid,
          name: booking.invoice_number,
          description: `${booking.market.name} - Booking ${booking.id}`,
          variants: [
            {
              uuid: productUuid,
              sku: booking.id,
              name: booking.invoice_number,
              price: {
                amount: Math.round(booking.total_amount * 100),
                currencyId: "GBP",
              },
              costPrice: {
                amount: Math.round(booking.total_amount * 100),
                currencyId: "GBP",
              },
              vatPercentage: 0,
            },
          ],
          category: { uuid: categoryUuid, name: booking.market.name },
          metadata: {
            inPos: true,
            source: { name: CLIENT_BASEURL, external: true },
          },
        };

        const resp = await fetch(
          "https://products.izettle.com/organizations/self/products?returnEntity=true",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        console.log(`Zettle response for booking ${booking.id}:`, resp.status);

        if (!resp.ok) {
          const err = await resp.text();
          console.error(
            `Failed for ${booking.invoice_number}:`,
            resp.status,
            err
          );
          failCount++;
          continue;
        }

        const result = await resp.json();

        console.log(
          `Zettle created product for booking ${booking.id}:`,
          result
        );

        // Mark as synced
        const { error: updateErr } = await supabase
          .from("bookings")
          .update({
            offline_invoice_id: result.uuid,
            offline_synced_at: new Date().toISOString(),
            payment_status: 'pending'
          })
          .eq("id", booking.id);

        if (updateErr) {
          console.error(`DB update failed for ${booking.id}:`, updateErr);
          failCount++;
        } else {
          successCount++;
          console.log(
            `Synced: ${booking.invoice_number} → Zettle UUID ${result.uuid}`
          );
        }

        await new Promise((r) => setTimeout(r, 150)); // ~6 req/s
      } catch (err) {
        console.error(`Error processing booking ${booking.id}:`, err.message);
        failCount++;
      }
    }

    return jsonResponse(200, {
      message: "Sync complete",
      status: true,
      synced: successCount,
      failed: failCount,
      total: bookings.length,
    });
  } catch (err) {
    console.error("Sync failed:", err);
    return jsonResponse(500, { error: err.message || "Internal server error" });
  }
}
