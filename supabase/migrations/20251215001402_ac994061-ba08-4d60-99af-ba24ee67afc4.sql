-- Create landing page content table
CREATE TABLE public.landing_page_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  title text,
  subtitle text,
  description text,
  image_url text,
  button_text text,
  button_url text,
  items jsonb,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landing_page_content ENABLE ROW LEVEL SECURITY;

-- Public can view active content
CREATE POLICY "Anyone can view active landing content"
ON public.landing_page_content
FOR SELECT
USING (is_active = true);

-- Admins can manage all content
CREATE POLICY "Admins can manage landing content"
ON public.landing_page_content
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default content
INSERT INTO public.landing_page_content (section_key, title, subtitle, description, button_text, button_url, sort_order) VALUES
('hero', 'Otomatisasi WhatsApp Bisnis Anda', 'BalasinAja', 'Platform otomatisasi WhatsApp terlengkap untuk bisnis Anda. Kelola pesan, broadcast, dan auto-reply dengan mudah.', 'Mulai Sekarang', '/auth', 1),
('stats', 'Statistik Platform', NULL, NULL, NULL, NULL, 2),
('features', 'Fitur Unggulan', 'Semua yang Anda butuhkan', 'Nikmati berbagai fitur canggih untuk mengoptimalkan komunikasi WhatsApp bisnis Anda', NULL, NULL, 3),
('pricing', 'Paket Harga', 'Pilih Paket yang Sesuai', 'Harga terjangkau dengan fitur lengkap untuk semua skala bisnis', NULL, NULL, 4),
('cta', 'Siap Memulai?', NULL, 'Bergabung sekarang dan rasakan kemudahan mengelola WhatsApp bisnis Anda', 'Daftar Gratis', '/auth', 5);

-- Insert stats items
UPDATE public.landing_page_content 
SET items = '[
  {"value": "10,000+", "label": "Pesan Terkirim"},
  {"value": "500+", "label": "Pengguna Aktif"},
  {"value": "99.9%", "label": "Uptime"},
  {"value": "24/7", "label": "Support"}
]'::jsonb
WHERE section_key = 'stats';

-- Insert features items
UPDATE public.landing_page_content 
SET items = '[
  {"icon": "MessageSquare", "title": "Auto Reply", "description": "Balas pesan otomatis dengan AI cerdas"},
  {"icon": "Send", "title": "Broadcast", "description": "Kirim pesan massal ke ribuan kontak"},
  {"icon": "Brain", "title": "AI Knowledge", "description": "Latih AI dengan knowledge base Anda"},
  {"icon": "Users", "title": "Manajemen Kontak", "description": "Kelola kontak dengan kategori"},
  {"icon": "BarChart3", "title": "Analitik", "description": "Pantau statistik pesan real-time"},
  {"icon": "Shield", "title": "Keamanan", "description": "Data terenkripsi dan aman"}
]'::jsonb
WHERE section_key = 'features';