
-- Create web_chats table for web chat messages
CREATE TABLE public.web_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  sender TEXT NOT NULL DEFAULT 'visitor',
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  visitor_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.web_chats ENABLE ROW LEVEL SECURITY;

-- Users can view their own web chats
CREATE POLICY "Users can view own web chats"
ON public.web_chats FOR SELECT
USING (auth.uid() = user_id);

-- Users can delete own web chats
CREATE POLICY "Users can delete own web chats"
ON public.web_chats FOR DELETE
USING (auth.uid() = user_id);

-- Allow public insert (visitors sending messages via edge function with service role)
CREATE POLICY "Service role can insert web chats"
ON public.web_chats FOR INSERT
WITH CHECK (true);

-- Allow service role to select for AI context
CREATE POLICY "Service role can select web chats"
ON public.web_chats FOR SELECT
USING (true);

-- Enable realtime for web_chats
ALTER PUBLICATION supabase_realtime ADD TABLE public.web_chats;

-- Create index for faster queries
CREATE INDEX idx_web_chats_session ON public.web_chats(session_id, created_at);
CREATE INDEX idx_web_chats_user ON public.web_chats(user_id, created_at);
