-- Update lookup_vendor_in_market to include last_login_at so the FCA UI
-- can tell whether a vendor has ever verified their account.

CREATE OR REPLACE FUNCTION public.lookup_vendor_in_market(p_email text, p_market_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_user_id uuid;
  v_profile jsonb;
  v_bookings jsonb;
BEGIN
  -------------------------------------------------------------------
  -- 1. Permission check
  -------------------------------------------------------------------
  IF NOT has_permission(auth.uid(), 'vendors.lookup') THEN
    RAISE EXCEPTION
      'Permission denied (%). Required: necessary permission',
      auth.uid() USING ERRCODE = 'P4030';
  END IF;

  -------------------------------------------------------------------
  -- 2. Fetch user profile + latest KYC in ONE query
  -------------------------------------------------------------------
  SELECT
    p.id,
    jsonb_build_object(
      'user_id',           p.id,
      'email',             p.email,
      'full_name',         p.full_name,
      'phone_number',      p.phone_number,
      'company_name',      p.company_name,
      'last_login_at',     p.last_login_at,
      'kyc_status',        k.status,
      'kyc_id',            k.id,
      'kyc_contact_email', k.contact_email
    )
  INTO v_user_id, v_profile
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT id, status, contact_email
    FROM public.kyc_applications
    WHERE user_id = p.id
    ORDER BY created_at DESC
    LIMIT 1
  ) k ON TRUE
  WHERE LOWER(p.email) = LOWER(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found for email %', p_email USING ERRCODE = 'P4040';
  END IF;

  -------------------------------------------------------------------
  -- 3. Fetch all bookings for this market
  -------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'id',              b.id,
             'market_id',       b.market_id,
             'invoice_number',  b.invoice_number,
             'selected_dates',  b.selected_dates,
             'status',          b.status,
             'payment_status',  b.payment_status,
             'total_amount',    b.total_amount,
             'paid_amount',     b.paid_amount,
             'days_count',      b.days_count,
             'created_at',      b.created_at
           )
         ), '[]'::jsonb)
  INTO v_bookings
  FROM public.bookings b
  WHERE b.user_id = v_user_id
    AND b.market_id = p_market_id;

  -------------------------------------------------------------------
  -- 4. Return final JSON payload
  -------------------------------------------------------------------
  RETURN jsonb_build_object(
    'profile',  v_profile,
    'bookings', v_bookings
  );

END$function$;
