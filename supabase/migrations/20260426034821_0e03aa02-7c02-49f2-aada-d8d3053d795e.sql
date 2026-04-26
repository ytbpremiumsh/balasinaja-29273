UPDATE storage.buckets
SET public = false
WHERE id = 'chat-avatars';

DROP POLICY IF EXISTS "Public can view chat avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view own chat avatars" ON storage.objects;

CREATE POLICY "Authenticated users can view own chat avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);