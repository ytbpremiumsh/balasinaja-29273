-- Create wa_gateway_settings table (singleton, admin-managed)
CREATE TABLE public.wa_gateway_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  active_gateway TEXT NOT NULL DEFAULT 'onesender' CHECK (active_gateway IN ('onesender', 'mpwa')),
  mpwa_api_key TEXT,
  mpwa_api_url TEXT DEFAULT 'https://app.ayopintar.com',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_gateway_settings ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read which gateway is active (so client can show right UI)
CREATE POLICY "Authenticated can view gateway settings"
ON public.wa_gateway_settings FOR SELECT
TO authenticated
USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can insert gateway settings"
ON public.wa_gateway_settings FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update gateway settings"
ON public.wa_gateway_settings FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete gateway settings"
ON public.wa_gateway_settings FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to auto-update updated_at
CREATE TRIGGER update_wa_gateway_settings_updated_at
BEFORE UPDATE ON public.wa_gateway_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_payment_settings_updated_at();

-- Insert default row
INSERT INTO public.wa_gateway_settings (active_gateway, mpwa_api_url)
VALUES ('onesender', 'https://app.ayopintar.com');

-- Add MPWA device fields to profiles
ALTER TABLE public.profiles
ADD COLUMN mpwa_device_number TEXT,
ADD COLUMN mpwa_device_connected BOOLEAN NOT NULL DEFAULT false;