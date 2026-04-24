import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
    const { embedToken, action, phone, message, messageType, sessionId, visitorPhone } = body;

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
      return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
