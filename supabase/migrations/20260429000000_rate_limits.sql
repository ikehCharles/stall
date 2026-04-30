CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rate_limits_key_created_at_idx ON public.rate_limits (key, created_at DESC);

-- Service role only; no user-facing access needed
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
