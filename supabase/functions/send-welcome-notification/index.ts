import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: roles } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!roles) {
        return new Response(JSON.stringify({ error: 'Forbidden - Admin only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending welcome notification to user:', userId);

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('name, phone, expire_at')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { name, phone, expire_at } = profile;

    if (!phone) {
      console.log('No phone number for user:', userId);
      return new Response(
        JSON.stringify({ message: 'No phone number' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get admin user to use their API settings
    console.log('Getting admin user settings for sending notification...');
    const { data: adminRole } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)
      .single();

    if (!adminRole) {
      console.error('No admin user found');
      return new Response(
        JSON.stringify({ error: 'Admin not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminUserId = adminRole.user_id;
    console.log('Using admin user ID:', adminUserId);

    // Detect active gateway
    const { data: gateway } = await supabaseClient
      .from('wa_gateway_settings')
      .select('active_gateway, mpwa_api_key, mpwa_api_url, mpwa_admin_device_number, mpwa_footer')
      .limit(1)
      .maybeSingle();

    const activeGateway = gateway?.active_gateway || 'onesender';
    const messageFooter = gateway?.mpwa_footer || 'BalasinAja';
    console.log('🛰️ Active gateway:', activeGateway);

    // Get welcome template
    const { data: template } = await supabaseClient
      .from('whatsapp_templates')
      .select('message_template')
      .eq('template_key', 'welcome_new_user')
      .eq('is_active', true)
      .single();

    const expiryDate = new Date(expire_at).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    let message = template?.message_template || `Halo {NAME} 👋

Selamat datang di BalasinAja! 

Akun Anda telah berhasil dibuat dan aktif hingga {EXPIRE_DATE}.

Silakan login dan mulai gunakan layanan kami untuk mengelola pesan WhatsApp Anda secara otomatis.

Terima kasih telah bergabung! 🎉`;

    message = message
      .replace(/{NAME}/g, name || 'User')
      .replace(/{EXPIRE_DATE}/g, expiryDate)
      .replace(/{FOOTER}/g, messageFooter);

    console.log('Sending WhatsApp message to:', phone);

    let response: Response;

    if (activeGateway === 'mpwa') {
      if (!gateway?.mpwa_api_key || !gateway?.mpwa_admin_device_number) {
        return new Response(
          JSON.stringify({ error: 'MPWA admin device belum dikonfigurasi. Buka Admin → WA Gateway dan scan QR device admin.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const apiBase = (gateway.mpwa_api_url || 'https://app.ayopintar.com').replace(/\/$/, '');
      response = await fetch(`${apiBase}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: gateway.mpwa_api_key,
          sender: gateway.mpwa_admin_device_number,
          number: phone,
          message,
          footer: messageFooter,
        }),
      });
    } else {
      // OneSender path: use admin user settings
      const { data: settings } = await supabaseClient
        .from('settings')
        .select('key, value')
        .eq('user_id', adminUserId)
        .in('key', ['onesender_api_url', 'onesender_api_key']);

      let apiUrl = '';
      let apiKey = '';
      settings?.forEach(setting => {
        if (setting.key === 'onesender_api_url') apiUrl = setting.value;
        if (setting.key === 'onesender_api_key') apiKey = setting.value;
      });
      if (!apiKey) apiKey = Deno.env.get('ONESENDER_API_KEY') || '';

      if (!apiUrl || !apiKey) {
        return new Response(
          JSON.stringify({ error: 'OneSender admin belum dikonfigurasi.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ to: phone, type: 'text', text: { body: message }, priority: 10 }),
      });
    }

    const result = await response.json().catch(() => ({}));
    console.log('WhatsApp API response:', result);

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${JSON.stringify(result)}`);
    }

    // Save notification record
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'welcome',
        title: 'Selamat Datang!',
        message: 'Akun Anda telah berhasil didaftarkan'
      });

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-welcome-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
