
-- 1. Drop the overly permissive payment_settings SELECT policy for all authenticated users
DROP POLICY IF EXISTS "Authenticated users can view payment settings" ON public.payment_settings;

-- 2. Create a more restrictive policy: only admins and users with pending/approved payment proofs can view
CREATE POLICY "Users with payments can view payment settings" ON public.payment_settings
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.payment_proofs
    WHERE payment_proofs.user_id = auth.uid()
  )
);

-- 3. Drop the overly permissive service role policy on broadcast_queue
DROP POLICY IF EXISTS "Service role can manage queue" ON public.broadcast_queue;

-- 4. Create a tighter insert policy for broadcast_queue (service role bypasses RLS anyway)
CREATE POLICY "Users can insert own broadcast queue" ON public.broadcast_queue
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.broadcast_logs
    WHERE broadcast_logs.id = broadcast_queue.broadcast_log_id
    AND broadcast_logs.user_id = auth.uid()
  )
);

-- 5. Allow updates on broadcast_queue for users who own the broadcast
CREATE POLICY "Users can update own broadcast queue" ON public.broadcast_queue
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.broadcast_logs
    WHERE broadcast_logs.id = broadcast_queue.broadcast_log_id
    AND broadcast_logs.user_id = auth.uid()
  )
);
