ALTER TABLE public.wa_gateway_settings
  ADD COLUMN IF NOT EXISTS mpwa_admin_device_number text,
  ADD COLUMN IF NOT EXISTS mpwa_admin_device_connected boolean NOT NULL DEFAULT false;