-- Create ticket_messages table for conversation history
CREATE TABLE public.ticket_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('user', 'admin')),
  sender_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages of their own tickets
CREATE POLICY "Users can view own ticket messages"
ON public.ticket_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = ticket_messages.ticket_id
    AND tickets.user_id = auth.uid()
  )
);

-- Users can insert messages to their own tickets (if not closed)
CREATE POLICY "Users can insert own ticket messages"
ON public.ticket_messages
FOR INSERT
WITH CHECK (
  sender_type = 'user' AND
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = ticket_messages.ticket_id
    AND tickets.user_id = auth.uid()
    AND tickets.status != 'closed'
  )
);

-- Admins can view all ticket messages
CREATE POLICY "Admins can view all ticket messages"
ON public.ticket_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert messages to any ticket
CREATE POLICY "Admins can insert ticket messages"
ON public.ticket_messages
FOR INSERT
WITH CHECK (
  sender_type = 'admin' AND
  sender_id = auth.uid() AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Create index for faster queries
CREATE INDEX idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_created_at ON public.ticket_messages(created_at);