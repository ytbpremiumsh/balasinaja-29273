
-- Create storage bucket for chat bot avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-avatars', 'chat-avatars', true);

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own chat avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to update their own avatar
CREATE POLICY "Users can update own chat avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'chat-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own avatar
CREATE POLICY "Users can delete own chat avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access for chat avatars
CREATE POLICY "Public can view chat avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-avatars');
