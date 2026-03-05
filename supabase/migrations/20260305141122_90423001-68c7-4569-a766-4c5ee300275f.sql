
CREATE TABLE public.dashboard_embed_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  label text,
  duration text NOT NULL DEFAULT 'forever',
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(token)
);

ALTER TABLE public.dashboard_embed_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own embed tokens" ON public.dashboard_embed_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own embed tokens" ON public.dashboard_embed_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own embed tokens" ON public.dashboard_embed_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own embed tokens" ON public.dashboard_embed_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Public can validate tokens" ON public.dashboard_embed_tokens
  FOR SELECT TO anon USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));
