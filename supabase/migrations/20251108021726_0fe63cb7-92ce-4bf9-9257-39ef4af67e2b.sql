-- Create WhatsApp notification templates table
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  template_key TEXT NOT NULL UNIQUE,
  message_template TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage templates
CREATE POLICY "Admins can manage templates"
ON public.whatsapp_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default welcome template
INSERT INTO public.whatsapp_templates (name, template_key, message_template, description, is_active)
VALUES (
  'Welcome Message',
  'welcome_new_user',
  'Halo {NAME} 👋

Selamat datang di BalasinAja! 

Akun Anda telah berhasil dibuat dan aktif hingga {EXPIRE_DATE}.

Silakan login dan mulai gunakan layanan kami untuk mengelola pesan WhatsApp Anda secara otomatis.

Terima kasih telah bergabung! 🎉',
  'Pesan otomatis yang dikirim kepada pengguna baru setelah registrasi',
  true
),
(
  'Payment Success',
  'payment_success',
  'Halo {NAME} 👋

Pembayaran Anda untuk paket *{PACKAGE_NAME}* telah berhasil dikonfirmasi! ✅

Langganan Anda telah diperpanjang hingga {EXPIRE_DATE}.

Terima kasih atas kepercayaan Anda menggunakan BalasinAja!',
  'Pesan otomatis yang dikirim setelah pembayaran berhasil dikonfirmasi',
  true
);