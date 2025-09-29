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

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let subscriptionEnd = null;
    let plan = 'free';

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
      
      productId = subscription.items.data[0].price.product as string;
      
      // Map product IDs to plan names
      // Legacy product IDs (keep for existing subscriptions)
      if (productId === 'prod_T7ntjXdJir4pJK') {
        plan = 'pro';
      } else if (productId === 'prod_T7ntTU0aXJOIQG') {
        plan = 'ultra';
      }
      // New product IDs with proper monthly/annual billing
      else if (productId === 'prod_T8xfT16dTSyc0w' || productId === 'prod_T8xfeFL87HWXEJ') {
        plan = 'pro';
      } else if (productId === 'prod_T8xfimkR17s4fn' || productId === 'prod_T8xfxAmZCZ7NYv') {
        plan = 'ultra';
      }
      // Updated product IDs for 40% off annual plans
      else if (productId === 'prod_T8y7e3nrqQ6aOa') {
        plan = 'pro';
      } else if (productId === 'prod_T8y8LHh8jAESaK') {
        plan = 'ultra';
      }
      
      logStep("Determined subscription tier", { productId, plan });
      
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