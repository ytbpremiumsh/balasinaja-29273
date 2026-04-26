-- Move webhook tokens out of profiles into a restricted secrets table
CREATE TABLE IF NOT EXISTS public.profile_secrets (
  user_id uuid PRIMARY KEY,
  webhook_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_secrets ENABLE ROW LEVEL SECURITY;

-- No direct read policy is intentionally added: tokens are only exposed through scoped SECURITY DEFINER functions.
DROP POLICY IF EXISTS "Admins can manage profile secrets" ON public.profile_secrets;
CREATE POLICY "Admins can manage profile secrets"
ON public.profile_secrets
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Backfill existing tokens before removing the exposed profile column.
INSERT INTO public.profile_secrets (user_id, webhook_token, created_at, updated_at)
SELECT user_id, webhook_token, COALESCE(created_at, now()), now()
FROM public.profiles
WHERE webhook_token IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Ensure every existing profile has a secret row.
INSERT INTO public.profile_secrets (user_id)
SELECT p.user_id
FROM public.profiles p
LEFT JOIN public.profile_secrets ps ON ps.user_id = p.user_id
WHERE ps.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_my_webhook_token()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ps.webhook_token
  FROM public.profile_secrets ps
  WHERE ps.user_id = auth.uid()
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.validate_webhook_token(_token text)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ps.user_id
  FROM public.profile_secrets ps
  WHERE ps.webhook_token = _token
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, name, phone, expire_at, status, plan)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', ''),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    now() + INTERVAL '2 days',
    'trial',
    'trial'
  );

  INSERT INTO public.profile_secrets (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  INSERT INTO public.settings (user_id, key, value)
  VALUES 
    (new.id, 'onesender_api_url', ''),
    (new.id, 'onesender_api_key', ''),
    (new.id, 'ai_vendor', 'lovable'),
    (new.id, 'ai_api_key', ''),
    (new.id, 'ai_model', 'google/gemini-2.5-flash'),
    (new.id, 'system_prompt', 'Anda adalah asisten AI yang membantu menjawab pertanyaan pelanggan dengan ramah dan profesional.');
  
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_user_profile_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() = OLD.user_id AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.expire_at IS DISTINCT FROM OLD.expire_at
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.mpwa_device_connected IS DISTINCT FROM OLD.mpwa_device_connected
      OR NEW.mpwa_device_number IS DISTINCT FROM OLD.mpwa_device_number THEN
      RAISE EXCEPTION 'Sensitive profile fields cannot be changed by the user';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS webhook_token;