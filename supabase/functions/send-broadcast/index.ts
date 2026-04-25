import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BroadcastRequest {
  recipients: Array<{ phone: string; name?: string }>;
  message: string;
  category_id: string;
  media_type?: string;
  media_url?: string;
  buttons?: Array<{ type: "reply" | "call" | "url" | "copy"; displayText: string; phoneNumber?: string; url?: string; copyText?: string }>;
  scheduled_at?: string;
  delay_min?: number;
  delay_max?: number;
  use_personalization?: boolean;
  template_id?: string;
}

function normalizeButtons(buttons: BroadcastRequest["buttons"] = []) {
  return buttons
    .slice(0, 5)
    .map((button) => ({
      type: button.type,
      displayText: String(button.displayText || "").trim(),
      phoneNumber: button.phoneNumber ? String(button.phoneNumber).replace(/\D/g, "") : undefined,
      url: button.url ? String(button.url).trim() : undefined,
      copyText: button.copyText ? String(button.copyText).trim() : undefined,
    }))
    .filter((button) => {
      if (!button.displayText) return false;
      if (button.type === "call") return !!button.phoneNumber;
      if (button.type === "url") return !!button.url;
      if (button.type === "copy") return !!button.copyText;
      return button.type === "reply";
    });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { 
      recipients, 
      message, 
      category_id,
      media_type = "text",
      media_url,
      buttons = [],
      scheduled_at,
      delay_min = 1,
      delay_max = 3,
      use_personalization = false,
      template_id
    }: BroadcastRequest = await req.json();

    const normalizedButtons = normalizeButtons(buttons);

    console.log("📢 Broadcast request:", {
      userId: user.id,
      categoryId: category_id,
      recipientCount: recipients.length,
      mediaType: media_type,
      mediaUrl: media_url,
      scheduled: scheduled_at,
    });

    // Detect active gateway (global, admin-managed)
    const { data: gateway } = await supabase
      .from("wa_gateway_settings")
      .select("active_gateway, mpwa_api_key, mpwa_api_url, mpwa_footer")
      .limit(1)
      .maybeSingle();

    const activeGateway = gateway?.active_gateway || "onesender";
    console.log("🛰️ Active gateway:", activeGateway);

    // Get user settings
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("*")
      .eq("user_id", user.id);

    if (settingsError) throw settingsError;

    const settingsMap = settings?.reduce((acc: any, setting: any) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {}) || {};

    const apiUrl = settingsMap.onesender_api_url;
    const apiKey = settingsMap.onesender_api_key;

    // Get user's MPWA device number (per-user)
    const { data: profileForBroadcast } = await supabase
      .from("profiles")
      .select("mpwa_device_number")
      .eq("user_id", user.id)
      .maybeSingle();
    const mpwaSender = profileForBroadcast?.mpwa_device_number || "";
    const mpwaApiKey = gateway?.mpwa_api_key || "";
    const mpwaApiBase = (gateway?.mpwa_api_url || "https://app.ayopintar.com").replace(/\/$/, "");
    const mpwaFooter = gateway?.mpwa_footer || "Pesan Otomatis";

    if (activeGateway === "onesender" && (!apiUrl || !apiKey)) {
      throw new Error("OneSender API belum dikonfigurasi. Silakan set API URL dan API Key di Konfigurasi API.");
    }
    if (activeGateway === "mpwa" && (!mpwaApiKey || !mpwaSender)) {
      throw new Error("MPWA belum siap: pastikan admin sudah set API Key MPWA dan Anda sudah scan QR device di Konfigurasi API.");
    }

    // Create broadcast log
    const { data: logData, error: logError } = await supabase
      .from("broadcast_logs")
      .insert({
        user_id: user.id,
        category_id,
        message,
        total_recipients: recipients.length,
        status: scheduled_at ? "scheduled" : "processing",
        media_type,
        media_url,
        buttons: normalizedButtons as any,
        scheduled_at,
        delay_min,
        delay_max,
        use_personalization,
        template_id,
      })
      .select()
      .single();

    if (logError) throw logError;

    const logId = logData.id;

    // Create queue entries for each recipient
    const queueEntries = recipients.map((recipient) => {
      let personalizedMessage = message;
      
      // Apply personalization - always replace variables if present
      if (use_personalization || message.includes("{{")) {
        personalizedMessage = message
          .replace(/\{\{nama\}\}/gi, recipient.name || "")
          .replace(/\{\{tanggal\}\}/gi, new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }))
          .replace(/\{\{phone\}\}/gi, recipient.phone);
      }

      return {
        broadcast_log_id: logId,
        phone: recipient.phone,
        name: recipient.name,
        message: personalizedMessage,
        media_type,
        media_url,
          buttons: normalizedButtons as any,
        status: scheduled_at ? "scheduled" : "pending",
        scheduled_at: scheduled_at || null,
      };
    });

    const { error: queueError } = await supabase
      .from("broadcast_queue")
      .insert(queueEntries);

    if (queueError) throw queueError;

    // If scheduled, don't send now
    if (scheduled_at) {
      console.log("📅 Broadcast scheduled for:", scheduled_at);
      return new Response(
        JSON.stringify({
          success: true,
          scheduled: true,
          broadcast_id: logId,
          total: recipients.length,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Process queue immediately if not scheduled
    let successCount = 0;
    let failCount = 0;

    for (const recipient of recipients) {
      try {
        // Get personalized message from queue
        const { data: queueItem } = await supabase
          .from("broadcast_queue")
          .select("*")
          .eq("broadcast_log_id", logId)
          .eq("phone", recipient.phone)
          .single();

        if (!queueItem) continue;

        // Update status to processing
        await supabase
          .from("broadcast_queue")
          .update({ status: "processing" })
          .eq("id", queueItem.id);

        // Build request based on active gateway
        let apiEndpoint: string;
        let requestBody: any;
        let requestHeaders: Record<string, string>;

        if (activeGateway === "mpwa") {
          const hasButtons = Array.isArray((queueItem as any).buttons) && (queueItem as any).buttons.length > 0;
          let body = queueItem.message || "";
          if (!hasButtons && media_url && (media_type === "image" || media_type === "document" || media_type === "video")) {
            body = body ? `${body}\n${media_url}` : media_url;
          }
          apiEndpoint = hasButtons ? `${mpwaApiBase}/send-button` : `${mpwaApiBase}/send-message`;
          requestHeaders = { "Content-Type": "application/json" };
          requestBody = {
            api_key: mpwaApiKey,
            sender: mpwaSender,
            number: recipient.phone,
            message: body,
            footer: mpwaFooter,
          };
          if (hasButtons) {
            requestBody.button = (queueItem as any).buttons;
            requestBody.image = media_url || "https://placehold.co/1200x630/png?text=Broadcast";
          }
        } else {
          // OneSender (existing logic)
          apiEndpoint = apiUrl;
          if (media_type === "text") {
            requestBody = { to: recipient.phone, text: { body: queueItem.message } };
          } else if (media_type === "image" && media_url) {
            apiEndpoint = apiUrl.replace("/message/send", "/media/send");
            if (!apiEndpoint.includes("/media")) apiEndpoint = apiUrl.replace("/api/v1/message/send", "/api/v1/media/send");
            requestBody = { to: recipient.phone, type: "image", image: { url: media_url, caption: queueItem.message || "" } };
          } else if (media_type === "video" && media_url) {
            apiEndpoint = apiUrl.replace("/message/send", "/media/send");
            if (!apiEndpoint.includes("/media")) apiEndpoint = apiUrl.replace("/api/v1/message/send", "/api/v1/media/send");
            requestBody = { to: recipient.phone, type: "video", video: { url: media_url, caption: queueItem.message || "" } };
          } else if (media_type === "document" && media_url) {
            apiEndpoint = apiUrl.replace("/message/send", "/media/send");
            if (!apiEndpoint.includes("/media")) apiEndpoint = apiUrl.replace("/api/v1/message/send", "/api/v1/media/send");
            const urlParts = media_url.split('/');
            const filename = urlParts[urlParts.length - 1] || "document.pdf";
            requestBody = { to: recipient.phone, type: "document", document: { url: media_url, filename, caption: queueItem.message || "" } };
          } else {
            requestBody = { to: recipient.phone, text: { body: queueItem.message } };
          }
          requestHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };
        }

        console.log("📤 Sending via", activeGateway, "→", recipient.phone);

        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify(requestBody),
        });

        const responseText = await response.text();
        console.log(`📨 Response for ${recipient.phone}:`, response.status, responseText.substring(0, 200));

        if (response.ok) {
          let isSuccess = true;
          try {
            const responseJson = JSON.parse(responseText);
            // OneSender: success:false / error  | MPWA: status:false
            if (responseJson.success === false || responseJson.error) isSuccess = false;
            if (activeGateway === "mpwa" && responseJson.status === false) isSuccess = false;
          } catch {}

          if (isSuccess) {
            successCount++;
            await supabase
              .from("broadcast_queue")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", queueItem.id);
            console.log(`✅ Message sent to ${recipient.phone}`);
          } else {
            failCount++;
            await supabase
              .from("broadcast_queue")
              .update({ status: "failed", error_message: responseText.substring(0, 500) })
              .eq("id", queueItem.id);
            console.error(`❌ API returned error for ${recipient.phone}:`, responseText);
          }
        } else {
          const isWhatsAppError = responseText.includes('not registered') || 
                                  responseText.includes('not a whatsapp') || 
                                  responseText.includes('invalid number') ||
                                  response.status === 404 ||
                                  response.status === 400;
          
          failCount++;
          await supabase
            .from("broadcast_queue")
            .update({ 
              status: "failed",
              error_message: isWhatsAppError 
                ? 'Nomor tidak terdaftar di WhatsApp' 
                : responseText.substring(0, 500),
            })
            .eq("id", queueItem.id);
          console.error(`❌ Failed to send to ${recipient.phone}:`, response.status, responseText);
        }
      } catch (error) {
        failCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error sending to ${recipient.phone}:`, errorMessage);
        
        // Update queue with error
        await supabase
          .from("broadcast_queue")
          .update({ 
            status: "failed",
            error_message: errorMessage.substring(0, 500),
          })
          .eq("broadcast_log_id", logId)
          .eq("phone", recipient.phone);
      }

      // Random delay between delay_min and delay_max seconds
      const delaySeconds = delay_min + Math.random() * (delay_max - delay_min);
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
    }

    // Update broadcast log with final counts
    await supabase
      .from("broadcast_logs")
      .update({
        total_sent: successCount,
        total_failed: failCount,
        status: "completed",
      })
      .eq("id", logId);

    console.log("📊 Broadcast completed:", {
      total: recipients.length,
      success: successCount,
      failed: failCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        broadcast_id: logId,
        total: recipients.length,
        sent: successCount,
        failed: failCount,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ Broadcast error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
