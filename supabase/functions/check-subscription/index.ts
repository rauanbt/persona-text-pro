import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, updating unsubscribed state");
      // Update user profile to free plan
      await supabaseClient
        .from('profiles')
        .update({ current_plan: 'free' })
        .eq('user_id', user.id);
        
      return new Response(JSON.stringify({ 
        subscribed: false, 
        product_id: null,
        plan: 'free'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Fetch all subscriptions and filter for valid statuses
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10,
    });
    
    // Filter for active, trialing, or past_due subscriptions
    const validSubscriptions = subscriptions.data.filter(
      (sub: Stripe.Subscription) => sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due'
    );
    
    const hasActiveSub = validSubscriptions.length > 0;
    let productId = null;
    let subscriptionEnd = null;
    let plan = 'free';

    if (hasActiveSub) {
      const subscription = validSubscriptions[0];
      
      // Safely handle current_period_end (may be null for some trial/discounted subs)
      if (subscription.current_period_end) {
        subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      } else {
        subscriptionEnd = null;
        logStep("Subscription end date not available", { subscriptionId: subscription.id, status: subscription.status });
      }
      
      const priceId = subscription.items.data[0].price.id;
      productId = subscription.items.data[0].price.product as string;
      
      logStep("Subscription found", { 
        subscriptionId: subscription.id, 
        status: subscription.status,
        priceId,
        productId,
        endDate: subscriptionEnd 
      });
      
      // Map both price IDs and product IDs to plan names
      // Pro plan mappings
      const proPriceIds = [
        'price_1SD818H8HT0u8xph48V9GxXG',  // Pro monthly
        'price_1SD81lH8HT0u8xph8dYBxkqi',  // Pro annual
        'price_1SCfkBH8HT0u8xpho4UsDBf8',  // Pro monthly (40% off)
        'price_1SCgBNH8HT0u8xphoiFMa331'   // Pro annual (40% off)
      ];
      const proProductIds = [
        'prod_T7ntjXdJir4pJK',
        'prod_T8xfT16dTSyc0w',
        'prod_T8xfeFL87HWXEJ',
        'prod_T8y7e3nrqQ6aOa'
      ];
      
      // Ultra plan mappings
      const ultraPriceIds = [
        'price_1SD81xH8HT0u8xphuqiq8xet',  // Ultra monthly
        'price_1SD828H8HT0u8xphUaDaMTDV',  // Ultra annual
        'price_1SCfkUH8HT0u8xphj7aOiKux',  // Ultra monthly (40% off)
        'price_1SCgCCH8HT0u8xphO8rBX20v'   // Ultra annual (40% off)
      ];
      const ultraProductIds = [
        'prod_T7ntTU0aXJOIQG',
        'prod_T8xfimkR17s4fn',
        'prod_T8xfxAmZCZ7NYv',
        'prod_T8y8LHh8jAESaK'
      ];
      
      // Determine plan based on price_id or product_id
      if (proPriceIds.includes(priceId) || proProductIds.includes(productId)) {
        plan = 'pro';
      } else if (ultraPriceIds.includes(priceId) || ultraProductIds.includes(productId)) {
        plan = 'ultra';
      } else {
        // Default to pro if we have a subscription but don't recognize the IDs
        plan = 'pro';
        logStep("Unknown price/product ID, defaulting to pro", { priceId, productId });
      }
      
      logStep("Determined subscription tier", { priceId, productId, plan });
      
      // Update user profile with current plan
      await supabaseClient
        .from('profiles')
        .update({ 
          current_plan: plan,
          stripe_customer_id: customerId
        })
        .eq('user_id', user.id);
    } else {
      logStep("No active subscription found");
      // Update user profile to free plan
      await supabaseClient
        .from('profiles')
        .update({ 
          current_plan: 'free',
          stripe_customer_id: customerId
        })
        .eq('user_id', user.id);
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      subscription_end: subscriptionEnd,
      plan: plan
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});