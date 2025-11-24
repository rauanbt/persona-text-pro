import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CANONICAL PLAN LIMITS - Single source of truth (Pro plan removed)
const PLAN_LIMITS = {
  free: 500,
  extension_only: 5000,
  ultra: 40000,
  master: 30000, // legacy
} as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[USAGE-SUMMARY] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract token from Bearer header
    const token = authHeader.replace('Bearer ', '');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Pass token directly to getUser for proper authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('[USAGE-SUMMARY] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[USAGE-SUMMARY] User authenticated:', user.id, user.email);

    // Get profile data including first subscription date
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('current_plan, extra_words_balance, first_subscription_date')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('[USAGE-SUMMARY] Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentPlan = profile.current_plan || 'free';
    const extraWords = profile.extra_words_balance || 0;
    const firstSubscriptionDate = profile.first_subscription_date;

    // Get current month usage
    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const { data: usage, error: usageError } = await supabase
      .from('usage_tracking')
      .select('words_used, extension_words_used, requests_count')
      .eq('user_id', user.id)
      .eq('month_year', monthYear)
      .single();

    if (usageError && usageError.code !== 'PGRST116') {
      console.error('[USAGE-SUMMARY] Usage fetch error:', usageError);
    }

    const webUsed = usage?.words_used || 0;
    const extUsed = usage?.extension_words_used || 0;
    const requestsCount = usage?.requests_count || 0;

    // Calculate base plan limit
    let planLimit: number = PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS] || 0;
    
    // Calculate if this is first month (prorated)
    let isFirstMonth = false;
    let daysRemainingInFirstMonth = 0;
    
    if (firstSubscriptionDate && currentPlan !== 'free') {
      const firstSubDate = new Date(firstSubscriptionDate);
      const firstSubMonthYear = `${firstSubDate.getFullYear()}-${String(firstSubDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Check if current month is the first subscription month
      if (monthYear === firstSubMonthYear) {
        isFirstMonth = true;
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        daysRemainingInFirstMonth = daysInMonth - firstSubDate.getDate() + 1;
        
        // Prorate the plan limit for first month
        const basePlanLimit = PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS] || 0;
        planLimit = Math.floor(basePlanLimit * (daysRemainingInFirstMonth / daysInMonth));
        console.log('[USAGE-SUMMARY] First month detected, prorating limit', {
          originalLimit: basePlanLimit,
          proratedLimit: planLimit,
          daysRemaining: daysRemainingInFirstMonth,
          daysInMonth
        });
      }
    }
    
    // Shared plans: free, ultra, master (web + extension share the pool)
    const sharedPlans = ['free', 'ultra', 'master'];
    const isSharedPlan = sharedPlans.includes(currentPlan);
    
    // For shared plans, total usage = web + extension
    // For extension_only, web usage doesn't count against extension limit
    // For pro (deprecated), no extension access
    const sharedUsed = isSharedPlan ? webUsed + extUsed : webUsed;
    
    // Remaining in shared pool (includes extra words)
    const remainingShared = Math.max(0, planLimit - sharedUsed) + extraWords;
    
    // Extension-specific calculations
    let extensionLimit = 0;
    let extensionRemaining = 0;
    
    if (currentPlan === 'extension_only') {
      extensionLimit = 5000;
      extensionRemaining = Math.max(0, extensionLimit - extUsed);
    } else if (isSharedPlan) {
      extensionLimit = planLimit;
      extensionRemaining = remainingShared; // Shares the same pool
    }

    const response = {
      plan: currentPlan,
      plan_limit: planLimit,
      web_used: webUsed,
      extension_used: extUsed,
      shared_used: sharedUsed,
      remaining_shared: remainingShared,
      extension_limit: extensionLimit,
      extension_remaining: extensionRemaining,
      extra_words: extraWords,
      requests_count: requestsCount,
      month_year: monthYear,
      is_first_month: isFirstMonth,
      days_remaining_in_first_month: daysRemainingInFirstMonth,
      resets_on: '1st of each month',
    };

    console.log('[USAGE-SUMMARY] Calculated usage:', JSON.stringify(response));

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[USAGE-SUMMARY] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
