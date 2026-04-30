export const config = { auth: false };

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function verifyZettleWebhook(
  rawBody: string,
  headers: Headers,
  signingKey: string
): Promise<boolean> {
  const timestamp = headers.get("x-zettle-signature-timestamp");
  const receivedSignature = headers.get("x-zettle-signature"); // e.g. "v1=abc123..."

  if (!timestamp || !receivedSignature || receivedSignature.length === 0) {
    return false;
  }

  const stringToSign = `${timestamp}.${rawBody}`;

  const keyBytes = new TextEncoder().encode(signingKey);
  const msgBytes = new TextEncoder().encode(stringToSign);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgBytes);
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expectedSignature = receivedSignature.replace(/^v1=/, "");

  return timingSafeEqual(computedSignature, expectedSignature);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const responseJSON = (status: number, data: Record<string, unknown>) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const rawBody = await req.text();
  const payload = JSON.parse(rawBody);

  if (payload.eventName !== "PurchaseCreated") return responseJSON(200, {message: 'Success'});

  const {
    data: { signing_key },
    error: zettleKeyError,
  } = await supabase
    .from("cred")
    .select("value")
    .eq("key", "webhook_signing_key")
    .eq("provider", "zettle")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (zettleKeyError || !signing_key) {
    console.error("No signing key found", zettleKeyError);
    return new Response("Server misconfigured", { status: 200 });
  }


  const isValid = await verifyZettleWebhook(rawBody, req.headers, signing_key);


  if (!isValid) {
    return new Response("Invalid signature", { status: 200 });
  }

  // ... handle InvoicePaid etc.


  return new Response("OK", { status: 200 });
});
