-- Create rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action_type text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own rate limits"
  ON public.rate_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert rate limits"
  ON public.rate_limits FOR INSERT
  WITH CHECK (true);

-- Index for efficient querying
CREATE INDEX idx_rate_limits_user_action_time
  ON public.rate_limits(user_id, action_type, created_at DESC);

COMMENT ON TABLE public.rate_limits IS 'Tracks API usage for rate limiting';

