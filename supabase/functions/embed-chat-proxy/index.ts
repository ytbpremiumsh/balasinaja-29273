import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ATTACHMENT_BUCKET = 'web-chat-attachments';
const attachmentPrefix = `${ATTACHMENT_BUCKET}:`;

async function signAttachmentUrl(supabase: any, value: string): Promise<string> {
  if (!value?.startsWith(attachmentPrefix)) return value;
  const path = value.slice(attachmentPrefix.length);
  const { data } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl || value;
}

async function signImageMessages(supabase: any, messages: any[]): Promise<any[]> {
  return Promise.all((messages || []).map(async (msg) => (
    msg.message_type === 'image'
      ? { ...msg, message: await signAttachmentUrl(supabase, msg.message) }
      : msg
  )));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { embedToken, action, phone, message, messageType, sessionId, visitorPhone, fileName, fileType, fileBase64 } = body;

    if (!embedToken) {
      return new Response(JSON.stringify({ error: 'Token required' }), { status: 400, headers: corsHeaders });
    }

    // Validate embed token
    const { data: tokenData, error: tokenError } = await supabase
      .from('dashboard_embed_tokens')
      .select('user_id, is_active, expires_at')
      .eq('token', embedToken)
      .eq('is_active', true)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: corsHeaders });
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Token expired' }), { status: 403, headers: corsHeaders });
    }

    const userId = tokenData.user_id;

    // Handle actions
    if (action === 'fetch_contacts') {
      const { data, error } = await supabase
        .from('web_chats')
        .select('session_id, sender, message, message_type, created_at, visitor_name, visitor_phone')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ data: await signImageMessages(supabase, data || []) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'fetch_messages') {
      if (!phone) {
        return new Response(JSON.stringify({ error: 'Phone required' }), { status: 400, headers: corsHeaders });
      }

      const { data, error } = await supabase
        .from('web_chats')
        .select('id, sender, message, message_type, created_at, visitor_name, session_id')
        .eq('user_id', userId)
        .eq('visitor_phone', phone)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return new Response(JSON.stringify({ data: await signImageMessages(supabase, data || []) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'upload_attachment') {
      if (!sessionId || !visitorPhone || !fileBase64 || !fileType?.startsWith('image/')) {
        return new Response(JSON.stringify({ error: 'Valid image, sessionId and visitorPhone required' }), { status: 400, headers: corsHeaders });
      }
      const ext = String(fileName || 'image.png').split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
      const binary = Uint8Array.from(atob(String(fileBase64).split(',').pop() || ''), (c) => c.charCodeAt(0));
      if (binary.byteLength > 3 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'Image too large' }), { status: 413, headers: corsHeaders });
      }
      const safeSession = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
      const path = `${userId}/admin/${safeSession}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, binary, { contentType: fileType, upsert: false });
      if (uploadError) throw uploadError;
      return new Response(JSON.stringify({ storedMessage: `${attachmentPrefix}${path}`, url: await signAttachmentUrl(supabase, `${attachmentPrefix}${path}`) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send_reply') {
      if (!message || !visitorPhone) {
        return new Response(JSON.stringify({ error: 'Message and visitorPhone required' }), { status: 400, headers: corsHeaders });
      }

      const { error } = await supabase.from('web_chats').insert({
        user_id: userId,
        session_id: sessionId || crypto.randomUUID(),
        sender: 'admin',
        message: message,
        message_type: messageType || 'text',
        visitor_phone: visitorPhone,
      });

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'fetch_knowledge') {
      const { data, error } = await supabase
        .from('ai_knowledge_base')
        .select('id, question, answer')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
