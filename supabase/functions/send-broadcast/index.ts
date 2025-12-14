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
  scheduled_at?: string;
  delay_min?: number;
  delay_max?: number;
  use_personalization?: boolean;
  template_id?: string;
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
      scheduled_at,
      delay_min = 1,
      delay_max = 3,
      use_personalization = false,
      template_id
    }: BroadcastRequest = await req.json();

    console.log("📢 Broadcast request:", {
      userId: user.id,
      categoryId: category_id,
      recipientCount: recipients.length,
      mediaType: media_type,
      mediaUrl: media_url,
      scheduled: scheduled_at,
    });

    // Get user settings - WAJIB dari user sendiri
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

    if (!apiUrl || !apiKey) {
      throw new Error("OneSender API belum dikonfigurasi. Silakan set API URL dan API Key di halaman Settings Anda.");
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

        // Prepare request body for OneSender API
        let apiEndpoint = apiUrl;
        let requestBody: any = {};

        // Determine API endpoint and body based on media type
        if (media_type === "text") {
          // Text message - use standard message endpoint
          requestBody = {
            to: recipient.phone,
            text: {
              body: queueItem.message
            }
          };
        } else if (media_type === "image" && media_url) {
          // Image message - use media endpoint with correct format
          // OneSender expects: POST to media endpoint with image data
          apiEndpoint = apiUrl.replace("/message/send", "/media/send");
          if (!apiEndpoint.includes("/media")) {
            apiEndpoint = apiUrl.replace("/api/v1/message/send", "/api/v1/media/send");
          }
          
          requestBody = {
            to: recipient.phone,
            type: "image",
            image: {
              url: media_url,
              caption: queueItem.message || ""
            }
          };
        } else if (media_type === "video" && media_url) {
          // Video message
          apiEndpoint = apiUrl.replace("/message/send", "/media/send");
          if (!apiEndpoint.includes("/media")) {
            apiEndpoint = apiUrl.replace("/api/v1/message/send", "/api/v1/media/send");
          }
          
          requestBody = {
            to: recipient.phone,
            type: "video",
            video: {
              url: media_url,
              caption: queueItem.message || ""
            }
          };
        } else if (media_type === "document" && media_url) {
          // Document message
          apiEndpoint = apiUrl.replace("/message/send", "/media/send");
          if (!apiEndpoint.includes("/media")) {
            apiEndpoint = apiUrl.replace("/api/v1/message/send", "/api/v1/media/send");
          }
          
          // Extract filename from URL or use default
          const urlParts = media_url.split('/');
          const filename = urlParts[urlParts.length - 1] || "document.pdf";
          
          requestBody = {
            to: recipient.phone,
            type: "document",
            document: {
              url: media_url,
              filename: filename,
              caption: queueItem.message || ""
            }
          };
        }

        console.log("📤 Sending to OneSender API:", { 
          url: apiEndpoint, 
          phone: recipient.phone,
          messageType: media_type,
          hasMedia: !!media_url,
          body: JSON.stringify(requestBody).substring(0, 200)
        });

        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        const responseText = await response.text();
        console.log(`📨 Response for ${recipient.phone}:`, response.status, responseText.substring(0, 200));

        if (response.ok) {
          // Check if response indicates success
          let isSuccess = true;
          try {
            const responseJson = JSON.parse(responseText);
            // Some APIs return success:false in body even with 200 status
            if (responseJson.success === false || responseJson.error) {
              isSuccess = false;
            }
          } catch {
            // If response is not JSON, assume success based on status code
          }

          if (isSuccess) {
            successCount++;
            await supabase
              .from("broadcast_queue")
              .update({ 
                status: "sent", 
                sent_at: new Date().toISOString() 
              })
              .eq("id", queueItem.id);
            console.log(`✅ Message sent to ${recipient.phone}`);
          } else {
            failCount++;
            await supabase
              .from("broadcast_queue")
              .update({ 
                status: "failed",
                error_message: responseText.substring(0, 500),
              })
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
