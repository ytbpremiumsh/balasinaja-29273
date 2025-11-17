-- Insert default delay settings for AI replies to prevent spam
INSERT INTO public.settings (user_id, key, value)
SELECT user_id, 'min_delay_seconds', '5'
FROM public.profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.settings 
  WHERE settings.user_id = profiles.user_id 
  AND settings.key = 'min_delay_seconds'
);

INSERT INTO public.settings (user_id, key, value)
SELECT user_id, 'max_delay_seconds', '15'
FROM public.profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.settings 
  WHERE settings.user_id = profiles.user_id 
  AND settings.key = 'max_delay_seconds'
);