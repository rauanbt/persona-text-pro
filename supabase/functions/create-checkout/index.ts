import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const { priceId, fromExtension } = await req.json();
    if (!priceId) throw new Error("Price ID is required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    // Prefer the saved stripe_customer_id from the profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id as string | null | undefined;

    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        // Best-effort: persist it so future calls are stable
        await supabaseClient.from('profiles').upsert({
          user_id: user.id,
          email: user.email,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      }
    }

    // Calculate next 1st of month for billing cycle anchor
    const getNextFirstOfMonth = (): number => {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return Math.floor(nextMonth.getTime() / 1000); // Unix timestamp
    };

    // Calculate prorated word allocation for display
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate() + 1;

    // Plan catalog with full monthly words and prices
    const planDetails = {
      ultra: { fullWords: 40000, monthlyPrice: 39.95 },
      extension: { fullWords: 5000, monthlyPrice: 9.95 },
      pro: { fullWords: 15000, monthlyPrice: 19.95 },
    } as const;

    let planType: keyof typeof planDetails = 'ultra';

    // Infer plan type from priceId
    if (priceId.includes('extension') || priceId.includes('QL6VqZJQ77U4W')) {
      planType = 'extension';
    } else if (priceId.includes('pro')) {
      planType = 'pro';
    }

    const { fullWords, monthlyPrice } = planDetails[planType];

    // Words & price for the remaining days of this month
    const proratedWords = Math.floor(fullWords * (daysRemaining / daysInMonth));
    const proratedPrice = (monthlyPrice * (daysRemaining / daysInMonth)).toFixed(2);

    // Next full billing month name
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthName = nextMonth.toLocaleString('default', { month: 'long' });
    const thisMonthName = now.toLocaleString('default', { month: 'long' });

    const session = await stripe.checkout.sessions.create({
      customer: customerId || undefined,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        { 
          price: priceId, 
          quantity: 1
        },
      ],
      mode: "subscription",
      allow_promotion_codes: true,
      subscription_data: {
        billing_cycle_anchor: getNextFirstOfMonth(),
        proration_behavior: 'create_prorations',
      },
      custom_text: {
        submit: {
          message: `**Today's charge ($${proratedPrice}):** ~${proratedWords.toLocaleString()} words for the remaining ${daysRemaining} days of ${thisMonthName}.\n\n**Starting ${nextMonthName} 1st:** Full ${fullWords.toLocaleString()} words for $${monthlyPrice}/month.`,
        },
      },
      success_url: fromExtension
        ? `${req.headers.get("origin")}/extension-auth?from=extension&payment=success`
        : `${req.headers.get("origin")}/dashboard?success=true`,
      cancel_url: `${req.headers.get("origin")}/dashboard?canceled=true`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});