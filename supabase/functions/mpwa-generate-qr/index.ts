import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate user JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;
    const body = await req.json().catch(() => ({}));
    const deviceNumber = String(body.device || '').trim();

    if (!deviceNumber || !/^\d{8,20}$/.test(deviceNumber)) {
      return new Response(JSON.stringify({ error: 'Nomor device tidak valid (hanya angka 8-20 digit)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get global MPWA settings (admin-managed)
    const { data: gatewaySettings, error: gwError } = await supabase
      .from('wa_gateway_settings')
      .select('mpwa_api_key, mpwa_api_url')
      .limit(1)
      .single();

    if (gwError || !gatewaySettings?.mpwa_api_key) {
      return new Response(JSON.stringify({ error: 'MPWA belum dikonfigurasi oleh admin. Hubungi administrator.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiBase = (gatewaySettings.mpwa_api_url || 'https://app.ayopintar.com').replace(/\/$/, '');
    console.log('🔑 Generating QR for device:', deviceNumber);

    // Call MPWA generate-qr
    const mpwaResponse = await fetch(`${apiBase}/generate-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device: deviceNumber,
        api_key: gatewaySettings.mpwa_api_key,
        force: true,
      }),
    });

    const mpwaData = await mpwaResponse.json().catch(() => ({}));
    console.log('📥 MPWA response:', JSON.stringify(mpwaData).slice(0, 200));

    // Save device number to user profile
    await supabase
      .from('profiles')
      .update({
        mpwa_device_number: deviceNumber,
        mpwa_device_connected: !!mpwaData?.msg?.toString().toLowerCase().includes('already connected'),
      })
      .eq('user_id', userId);

    return new Response(JSON.stringify({
      success: true,
      qrcode: mpwaData.qrcode || null,
      message: mpwaData.msg || mpwaData.message || '',
      connected: !!mpwaData?.msg?.toString().toLowerCase().includes('already connected'),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ MPWA QR error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
