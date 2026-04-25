import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Normalize MPWA QR response — sometimes returns base64 only, sometimes full data URL
function normalizeQR(raw: any): string | null {
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('data:image')) return raw;
  // Looks like base64
  if (/^[A-Za-z0-9+/=]+$/.test(raw.slice(0, 100))) {
    return `data:image/png;base64,${raw}`;
  }
  return raw;
}

function isConnectedResponse(data: any, msg: any): boolean {
  const status = String(data?.status || data?.data?.status || '').toLowerCase();
  const message = String(msg || '').toLowerCase();
  return (
    status === 'connected' ||
    status === 'authenticated' ||
    status === 'ready' ||
    message.includes('already connected') ||
    message.includes('connected') ||
    message.includes('authenticated') ||
    message.includes('ready')
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const scope = (body.scope === 'admin') ? 'admin' : 'user';
    const force = body.force === false ? false : true;

    if (!deviceNumber || !/^\d{8,20}$/.test(deviceNumber)) {
      return new Response(JSON.stringify({ error: 'Nomor device tidak valid (hanya angka 8-20 digit)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If admin scope, verify admin role
    if (scope === 'admin') {
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      if (!roleRow) {
        return new Response(JSON.stringify({ error: 'Hanya admin yang bisa generate device admin' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get global MPWA settings
    const { data: gatewaySettings, error: gwError } = await supabase
      .from('wa_gateway_settings')
      .select('id, mpwa_api_key, mpwa_api_url')
      .limit(1)
      .maybeSingle();

    if (gwError || !gatewaySettings?.mpwa_api_key) {
      return new Response(JSON.stringify({ error: 'MPWA belum dikonfigurasi oleh admin. Hubungi administrator.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiBase = 'https://app.ayopintar.com';
    const apiKey = gatewaySettings.mpwa_api_key;
    const params = new URLSearchParams({
      device: deviceNumber,
      api_key: apiKey,
      force: force ? '1' : '0',
    });
    console.log('🔑 MPWA generate-qr →', {
      device: deviceNumber,
      scope,
      force,
      apiKeyPrefix: `${String(apiKey).slice(0, 4)}***`,
      apiKeyLength: String(apiKey).length,
    });

    const mpwaResponse = await fetch(`${apiBase}/generate-qr?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const rawBody = await mpwaResponse.text();
    let mpwaData: any = {};
    try { mpwaData = JSON.parse(rawBody); } catch { mpwaData = { raw: rawBody }; }
    console.log('📥 MPWA POST status:', mpwaResponse.status, 'body:', rawBody.slice(0, 500));

    // Handle MPWA error response: { status: false, msg: "Invalid data!", errors: {...} }
    const message = mpwaData?.msg || mpwaData?.message || '';
    if (mpwaData?.errors && Object.keys(mpwaData.errors).length > 0) {
      const errDetail = JSON.stringify(mpwaData.errors);
      console.error('❌ MPWA validation error:', errDetail);
      return new Response(JSON.stringify({
        error: `MPWA: ${message || 'Invalid data'} — ${errDetail}`,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract qrcode (docs: "qrcode" key with base64/data:image value)
    const rawQr = mpwaData?.qrcode || mpwaData?.qr || mpwaData?.data?.qrcode || mpwaData?.data?.qr || null;
    const qrcode = normalizeQR(rawQr);
    const connected = isConnectedMsg(message) || String(mpwaData?.status || '').toLowerCase() === 'connected';

    console.log('🎯 Result:', { hasQr: !!qrcode, connected, message });

    // Persist to correct location
    if (scope === 'admin') {
      await supabase
        .from('wa_gateway_settings')
        .update({
          mpwa_admin_device_number: deviceNumber,
          mpwa_admin_device_connected: connected,
        })
        .eq('id', gatewaySettings.id);
    } else {
      await supabase
        .from('profiles')
        .update({
          mpwa_device_number: deviceNumber,
          mpwa_device_connected: connected,
        })
        .eq('user_id', userId);
    }

    return new Response(JSON.stringify({
      success: true,
      qrcode,
      message,
      connected,
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
