import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Word packages mapping - Fair pricing matching subscription rates
const WORD_PACKAGES = {
  'price_1SGMdHH8HT0u8xphUzFMp76X': { words: 5000, product: 'prod_TCmBoml8yJhyVw' },
  'price_1SGMdfH8HT0u8xphHTN0OW9z': { words: 10000, product: 'prod_TCmCV3WdukTux9' },
  'price_1SGMe7H8HT0u8xphkppIAPEh': { words: 25000, product: 'prod_TCmCWyhsstQAjc' }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("Session ID is required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });
    
    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== 'paid') {
      throw new Error('Payment not completed');
    }

    if (session.metadata?.user_id !== user.id) {
      throw new Error('Session does not belong to this user');
    }

    const priceId = session.line_items?.data[0]?.price?.id;
    if (!priceId || !WORD_PACKAGES[priceId as keyof typeof WORD_PACKAGES]) {
      throw new Error('Invalid price ID');
    }

    const wordPackage = WORD_PACKAGES[priceId as keyof typeof WORD_PACKAGES];
    
    // Get current extra words balance
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('extra_words_balance')
      .eq('user_id', user.id)
      .single();

    const currentBalance = profile?.extra_words_balance || 0;
    const newBalance = currentBalance + wordPackage.words;

    // Update extra words balance
    await supabaseClient
      .from('profiles')
      .update({
        extra_words_balance: newBalance
      })
      .eq('user_id', user.id);

    // Record the purchase
    await supabaseClient
      .from('extra_word_purchases')
      .insert({
        user_id: user.id,
        product_id: wordPackage.product,
        price_id: priceId,
        word_amount: wordPackage.words,
        amount_paid: session.amount_total || 0,
        stripe_payment_intent_id: session.payment_intent
      });

    return new Response(JSON.stringify({ 
      success: true,
      words_added: wordPackage.words,
      new_balance: newBalance
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error("Error in process-word-purchase function:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});