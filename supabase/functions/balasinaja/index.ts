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

    // Get webhook token from query params and validate
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      console.error('❌ No webhook token provided');
      return new Response(JSON.stringify({ error: 'Webhook token is required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate token and get user_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, webhook_token')
      .eq('webhook_token', token)
      .single();

    if (profileError || !profile) {
      console.error('❌ Invalid webhook token:', profileError?.message);
      return new Response(JSON.stringify({ error: 'Invalid or unauthorized webhook token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = profile.user_id;
    console.log('✅ Webhook token validated for user:', userId);

    const payload = await req.json();
    console.log('🔥 Webhook received for user:', userId, JSON.stringify(payload, null, 2));

    // Validate message
    const isValid = !payload.is_group && 
                   !payload.is_from_me && 
                   ['text', 'image', 'document'].includes(payload.message_type);

    if (!isValid) {
      console.log('⚠️ Message ignored (group/self/invalid type)');
      return new Response(JSON.stringify({ status: 'ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse phone number
    const phone = String(payload.from_id).replace(/(@s\.whatsapp\.net|@g\.us|@newsletter|@lid)/g, '');
    const name = payload.from_name || '';
    const messageText = payload.message_text || '';
    const messageType = payload.message_type;
    const messageId = payload.message_id;

    // Save or update contact
    const { data: contactData, error: contactError } = await supabase
      .from('contacts')
      .upsert({ phone, name, user_id: userId }, { onConflict: 'phone,user_id' })
      .select()
      .single();

    if (contactError) {
      console.error('Error saving contact:', contactError);
    } else {
      console.log('📇 Contact saved:', phone);
    }

    // Get the contact's category if exists
    let categoryId = null;
    if (contactData) {
      const { data: categoryData } = await supabase
        .from('contact_categories')
        .select('category_id')
        .eq('contact_id', contactData.id)
        .maybeSingle();
      
      if (categoryData) {
        categoryId = categoryData.category_id;
        console.log('📋 Contact assigned to category:', categoryId);
      }
    }

    // Save to inbox with category
    const { error: inboxError } = await supabase
      .from('inbox')
      .insert({
        message_id: messageId,
        phone,
        name,
        inbox_type: messageType,
        inbox_message: messageText,
        status: 'received',
        user_id: userId,
        category_id: categoryId
      });

    if (inboxError) {
      console.error('Error saving to inbox:', inboxError);
      throw inboxError;
    }
    console.log('📥 Message saved to inbox');

    // Fetch conversation history (last 20 messages from this phone number)
    console.log('📚 Fetching conversation history for:', phone);
    const { data: conversationHistory, error: historyError } = await supabase
      .from('inbox')
      .select('inbox_type, inbox_message, reply_type, reply_message, created_at')
      .eq('user_id', userId)
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(20);

    if (historyError) {
      console.error('Error fetching conversation history:', historyError);
    } else {
      console.log('📚 Loaded', conversationHistory?.length || 0, 'previous messages');
    }

    // Check for trigger match
    const { data: trigger } = await supabase
      .from('autoreplies')
      .select('*')
      .eq('user_id', userId)
      .ilike('trigger', messageText.trim())
      .single();

    if (trigger) {
      console.log('✅ Trigger matched:', trigger.trigger);

      // Get contact name for personalization
      const { data: contact } = await supabase
        .from('contacts')
        .select('name')
        .eq('phone', phone)
        .eq('user_id', userId)
        .single();

      const contactName = contact?.name || name;
      let replyContent = trigger.content
        .replace('{PHONE}', phone)
        .replace('{NAME}', contactName);

      // Send reply via OneSender
      const sent = await sendOneSenderMessage(supabase, userId, phone, trigger.message_type, replyContent, trigger.url_image || '');

      if (sent) {
        // Update inbox with reply
        await supabase
          .from('inbox')
          .update({
            reply_type: trigger.message_type,
            reply_message: replyContent,
            reply_image: trigger.url_image || '',
            status: 'replied_trigger'
          })
          .eq('message_id', messageId)
          .eq('user_id', userId);

        console.log('📣 Reply sent via trigger');
        return new Response(JSON.stringify({ status: 'replied_trigger' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check if AI reply is enabled
    const { data: aiSettings } = await supabase
      .from('settings')
      .select('value')
      .eq('user_id', userId)
      .eq('key', 'ai_reply_enabled')
      .single();

    const aiReplyEnabled = aiSettings?.value !== 'false'; // Default to true if not set

    // AI fallback for text and image messages (only if enabled)
    if (aiReplyEnabled && (messageType === 'text' || messageType === 'image')) {
      console.log('🤖 Attempting AI reply...');
      
      // For image messages, get the image URL from payload
      const imageUrl = messageType === 'image' ? (payload.media_url || payload.url || '') : '';
      
      const aiReply = await generateAiReply(supabase, userId, messageText, imageUrl, conversationHistory || []);
      
      if (aiReply) {
        console.log('✅ AI generated reply');
        
        const sent = await sendOneSenderMessage(supabase, userId, phone, 'text', aiReply, '');
        
        if (sent) {
          await supabase
            .from('inbox')
            .update({
              reply_type: 'text',
              reply_message: aiReply,
              status: 'replied_ai'
            })
            .eq('message_id', messageId)
            .eq('user_id', userId);

          console.log('🤖 AI reply sent');
          return new Response(JSON.stringify({ status: 'replied_ai' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // No reply sent
    console.log('🚫 No reply sent');
    await supabase
      .from('inbox')
      .update({ status: 'no_reply' })
      .eq('message_id', messageId)
      .eq('user_id', userId);

    return new Response(JSON.stringify({ status: 'no_reply' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateAiReply(
  supabase: any, 
  userId: string, 
  question: string, 
  imageUrl: string = '',
  conversationHistory: any[] = []
): Promise<string> {
  try {
    // Get AI settings
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value')
      .eq('user_id', userId)
      .in('key', ['ai_vendor', 'ai_api_key', 'ai_model', 'system_prompt']);

    let aiVendor = 'lovable';
    let aiApiKey = '';
    let aiModel = 'google/gemini-2.5-flash';
    let systemPrompt = 'Anda adalah asisten AI yang membantu menjawab pertanyaan pelanggan dengan ramah dan profesional.';

    if (settings) {
      const vendorSetting = settings.find((s: any) => s.key === 'ai_vendor');
      const keySetting = settings.find((s: any) => s.key === 'ai_api_key');
      const modelSetting = settings.find((s: any) => s.key === 'ai_model');
      const promptSetting = settings.find((s: any) => s.key === 'system_prompt');
      
      if (vendorSetting && vendorSetting.value) aiVendor = vendorSetting.value;
      if (keySetting) aiApiKey = keySetting.value;
      if (modelSetting && modelSetting.value) aiModel = modelSetting.value;
      if (promptSetting && promptSetting.value) systemPrompt = promptSetting.value;
    }

    console.log('🤖 Using AI vendor:', aiVendor, 'model:', aiModel);

    // Get knowledge base for context
    const { data: knowledge } = await supabase
      .from('ai_knowledge_base')
      .select('question, answer')
      .eq('user_id', userId)
      .limit(10);

    let context = '';
    if (knowledge && knowledge.length > 0) {
      context = knowledge
        .map((k: any) => `Q: ${k.question}\nA: ${k.answer}`)
        .join('\n---\n');
    }

    // Build conversation history context (reverse to show oldest first)
    let historyContext = '';
    if (conversationHistory.length > 0) {
      historyContext = '\n\n=== Riwayat Percakapan (dari lama ke baru) ===\n';
      const reversedHistory = [...conversationHistory].reverse();
      reversedHistory.forEach((msg: any) => {
        if (msg.inbox_message) {
          historyContext += `Pengguna: ${msg.inbox_message}\n`;
        }
        if (msg.reply_message) {
          historyContext += `Asisten: ${msg.reply_message}\n`;
        }
      });
      historyContext += '=== Akhir Riwayat ===\n\n';
      console.log('💬 Including', conversationHistory.length, 'previous messages in context');
    }

    const userPrompt = context 
      ? `Gunakan knowledge base berikut untuk menjawab:\n\n${context}${historyContext}\nPertanyaan saat ini: ${question}`
      : `${historyContext}Pertanyaan: ${question}`;

    let apiUrl = '';
    let apiKey = '';
    let requestBody: any = {};

    // Configure based on AI vendor
    if (aiVendor === 'lovable') {
      // Use Lovable AI API
      apiUrl = 'https://api.lovable.app/v1/ai/chat';
      apiKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      
      if (imageUrl) {
        messages[1].content = [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ];
      }
      
      requestBody = {
        model: aiModel,
        messages: messages,
        max_tokens: 512,
        temperature: 0.7,
      };
    } else if (aiVendor === 'gemini') {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent`;
      apiKey = aiApiKey;
      
      const parts: any[] = [{ text: `${systemPrompt}\n\n${userPrompt}` }];
      if (imageUrl) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: await fetchImageAsBase64(imageUrl)
          }
        });
      }
      
      requestBody = {
        contents: [{ parts }],
        generationConfig: {
          maxOutputTokens: 512,
          temperature: 0.7,
        }
      };
    } else if (aiVendor === 'openai') {
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      apiKey = aiApiKey;
      
      let userContent: any;
      if (imageUrl) {
        userContent = [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ];
      } else {
        userContent = userPrompt;
      }
      
      requestBody = {
        model: aiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 512,
        temperature: 0.7,
      };
    } else if (aiVendor === 'openrouter') {
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      apiKey = aiApiKey;
      
      let userContent: any;
      if (imageUrl) {
        userContent = [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ];
      } else {
        userContent = userPrompt;
      }
      
      requestBody = {
        model: aiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 512,
        temperature: 0.7,
      };
    }

    if (!apiKey) {
      console.error('❌ AI API key not configured for vendor:', aiVendor);
      return '';
    }

    const headers: any = {
      'Content-Type': 'application/json',
    };

    // Configure authentication based on vendor
    if (aiVendor === 'lovable') {
      // Lovable AI uses Authorization header
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (aiVendor === 'gemini') {
      // Gemini uses API key as query param
      apiUrl += `?key=${apiKey}`;
    } else {
      // OpenAI and OpenRouter use Authorization header
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    console.log('🌐 Calling AI API:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AI API error:', response.status, errorText);
      return '';
    }

    const data = await response.json();

    // Extract response based on vendor
    if (aiVendor === 'lovable' || aiVendor === 'openai' || aiVendor === 'openrouter') {
      return data.choices?.[0]?.message?.content?.trim() || '';
    } else {
      // Gemini
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    }

  } catch (error) {
    console.error('❌ Error generating AI reply:', error);
    return '';
  }
}

async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    return base64;
  } catch (error) {
    console.error('❌ Error fetching image:', error);
    return '';
  }
}

async function sendOneSenderMessage(supabase: any, userId: string, to: string, type: string, text: string, image: string): Promise<boolean> {
  try {
    // Get user's API settings - WAJIB dari user sendiri
    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .eq('user_id', userId)
      .in('key', ['onesender_api_url', 'onesender_api_key']);

    const settingsMap: any = {};
    if (settingsData) {
      settingsData.forEach((setting: any) => {
        settingsMap[setting.key] = setting.value;
      });
    }

    const apiUrl = settingsMap.onesender_api_url || '';
    const apiKey = settingsMap.onesender_api_key || '';

    if (!apiUrl || !apiKey) {
      console.error('❌ OneSender API belum dikonfigurasi di user ini');
      return false;
    }

    console.log('📤 Sending to OneSender:', apiUrl);

    const payload: any = {
      to,
      type,
      priority: 10
    };

    if (type === 'text') {
      payload.text = { body: text };
    } else if (type === 'image') {
      payload.image = { link: image, caption: text };
    } else if (type === 'document') {
      payload.document = { link: image, caption: text };
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('✅ Message sent to OneSender');
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ OneSender API error:', errorText);
      return false;
    }

  } catch (error) {
    console.error('❌ Error sending to OneSender:', error);
    return false;
  }
}
