-- Add webhook_token column to profiles for secure webhook authentication
ALTER TABLE public.profiles 
ADD COLUMN webhook_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex');

-- Generate tokens for existing users
UPDATE public.profiles 
SET webhook_token = encode(gen_random_bytes(32), 'hex')
WHERE webhook_token IS NULL;

-- Make webhook_token NOT NULL after populating
ALTER TABLE public.profiles 
ALTER COLUMN webhook_token SET NOT NULL;

-- Update payment_settings RLS policy to require authentication
DROP POLICY IF EXISTS "Anyone can view payment settings" ON public.payment_settings;

CREATE POLICY "Authenticated users can view payment settings" 
ON public.payment_settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Add index for webhook_token lookups
CREATE INDEX idx_profiles_webhook_token ON public.profiles(webhook_token);