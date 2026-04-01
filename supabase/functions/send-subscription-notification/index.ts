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

    const { userId, packageName, expiryDate } = await req.json();

    if (!userId || !packageName || !expiryDate) {
      return new Response(
        JSON.stringify({ error: 'userId, packageName, and expiryDate are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending subscription notification to user:', userId);

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('name, phone')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { name, phone } = profile;

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

    // Format expiration date
    const formattedDate = new Date(expiryDate).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Build subscription message
    const message = `Langganan Berhasil Diperpanjang! ✅

Halo ${name},

Langganan Anda telah berhasil diperpanjang:
📦 Paket: ${packageName}
📅 Berakhir: ${formattedDate}

Terima kasih telah memperpanjang langganan Anda. Nikmati terus layanan BalasinAja!

- Tim BalasinAja`;

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
        type: 'subscription',
        title: 'Langganan Diperpanjang',
        message: `Langganan paket ${packageName} berhasil diperpanjang hingga ${formattedDate}`
      });

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-subscription-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
