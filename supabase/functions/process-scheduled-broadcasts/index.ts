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
    // Verify caller is authenticated admin or internal cron
    const authHeader = req.headers.get('Authorization');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!roles) {
        return new Response(JSON.stringify({ error: 'Forbidden - Admin only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const supabase = supabaseAdmin;

    console.log('🕐 Processing scheduled broadcasts...');
    
    const now = new Date();
    console.log('Current time (UTC):', now.toISOString());
    console.log('Current time (local):', now.toString());

    // Get all broadcast queue items that need to be sent
    // This includes both scheduled items and pending items (from "Kirim Sekarang")
    const { data: queueItems, error: queueError } = await supabase
      .from('broadcast_queue')
      .select('*')
      .in('status', ['scheduled', 'pending'])
      .or(`scheduled_at.is.null,scheduled_at.lte.${now.toISOString()}`)
      .limit(100);

    if (queueError) {
      console.error('❌ Error fetching queue:', queueError);
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('✅ No scheduled broadcasts to process at this time');
      return new Response(
        JSON.stringify({ message: 'No scheduled broadcasts to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${queueItems.length} scheduled messages to send`);
    
    // Log scheduled times for debugging
    queueItems.forEach(item => {
      console.log(`Queue item ${item.id}: scheduled for ${item.scheduled_at}`);
    });

    let successCount = 0;
    let failCount = 0;

    // Process each queue item
    for (const item of queueItems) {
      try {
        // Get broadcast log to find user_id
        const { data: broadcastLog, error: logError } = await supabase
          .from('broadcast_logs')
          .select('user_id')
          .eq('id', item.broadcast_log_id)
          .single();

        if (logError || !broadcastLog) {
          console.error('❌ Cannot find broadcast log for queue item:', item.id);
          await supabase
            .from('broadcast_queue')
            .update({
              status: 'failed',
              error_message: 'Broadcast log not found'
            })
            .eq('id', item.id);
          failCount++;
          continue;
        }

        // Get user's OneSender settings
        const { data: settingsData, error: settingsError } = await supabase
          .from('settings')
          .select('key, value')
          .eq('user_id', broadcastLog.user_id)
          .in('key', ['onesender_api_url', 'onesender_api_key']);

        if (settingsError) {
          console.error('❌ Error fetching settings:', settingsError);
          await supabase
            .from('broadcast_queue')
            .update({
              status: 'failed',
              error_message: 'Cannot fetch user settings'
            })
            .eq('id', item.id);
          failCount++;
          continue;
        }

        const settingsMap: any = {};
        if (settingsData) {
          settingsData.forEach((setting: any) => {
            settingsMap[setting.key] = setting.value;
          });
        }

        const apiUrl = settingsMap.onesender_api_url || '';
        const apiKey = settingsMap.onesender_api_key || '';

        if (!apiUrl || !apiKey) {
          console.error('❌ OneSender API not configured for user:', broadcastLog.user_id);
          await supabase
            .from('broadcast_queue')
            .update({
              status: 'failed',
              error_message: 'OneSender API not configured'
            })
            .eq('id', item.id);
          failCount++;
          continue;
        }

        // Send message via OneSender
        const payload: any = {
          to: item.phone,
          type: item.media_type || 'text',
          priority: 10
        };

        // Determine API endpoint based on media type
        let apiEndpoint = apiUrl;
        
        // For image broadcasts, use the media endpoint
        if (payload.type === 'image') {
          apiEndpoint = apiUrl.replace("/api/v1/message/send", "/api/v1/media");
        }

        if (payload.type === 'text') {
          payload.text = { body: item.message };
        } else if (payload.type === 'image') {
          payload.image = { link: item.media_url, caption: item.message };
        } else if (payload.type === 'document') {
          payload.document = { link: item.media_url, caption: item.message };
        }

        console.log(`📤 Sending to ${item.phone}...`);

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const responseData = await response.json();
          console.log(`✅ Message sent to ${item.phone}`, responseData);
          
          await supabase
            .from('broadcast_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', item.id);
          
          // Update broadcast log counters and check if all sent
          const { data: currentLog } = await supabase
            .from('broadcast_logs')
            .select('total_sent, total_recipients, total_failed, status')
            .eq('id', item.broadcast_log_id)
            .single();
          
          if (currentLog) {
            const newTotalSent = (currentLog.total_sent || 0) + 1;
            const totalProcessed = newTotalSent + (currentLog.total_failed || 0);
            const updateData: any = {
              total_sent: newTotalSent
            };
            
            // If all messages processed, update status to completed
            if (totalProcessed >= currentLog.total_recipients) {
              updateData.status = 'completed';
            }
            
            await supabase
              .from('broadcast_logs')
              .update(updateData)
              .eq('id', item.broadcast_log_id);
          }

          successCount++;
        } else {
          const errorText = await response.text();
          console.error(`❌ Failed to send to ${item.phone}:`, response.status, errorText);
          
          const retryCount = (item.retry_count || 0) + 1;
          const isWhatsAppError = errorText.includes('not registered') || 
                                  errorText.includes('not a whatsapp') || 
                                  response.status === 404 ||
                                  response.status === 400;
          
          // If it's a WhatsApp registration error or max retries reached, mark as failed immediately
          if (isWhatsAppError || retryCount >= 3) {
            await supabase
              .from('broadcast_queue')
              .update({
                status: 'failed',
                error_message: isWhatsAppError 
                  ? 'Nomor tidak terdaftar di WhatsApp' 
                  : `Max retries reached: ${errorText}`,
                retry_count: retryCount
              })
              .eq('id', item.id);
            
            // Update broadcast log failed count and check if all processed
            const { data: currentLog } = await supabase
              .from('broadcast_logs')
              .select('total_failed, total_sent, total_recipients, status')
              .eq('id', item.broadcast_log_id)
              .single();
            
            if (currentLog) {
              const newTotalFailed = (currentLog.total_failed || 0) + 1;
              const totalProcessed = newTotalFailed + (currentLog.total_sent || 0);
              const updateData: any = {
                total_failed: newTotalFailed
              };
              
              // If all messages processed, update status to completed
              if (totalProcessed >= currentLog.total_recipients) {
                updateData.status = 'completed';
              }
              
              await supabase
                .from('broadcast_logs')
                .update(updateData)
                .eq('id', item.broadcast_log_id);
            }
          } else {
            // Retry later for temporary errors
            await supabase
              .from('broadcast_queue')
              .update({
                retry_count: retryCount,
                scheduled_at: new Date(Date.now() + 300000).toISOString(), // Retry in 5 minutes
                error_message: `Retry ${retryCount}/3: ${errorText}`
              })
              .eq('id', item.id);
          }
          
          failCount++;
        }

        // Add delay between messages (1-3 seconds)
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      } catch (error: any) {
        console.error(`❌ Error processing queue item ${item.id}:`, error);
        await supabase
          .from('broadcast_queue')
          .update({
            status: 'failed',
            error_message: error.message || 'Network error'
          })
          .eq('id', item.id);
        
        // Update broadcast log failed count
        const { data: currentLog } = await supabase
          .from('broadcast_logs')
          .select('total_failed, total_sent, total_recipients')
          .eq('id', item.broadcast_log_id)
          .single();
        
        if (currentLog) {
          const newTotalFailed = (currentLog.total_failed || 0) + 1;
          const totalProcessed = newTotalFailed + (currentLog.total_sent || 0);
          const updateData: any = {
            total_failed: newTotalFailed
          };
          
          // If all messages processed, update status to completed
          if (totalProcessed >= currentLog.total_recipients) {
            updateData.status = 'completed';
          }
          
          await supabase
            .from('broadcast_logs')
            .update(updateData)
            .eq('id', item.broadcast_log_id);
        }
        
        failCount++;
      }
    }

    console.log(`✅ Processed ${successCount} messages, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        message: 'Processing complete',
        processed: queueItems.length,
        success: successCount,
        failed: failCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});