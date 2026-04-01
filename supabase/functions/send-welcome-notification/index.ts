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

    // Get API settings from admin's settings
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

    // Fallback to global API key if not set
    if (!apiKey) {
      apiKey = Deno.env.get('ONESENDER_API_KEY') || '';
    }

    if (!apiUrl || !apiKey) {
      console.error('Admin API settings not configured');
      return new Response(
        JSON.stringify({ error: 'Admin API settings not configured. Please configure OneSender in admin settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin API settings loaded successfully');

    // Get welcome message template
    const { data: template } = await supabaseClient
      .from('whatsapp_templates')
      .select('message_template')
      .eq('template_key', 'welcome_new_user')
      .eq('is_active', true)
      .single();

    // Format expiration date
    const expiryDate = new Date(expire_at).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Use template or default message
    let message = template?.message_template || `Halo {NAME} 👋

Selamat datang di BalasinAja! 

Akun Anda telah berhasil dibuat dan aktif hingga {EXPIRE_DATE}.

Silakan login dan mulai gunakan layanan kami untuk mengelola pesan WhatsApp Anda secara otomatis.

Terima kasih telah bergabung! 🎉`;

    // Replace placeholders
    message = message
      .replace(/{NAME}/g, name || 'User')
      .replace(/{EXPIRE_DATE}/g, expiryDate);

    console.log('Sending WhatsApp message to:', phone);

    // Send WhatsApp message
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        phone: phone,
        message: message,
        type: 'text'
      })
    });

    const result = await response.json();
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
