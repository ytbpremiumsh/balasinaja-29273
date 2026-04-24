import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function cleanPhone(value: string): string {
  return String(value || '')
    .replace(/(@s\.whatsapp\.net|@c\.us|@g\.us|@newsletter|@lid)/g, '')
    .replace(/[^0-9]/g, '');
}

function isTruthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['true', '1', 'yes', 'from_me'].includes(String(value || '').toLowerCase());
}

function normalizeMpwaPayload(payload: any) {
  const data = payload?.data || payload?.message || payload?.messages?.[0] || payload || {};
  const rawFrom = firstString(
    data.from,
    data.from_id,
    data.sender,
    data.sender_id,
    data.number,
    data.phone,
    data.remoteJid,
    payload.from,
    payload.sender,
    payload.number,
    payload.phone,
  );
  const phone = cleanPhone(rawFrom);
  const messageText = firstString(
    data.message,
    data.text,
    data.body,
    data.caption,
    data.content,
    payload.message,
    payload.text,
    payload.body,
  );
  const mediaUrl = firstString(data.media_url, data.url, data.image, data.file, payload.media_url, payload.url);
  const messageType = firstString(data.message_type, data.type, payload.message_type, payload.type) || (mediaUrl ? 'image' : 'text');

  return {
    is_group: isTruthy(data.is_group ?? payload.is_group) || String(rawFrom).includes('@g.us'),
    is_from_me: isTruthy(data.is_from_me ?? data.fromMe ?? data.from_me ?? payload.is_from_me ?? payload.fromMe),
    message_type: ['image', 'document', 'text'].includes(messageType) ? messageType : 'text',
    from_id: phone,
    from_name: firstString(data.name, data.pushName, data.from_name, payload.name, payload.from_name),
    message_text: messageText,
    message_id: firstString(data.message_id, data.id, payload.message_id, payload.id) || crypto.randomUUID(),
    media_url: mediaUrl,
    url: mediaUrl,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Webhook token is required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json().catch(() => ({}));
    const normalized = normalizeMpwaPayload(payload);
    console.log('📩 MPWA webhook normalized:', JSON.stringify(normalized));

    if (!normalized.from_id) {
      return new Response(JSON.stringify({ error: 'MPWA payload tidak berisi nomor pengirim yang valid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
    const proxyResponse = await fetch(`${supabaseUrl}/functions/v1/balasinaja?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(normalized),
    });

    const responseText = await proxyResponse.text();
    return new Response(responseText, {
      status: proxyResponse.status,
      headers: { ...corsHeaders, 'Content-Type': proxyResponse.headers.get('Content-Type') || 'application/json' },
    });
  } catch (error) {
    console.error('❌ MPWA webhook error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
