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
    const mayarApiKey = Deno.env.get('MAYAR_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader || '');
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { package_id } = await req.json();

    // Get package details
    const { data: packageData, error: packageError } = await supabase
      .from('packages')
      .select('*')
      .eq('id', package_id)
      .single();

    if (packageError || !packageData) {
      throw new Error('Package not found');
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, email, phone')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    // Create payment proof record first
    const { data: paymentProof, error: paymentError } = await supabase
      .from('payment_proofs')
      .insert({
        user_id: user.id,
        package_id: package_id,
        amount: packageData.price,
        payment_method: 'mayar',
        proof_image_url: '',
        status: 'pending',
        notes: 'Menunggu pembayaran via Mayar'
      })
      .select()
      .single();

    if (paymentError || !paymentProof) {
      throw new Error('Failed to create payment record');
    }

    // Calculate expiry date (7 days from now)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    // Call Mayar API with correct endpoint and format
    const mayarResponse = await fetch('https://api.mayar.id/hl/v1/invoice/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mayarApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: profile.name || 'User',
        email: profile.email,
        mobile: profile.phone || '',
        redirectUrl: `${supabaseUrl.replace('supabase.co', 'lovable.app')}/payment-success?payment_id=${paymentProof.id}`,
        description: `Paket ${packageData.name}`,
        expiredAt: expiryDate.toISOString(),
        items: [{
          quantity: 1,
          rate: Number(packageData.price),
          description: packageData.name
        }]
      }),
    });

    if (!mayarResponse.ok) {
      const errorText = await mayarResponse.text();
      console.error('Mayar API error:', errorText);
      throw new Error('Failed to create Mayar invoice');
    }

    const mayarData = await mayarResponse.json();
    
    console.log('Mayar invoice created:', mayarData);

    // Update payment proof with Mayar transaction ID
    if (mayarData.data?.transactionId) {
      await supabase
        .from('payment_proofs')
        .update({
          notes: `Mayar Transaction ID: ${mayarData.data.transactionId}`
        })
        .eq('id', paymentProof.id);
    }

    // Payment link notification removed - only send notification on successful payment

    return new Response(
      JSON.stringify({ 
        checkout_url: mayarData.data?.link || '',
        payment_id: paymentProof.id,
        transaction_id: mayarData.data?.transactionId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in mayar-checkout:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
