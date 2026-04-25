ALTER TABLE public.broadcast_logs
ADD COLUMN IF NOT EXISTS buttons jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.broadcast_queue
ADD COLUMN IF NOT EXISTS buttons jsonb DEFAULT '[]'::jsonb;