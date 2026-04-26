DROP POLICY IF EXISTS "Authenticated can view gateway settings" ON public.wa_gateway_settings;
DROP POLICY IF EXISTS "Admins can view gateway settings" ON public.wa_gateway_settings;

CREATE POLICY "Admins can view gateway settings"
ON public.wa_gateway_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.get_active_gateway()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT active_gateway FROM public.wa_gateway_settings LIMIT 1), 'onesender');
$$;

REVOKE ALL ON FUNCTION public.get_active_gateway() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_gateway() TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_user_profile_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.user_id AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.expire_at IS DISTINCT FROM OLD.expire_at
      OR NEW.webhook_token IS DISTINCT FROM OLD.webhook_token THEN
      RAISE EXCEPTION 'Sensitive profile fields cannot be changed by the user';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_user_profile_sensitive_changes_trigger ON public.profiles;
CREATE TRIGGER prevent_user_profile_sensitive_changes_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_user_profile_sensitive_changes();