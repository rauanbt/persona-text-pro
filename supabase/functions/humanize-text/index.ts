import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Word limits per plan
const PLAN_LIMITS = {
  free: 1500,
  pro: 15000,
  ultra: 30000
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error('User not authenticated');
    }

    const { text, tone } = await req.json();
    
    if (!text || !tone) {
      throw new Error('Text and tone are required');
    }

    const wordCount = text.trim().split(/\s+/).length;
    const currentMonth = new Date().toISOString().slice(0, 7); // "2024-01"

    // Get user profile to check plan
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_plan')
      .eq('user_id', userData.user.id)
      .single();

    const userPlan = profile?.current_plan || 'free';
    const planLimit = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS];

    // Get or create usage tracking for current month
    const { data: usage, error: usageError } = await supabase
      .from('usage_tracking')
      .select('words_used, requests_count')
      .eq('user_id', userData.user.id)
      .eq('month_year', currentMonth)
      .single();

    const currentUsage = usage?.words_used || 0;
    
    // Check if user would exceed their limit
    if (currentUsage + wordCount > planLimit) {
      return new Response(JSON.stringify({ 
        error: 'Word limit exceeded',
        current_usage: currentUsage,
        limit: planLimit,
        requested_words: wordCount
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create tone-specific system prompts
    const tonePrompts = {
      regular: "You are an expert at making AI-generated text sound natural and human-written. Rewrite the following text to sound more authentic, conversational, and naturally human while preserving the original meaning and key information.",
      funny: "You are an expert at making AI-generated text sound natural and human-written with a humorous twist. Rewrite the following text to sound more authentic, conversational, and naturally human while adding appropriate humor and wit. Keep the original meaning intact but make it more entertaining.",
      sarcastic: "You are an expert at making AI-generated text sound natural and human-written with a sarcastic tone. Rewrite the following text to sound more authentic, conversational, and naturally human while adding appropriate sarcasm and wit. Maintain the original message but deliver it with clever, sharp-tongued humor.",
      smart: "You are an expert at making AI-generated text sound natural and human-written with sophisticated intelligence. Rewrite the following text to sound more authentic, conversational, and naturally human while elevating the language to be more intellectual and refined. Preserve the meaning but enhance it with thoughtful insights and elegant expression."
    };

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: tonePrompts[tone as keyof typeof tonePrompts]
          },
          { role: 'user', content: text }
        ],
        max_tokens: Math.min(Math.ceil(wordCount * 1.5), 4000),
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const humanizedText = data.choices[0].message.content;

    // Update usage tracking
    if (usage) {
      await supabase
        .from('usage_tracking')
        .update({
          words_used: currentUsage + wordCount,
          requests_count: (usage.requests_count || 0) + 1
        })
        .eq('user_id', userData.user.id)
        .eq('month_year', currentMonth);
    } else {
      await supabase
        .from('usage_tracking')
        .insert({
          user_id: userData.user.id,
          month_year: currentMonth,
          words_used: wordCount,
          requests_count: 1
        });
    }

    // Log the humanization request
    await supabase
      .from('humanization_requests')
      .insert({
        user_id: userData.user.id,
        original_text: text,
        humanized_text: humanizedText,
        tone,
        word_count: wordCount
      });

    return new Response(JSON.stringify({ 
      humanized_text: humanizedText,
      word_count: wordCount,
      remaining_words: planLimit - (currentUsage + wordCount)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in humanize-text function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});