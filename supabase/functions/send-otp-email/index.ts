import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendOTPRequest {
  email: string;
  fullName: string;
  phoneNumber: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, fullName, phoneNumber }: SendOTPRequest = await req.json();
    
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
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
    };

    const interpolate = (s: string) =>
      s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);

    const otpTpl = tplMap.get('otp_verification');
    const wrapperTpl = tplMap.get('wrapper');

    const emailSubject = otpTpl ? interpolate(otpTpl.subject) : 'Verify your StallBook account';
    let emailBody = otpTpl
      ? interpolate(otpTpl.html_body)
      : `<h1>Welcome to StallBook!</h1><p>Hi ${fullName}, your code is <strong>${otpCode}</strong></p>`;

    if (wrapperTpl) {
      emailBody = wrapperTpl.html_body.replace('{{content}}', emailBody);
    }

    // Send email using Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'StallBook <contact@contact.geekgrin.com>',
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