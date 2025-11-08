import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get raw body for signature verification
    const rawBody = await req.text();
    const webhookData = JSON.parse(rawBody);
    
    console.log('Mayar webhook received:', JSON.stringify(webhookData));

    // Verify webhook signature if provided
    const signature = req.headers.get('X-Mayar-Signature') || req.headers.get('X-Webhook-Signature');
    const mayarApiKey = Deno.env.get('MAYAR_API_KEY');
    
    if (signature && mayarApiKey) {
      console.log('Verifying webhook signature...');
      
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(mayarApiKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(rawBody)
      );
      
      const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      if (signature !== expectedSignature) {
        console.error('❌ Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid webhook signature' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
          }
        );
      }
      console.log('✅ Webhook signature verified');
    } else {
      console.warn('⚠️ Webhook signature verification skipped - no signature or API key');
    }

    // Extract payment info from webhook - Mayar format
    const eventType = webhookData.event || '';
    const data = webhookData.data || {};
    
    // Only process payment.received events with SUCCESS status
    if (eventType !== 'payment.received' || data.status !== 'SUCCESS') {
      console.log('Skipping non-payment or unsuccessful event', { eventType, status: data.status });
      return new Response(
        JSON.stringify({ success: true, message: 'Event ignored' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    const transactionId = data.id;
    const customerEmail = data.customerEmail;

    // Find payment proof by transaction ID in notes
    const { data: paymentProofs, error: findError } = await supabase
      .from('payment_proofs')
      .select('*')
      .eq('status', 'pending')
      .ilike('notes', `%${transactionId}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (findError || !paymentProofs || paymentProofs.length === 0) {
      console.error('Payment proof not found:', findError);
      return new Response(
        JSON.stringify({ success: false, error: 'Payment proof not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    const paymentProof = paymentProofs[0];
    const userId = paymentProof.user_id;
    const packageId = paymentProof.package_id;

    // Update payment proof to approved
    const { error: updateError } = await supabase
      .from('payment_proofs')
      .update({
        status: 'approved',
        verified_at: new Date().toISOString(),
        notes: `Pembayaran berhasil via Mayar - Transaction ID: ${transactionId}`
      })
      .eq('id', paymentProof.id);

    if (updateError) {
      console.error('Error updating payment proof:', updateError);
      throw updateError;
    }

    // Get package details to calculate new expiry
    const { data: packageData, error: packageError } = await supabase
      .from('packages')
      .select('duration_days, name')
      .eq('id', packageId)
      .single();

    if (!packageError && packageData) {
      // Get current user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('expire_at')
        .eq('user_id', userId)
        .single();

      if (!profileError && profile) {
        // Calculate new expiry date
        const currentExpiry = new Date(profile.expire_at);
        const now = new Date();
        const baseDate = currentExpiry > now ? currentExpiry : now;
        const newExpiry = new Date(baseDate);
        newExpiry.setDate(newExpiry.getDate() + packageData.duration_days);

        // Update user profile
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            expire_at: newExpiry.toISOString(),
            status: 'active',
            plan: 'premium'
          })
          .eq('user_id', userId);

        if (profileUpdateError) {
          console.error('Error updating profile:', profileUpdateError);
        } else {
          console.log('Profile updated successfully, new expiry:', newExpiry);
          
          // Send notification
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'payment',
            title: 'Pembayaran Berhasil',
            message: `Pembayaran paket ${packageData.name} telah dikonfirmasi. Langganan diperpanjang hingga ${newExpiry.toLocaleDateString('id-ID')}`
          });
        }
      }
    }

    console.log('Payment processed successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in mayar-webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
