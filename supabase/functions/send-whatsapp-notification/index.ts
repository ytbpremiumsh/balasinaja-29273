import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get user from JWT token in Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('User error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (rolesError || !roles) {
      console.error('Not admin:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin only' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone, message, userId } = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'Phone and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Detect active gateway
    const { data: gateway } = await supabaseAdmin
      .from('wa_gateway_settings')
      .select('active_gateway, mpwa_api_key, mpwa_api_url, mpwa_admin_device_number')
      .limit(1)
      .maybeSingle();

    const activeGateway = gateway?.active_gateway || 'onesender';
    console.log('🛰️ Active gateway:', activeGateway);

    let response: Response;

    if (activeGateway === 'mpwa') {
      if (!gateway?.mpwa_api_key || !gateway?.mpwa_admin_device_number) {
        return new Response(
          JSON.stringify({ error: 'MPWA admin device belum dikonfigurasi. Buka Admin → WA Gateway dan scan QR device admin.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const apiBase = (gateway.mpwa_api_url || 'https://app.ayopintar.com').replace(/\/$/, '');
      console.log('📤 Sending via MPWA, sender:', gateway.mpwa_admin_device_number, 'to:', phone);
      response = await fetch(`${apiBase}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: gateway.mpwa_api_key,
          sender: gateway.mpwa_admin_device_number,
          number: phone,
          message,
          footer: 'BalasinAja',
        }),
      });
    } else {
      // OneSender path
      let apiUrl = '';
      let apiKey = '';

      if (userId) {
        const { data: settings } = await supabaseAdmin
          .from('settings')
          .select('key, value')
          .eq('user_id', userId)
          .in('key', ['onesender_api_url', 'onesender_api_key']);
        settings?.forEach(setting => {
          if (setting.key === 'onesender_api_url') apiUrl = setting.value;
          if (setting.key === 'onesender_api_key') apiKey = setting.value;
        });
      }

      if (!apiUrl || !apiKey) {
        const { data: defaultSettings } = await supabaseAdmin
          .from('settings')
          .select('key, value')
          .in('key', ['onesender_api_url', 'onesender_api_key'])
          .limit(2);
        defaultSettings?.forEach(setting => {
          if (!apiUrl && setting.key === 'onesender_api_url') apiUrl = setting.value;
          if (!apiKey && setting.key === 'onesender_api_key') apiKey = setting.value;
        });
      }

      if (!apiUrl || !apiKey) {
        return new Response(
          JSON.stringify({ error: 'OneSender belum dikonfigurasi.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Sending via OneSender to:', phone);
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ to: phone, type: 'text', text: { body: message }, priority: 10 }),
      });
    }

    const responseText = await response.text();
    console.log('Gateway response status:', response.status, responseText.slice(0, 200));

    let result: any;
    try { result = JSON.parse(responseText); } catch { result = { raw: responseText }; }

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${JSON.stringify(result)}`);
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-whatsapp-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});