import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") ?? "contact@contact.geekgrin.com";

interface SendOTPRequest {
  email: string;
  fullName: string;
  phoneNumber: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, fullName, phoneNumber }: SendOTPRequest = await req.json();

    if (!email || !fullName || !phoneNumber) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, fullName, phoneNumber" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Rate limit: max 3 OTP sends per email per 15 minutes
    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: recentOtpCount } = await supabaseClient
      .from('email_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', windowStart);
    if ((recentOtpCount ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ error: 'Too many OTP requests. Please wait before requesting another.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch configured branding from settings
    const { data: brandingRows } = await supabaseClient
      .from('settings')
      .select('key, value')
      .eq('source', 'platform')
      .in('key', ['app_name', 'app_logo_url']);
    const brandingMap = Object.fromEntries(
      (brandingRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
    );
    const appName = brandingMap['app_name'] || 'Stall Inc';
    const appLogoUrl = brandingMap['app_logo_url'] || '';

    // Generate 6-digit OTP using cryptographically secure random values
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const otpCode = (100000 + (arr[0] % 900000)).toString();
    
    // Get current user (this function should be called after signup)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    // Store OTP in database with 10 minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    const { error: otpError } = await supabaseClient
      .from('email_verifications')
      .insert({
        user_id: user.id,
        email: email,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString()
      });

    if (otpError) {
      console.error('Error storing OTP:', otpError);
      throw new Error('Failed to store OTP');
    }

    // Load OTP + wrapper templates from DB
    const { data: tplRows } = await supabaseClient
      .from('email_templates')
      .select('key, subject, html_body')
      .in('key', ['otp_verification', 'wrapper']);

    const tplMap = new Map<string, { subject: string; html_body: string }>();
    for (const row of tplRows ?? []) tplMap.set(row.key, row);

    const vars: Record<string, string> = {
      full_name: fullName,
      otp_code: otpCode,
      app_name: appName,
      app_logo_url: appLogoUrl,
    };

    const interpolate = (s: string) =>
      s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);

    const otpTpl = tplMap.get('otp_verification');
    const wrapperTpl = tplMap.get('wrapper');

    const emailSubject = otpTpl ? interpolate(otpTpl.subject) : `Verify your ${appName} account`;
    let emailBody = otpTpl
      ? interpolate(otpTpl.html_body)
      : `<h1>Welcome to ${appName}!</h1><p>Hi ${fullName}, your code is <strong>${otpCode}</strong></p>`;

    if (wrapperTpl) {
      emailBody = interpolate(wrapperTpl.html_body.replace('{{content}}', emailBody));
    }

    // Send email using Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${appName} <${SENDER_EMAIL}>`,
        to: [email],
        subject: emailSubject,
        html: emailBody,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error('Resend API error:', errorData);
      throw new Error('Failed to send email');
    }

    const emailResult = await emailResponse.json();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP sent successfully',
        otpId: emailResult.id 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in send-otp-email function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});