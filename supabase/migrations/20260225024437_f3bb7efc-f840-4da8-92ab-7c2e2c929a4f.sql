
-- Create storage bucket for web chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('web-chat-attachments', 'web-chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for web-chat-attachments bucket
CREATE POLICY "Anyone can upload chat attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'web-chat-attachments');

CREATE POLICY "Anyone can view chat attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'web-chat-attachments');

CREATE POLICY "Authenticated users can delete chat attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'web-chat-attachments' AND auth.uid() IS NOT NULL);

-- Add message_type support for images in web_chats (already has message_type column, just need to use it)
-- Add INSERT policy for authenticated users on web_chats so dashboard users can insert replies
CREATE POLICY "Users can insert own web chats"
ON public.web_chats FOR INSERT
WITH CHECK (auth.uid() = user_id);
