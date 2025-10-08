import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Word packages mapping
const WORD_PACKAGES = {
  'price_1SBtTmH8HT0u8xphU5GJdqWx': { words: 5000, product: 'prod_T89ncgVFrjrNpw' },
  'price_1SBtTzH8HT0u8xphnmDKFThW': { words: 10000, product: 'prod_T89nBIgYrVyrH6' },
  'price_1SBtUhH8HT0u8xph7PlBMQQ2': { words: 25000, product: 'prod_T89o5p42i30Z0D' }
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

    const { priceId } = await req.json();
    if (!priceId || !WORD_PACKAGES[priceId as keyof typeof WORD_PACKAGES]) {
      throw new Error("Invalid price ID");
    }

    const wordPackage = WORD_PACKAGES[priceId as keyof typeof WORD_PACKAGES];
    
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });
    
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      allow_promotion_codes: true,
      success_url: `${req.headers.get("origin")}/dashboard?word_purchase=success&words=${wordPackage.words}`,
      cancel_url: `${req.headers.get("origin")}/dashboard?word_purchase=canceled`,
      metadata: {
        user_id: user.id,
        word_amount: wordPackage.words.toString(),
        product_id: wordPackage.product
      }
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error("Error in purchase-extra-words function:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});