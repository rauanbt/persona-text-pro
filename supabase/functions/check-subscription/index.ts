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

    // Read profile to prefer saved Stripe customer id
    const { data: profileData } = await supabaseClient
      .from('profiles')
      .select('current_plan, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const oldPlan = profileData?.current_plan || 'free';
    let savedCustomerId = profileData?.stripe_customer_id as string | null | undefined;
    logStep("Current plan fetched", { oldPlan, hasStripeCustomerId: !!savedCustomerId });

    // Helper to find a customer with a valid subscription among multiple customers
    const findCustomerWithValidSub = async (email: string): Promise<string | null> => {
      const customers = await stripe.customers.list({ email, limit: 100 });
      logStep("Stripe customers fetched by email", { count: customers.data.length });
      for (const c of customers.data) {
        const subs = await stripe.subscriptions.list({ customer: c.id, limit: 10 });
        const match = subs.data.find((s: any) => (
          s.status === 'active' || s.status === 'trialing' || s.status === 'past_due'
        ));
        if (match) {
          logStep("Selected customer with valid subscription", { customerId: c.id, subscriptionId: match.id, status: match.status });
          return c.id;
        }
      }
      return customers.data[0]?.id || null;
    };

    // Resolve the customer id to use
    let customerId = savedCustomerId || null;
    if (!customerId) {
      customerId = await findCustomerWithValidSub(user.email) as string | null;
      if (customerId) {
        // Persist the resolved customer id for future stability
        await supabaseClient.from('profiles').upsert({
          user_id: user.id,
          email: user.email,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        logStep("Persisted stripe_customer_id on profile", { customerId });
      }
    }

    if (!customerId) {
      logStep("No Stripe customer found for user, marking as free");
      await supabaseClient.from('profiles').upsert({
        user_id: user.id,
        email: user.email,
        current_plan: 'free',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      return new Response(JSON.stringify({
        subscribed: false,
        product_id: null,
        subscription_end: null,
        plan: 'free',
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    // Fetch subscriptions for the resolved customer id
    const subscriptions = await stripe.subscriptions.list({ customer: customerId as string, limit: 10 });
    const validSubscriptions = subscriptions.data.filter((sub: any) => (
      sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due'
    ));

    const hasActiveSub = validSubscriptions.length > 0;
    let productId: string | null = null;
    let subscriptionEnd: string | null = null;
    let plan: 'free' | 'pro' | 'ultra' = 'free';

    if (hasActiveSub) {
      const subscription = validSubscriptions[0];
      if (subscription.current_period_end) {
        subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      } else {
        logStep("Subscription end date not available", { subscriptionId: subscription.id, status: subscription.status });
      }

      const item = subscription.items.data[0];
      const priceId = item.price.id;
      productId = item.price.product as string;

      logStep("Subscription found", { subscriptionId: subscription.id, status: subscription.status, priceId, productId, endDate: subscriptionEnd });

      // Plan mappings (keep existing IDs)
      const proPriceIds = [
        'price_1SD818H8HT0u8xph48V9GxXG',
        'price_1SD81lH8HT0u8xph8dYBxkqi',
        'price_1SCfkBH8HT0u8xpho4UsDBf8',
        'price_1SCgBNH8HT0u8xphoiFMa331',
      ];
      const proProductIds = [
        'prod_T7ntjXdJir4pJK',
        'prod_T8xfT16dTSyc0w',
        'prod_T8xfeFL87HWXEJ',
        'prod_T8y7e3nrqQ6aOa',
      ];
      const ultraPriceIds = [
        'price_1SD81xH8HT0u8xphuqiq8xet',
        'price_1SD828H8HT0u8xphUaDaMTDV',
        'price_1SCfkUH8HT0u8xphj7aOiKux',
        'price_1SCgCCH8HT0u8xphO8rBX20v',
      ];
      const ultraProductIds = [
        'prod_T7ntTU0aXJOIQG',
        'prod_T8xfimkR17s4fn',
        'prod_T8xfxAmZCZ7NYv',
        'prod_T8y8LHh8jAESaK',
      ];

      if (proPriceIds.includes(priceId) || proProductIds.includes(productId)) {
        plan = 'pro';
      } else if (ultraPriceIds.includes(priceId) || ultraProductIds.includes(productId)) {
        plan = 'ultra';
      } else {
        plan = 'pro';
        logStep("Unknown price/product ID, defaulting to pro", { priceId, productId });
      }

      logStep("Determined subscription tier", { priceId, productId, plan });

      // Reset monthly usage if this is an upgrade
      const hierarchy = { free: 0, pro: 1, ultra: 2 } as const;
      const isUpgrade = hierarchy[plan] > hierarchy[(oldPlan as keyof typeof hierarchy) ?? 'free'];
      if (isUpgrade) {
        logStep("Plan upgrade detected, resetting word count", { oldPlan, newPlan: plan });
        const now = new Date();
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const { error: resetError } = await supabaseClient
          .from('usage_tracking')
          .update({ words_used: 0, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('month_year', monthYear);
        if (resetError) {
          logStep("Error resetting word count", { error: resetError.message });
        } else {
          logStep("Word count reset successfully");
        }
      }

      // Upsert profile with plan and stripe customer id
      await supabaseClient.from('profiles').upsert({
        user_id: user.id,
        email: user.email,
        current_plan: plan,
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } else {
      logStep("No active subscription found");
      await supabaseClient.from('profiles').upsert({
        user_id: user.id,
        email: user.email,
        current_plan: 'free',
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      subscription_end: subscriptionEnd,
      plan,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
