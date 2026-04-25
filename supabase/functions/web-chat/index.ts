import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, token, session_id, message, message_type, visitor_name, visitor_phone } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate token and get user
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, name, plan, status, expire_at')
      .eq('webhook_token', token)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = profile.user_id;
    const isPremium = profile.plan && profile.plan !== 'trial' && profile.status !== 'expired';

    // GET CHAT HISTORY
    if (action === 'history') {
      if (!isPremium) {
        return new Response(JSON.stringify({ error: 'Premium required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: messages } = await supabase
        .from('web_chats')
        .select('id, sender, message, message_type, created_at')
        .eq('user_id', userId)
        .eq('session_id', session_id || '')
        .order('created_at', { ascending: true })
        .limit(50);

      return new Response(JSON.stringify({ messages: messages || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SEND MESSAGE
    if (action === 'send') {
      if (!isPremium) {
        return new Response(JSON.stringify({ error: 'Premium required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!message || !session_id) {
        return new Response(JSON.stringify({ error: 'Message and session_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase.from('web_chats').insert({
        user_id: userId,
        session_id,
        sender: 'visitor',
        message,
        message_type: message_type || 'text',
        visitor_name: visitor_name || null,
        visitor_phone: visitor_phone || null,
      });

      // If it's an image, don't generate AI reply
      if (message_type === 'image') {
        return new Response(JSON.stringify({ reply: null, status: 'image_received' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get conversation history for AI context
      const { data: chatHistory } = await supabase
        .from('web_chats')
        .select('sender, message, created_at')
        .eq('user_id', userId)
        .eq('session_id', session_id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Generate AI reply using same logic as WhatsApp
      const aiReply = await generateAiReply(supabase, userId, message, chatHistory || []);

      if (aiReply) {
        // Save AI reply
        await supabase.from('web_chats').insert({
          user_id: userId,
          session_id,
          sender: 'ai',
          message: aiReply,
          visitor_name: visitor_name || null,
          visitor_phone: visitor_phone || null,
        });

        return new Response(JSON.stringify({ reply: aiReply }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ reply: null, status: 'no_reply' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET BUSINESS INFO
    if (action === 'info') {
      // Get bot avatar from settings
      const { data: avatarSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('user_id', userId)
        .eq('key', 'chat_bot_avatar')
        .maybeSingle();

      return new Response(JSON.stringify({ 
        business_name: profile.name || 'Business',
        bot_avatar: avatarSetting?.value || '',
        is_premium: isPremium,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Web chat error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateAiReply(
  supabase: any,
  userId: string,
  question: string,
  chatHistory: any[] = []
): Promise<string> {
  try {
    // Get AI settings
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value')
      .eq('user_id', userId)
      .in('key', ['ai_vendor', 'ai_api_key', 'ai_model', 'system_prompt', 'ai_reply_enabled']);

    const settingsMap: Record<string, string> = {};
    settings?.forEach((s: any) => { settingsMap[s.key] = s.value; });

    if (settingsMap.ai_reply_enabled === 'false') return '';

    const aiVendor = settingsMap.ai_vendor || 'lovable';
    const aiApiKey = settingsMap.ai_api_key || '';
    const aiModel = settingsMap.ai_model || 'google/gemini-2.5-flash';
    const systemPrompt = settingsMap.system_prompt || 'Anda adalah asisten AI yang membantu menjawab pertanyaan pelanggan dengan ramah dan profesional.';

    // Get knowledge base
    const { data: knowledge } = await supabase
      .from('ai_knowledge_base')
      .select('question, answer')
      .eq('user_id', userId);

    let context = '';
    if (knowledge?.length > 0) {
      context = knowledge.map((k: any) => `Q: ${k.question}\nA: ${k.answer}`).join('\n---\n');
    }

    // Build history context
    let historyContext = '';
    if (chatHistory.length > 0) {
      historyContext = '\n\n=== Riwayat Percakapan ===\n';
      const reversed = [...chatHistory].reverse();
      reversed.forEach((msg: any) => {
        if (msg.sender === 'visitor') historyContext += `Pengguna: ${msg.message}\n`;
        if (msg.sender === 'ai') historyContext += `Asisten: ${msg.message}\n`;
      });
      historyContext += '=== Akhir Riwayat ===\n\n';
    }

    const linkFormatInstruction = '\n\nInstruksi format link: jika menyertakan URL, tulis URL asli secara polos tanpa markdown, tanpa **URL**, tanpa [URL](...), dan tanpa tanda ** agar link tetap aktif.';
    const userPrompt = context
      ? `Gunakan knowledge base berikut untuk menjawab:\n\n${context}${historyContext}\nPertanyaan saat ini: ${question}${linkFormatInstruction}`
      : `${historyContext}Pertanyaan: ${question}${linkFormatInstruction}`;

    let apiUrl = '';
    let apiKey = '';
    let requestBody: any = {};

    if (aiVendor === 'gemini') {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${aiApiKey}`;
      requestBody = {
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { maxOutputTokens: 512, temperature: 0.7 }
      };
    } else if (aiVendor === 'openai') {
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      apiKey = aiApiKey;
      requestBody = {
        model: aiModel,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        max_tokens: 512, temperature: 0.7,
      };
    } else if (aiVendor === 'openrouter') {
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      apiKey = aiApiKey;
      requestBody = {
        model: aiModel,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        max_tokens: 512, temperature: 0.7,
      };
    } else {
      // Lovable AI
      apiUrl = 'https://api.lovable.app/v1/ai/chat';
      apiKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      requestBody = {
        model: aiModel,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        max_tokens: 512, temperature: 0.7,
      };
    }

    const headers: any = { 'Content-Type': 'application/json' };
    if (aiVendor !== 'gemini') headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestBody) });
    if (!response.ok) {
      console.error('AI API error:', response.status, await response.text());
      return '';
    }

    const data = await response.json();
    if (aiVendor === 'gemini') {
      return cleanAiReplyLinks(data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '');
    }
    return cleanAiReplyLinks(data.choices?.[0]?.message?.content?.trim() || '');
  } catch (error) {
    console.error('Error generating AI reply:', error);
    return '';
  }
}

function cleanAiReplyLinks(text: string): string {
  return String(text || '')
    .replace(/\[[^\]]*\]\(((?:https?:\/\/|www\.)[^\s)]+)\)/gi, '$1')
    .replace(/\*\*\s*(URL|Link|Tautan)\s*\*\*\s*:?\s*/gi, '')
    .replace(/__\s*(URL|Link|Tautan)\s*__\s*:?\s*/gi, '')
    .replace(/\*\*((?:https?:\/\/|www\.)[^\s*]+)\*\*/gi, '$1')
    .replace(/__((?:https?:\/\/|www\.)[^\s_]+)__/gi, '$1')
    .replace(/`((?:https?:\/\/|www\.)[^`\s]+)`/gi, '$1')
    .replace(/\*\*/g, '')
    .trim();
}
