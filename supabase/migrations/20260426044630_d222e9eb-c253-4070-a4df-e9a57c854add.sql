-- Tighten user-owned profile updates and block self-service changes to sensitive fields
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

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
      OR NEW.webhook_token IS DISTINCT FROM OLD.webhook_token
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

DROP TRIGGER IF EXISTS prevent_user_profile_sensitive_changes_trigger ON public.profiles;

CREATE TRIGGER prevent_user_profile_sensitive_changes_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_user_profile_sensitive_changes();