-- Secure dashboard embed token validation: remove broad anonymous row reads
DROP POLICY IF EXISTS "Public can validate tokens" ON public.dashboard_embed_tokens;

CREATE OR REPLACE FUNCTION public.validate_dashboard_embed_token(_token text)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT det.user_id
  FROM public.dashboard_embed_tokens AS det
  WHERE det.token = _token
    AND det.is_active = true
    AND (det.expires_at IS NULL OR det.expires_at > now())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.validate_dashboard_embed_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_dashboard_embed_token(text) TO anon, authenticated;

-- Notifications must not be created by anonymous/public callers
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Remove public web chat policies that exposed or allowed all rows
DROP POLICY IF EXISTS "Service role can select web chats" ON public.web_chats;
DROP POLICY IF EXISTS "Service role can insert web chats" ON public.web_chats;

-- Remove broad webhook policies; backend functions use privileged credentials and do not need public RLS bypasses
DROP POLICY IF EXISTS "Webhook can insert inbox" ON public.inbox;
DROP POLICY IF EXISTS "Webhook can update inbox" ON public.inbox;

-- Prevent global realtime broadcast leaks for web chat messages
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'web_chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.web_chats;
  END IF;
END $$;

-- Make web chat attachments private and restrict object access
UPDATE storage.buckets
SET public = false
WHERE id = 'web-chat-attachments';

DROP POLICY IF EXISTS "Anyone can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload own web chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view own web chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own web chat attachments" ON storage.objects;

CREATE POLICY "Authenticated users can upload own web chat attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'web-chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can view own web chat attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'web-chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can delete own web chat attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'web-chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);