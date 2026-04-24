ALTER TABLE public.wa_gateway_settings
ADD COLUMN IF NOT EXISTS mpwa_footer TEXT NOT NULL DEFAULT 'BalasinAja';