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
  wordsmith: 15000,
  master: 30000,
  pro: 15000, // legacy
  ultra: 30000 // legacy
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[HYBRID-HUMANIZE] Starting hybrid humanization request');
    
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
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Get user profile to check plan and extra words
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_plan, extra_words_balance')
      .eq('user_id', userData.user.id)
      .single();

    const userPlan = profile?.current_plan || 'free';
    const extraWords = profile?.extra_words_balance || 0;
    const planLimit = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;

    // Get or create usage tracking for current month
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('words_used, requests_count')
      .eq('user_id', userData.user.id)
      .eq('month_year', currentMonth)
      .single();

    const currentUsage = usage?.words_used || 0;
    const totalAvailableWords = planLimit - currentUsage + extraWords;
    
    // Check if user would exceed their total available words
    if (wordCount > totalAvailableWords) {
      return new Response(JSON.stringify({ 
        error: 'Word limit exceeded',
        current_usage: currentUsage,
        plan_limit: planLimit,
        extra_words: extraWords,
        total_available: totalAvailableWords,
        requested_words: wordCount
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[HYBRID-HUMANIZE] Starting dual-pass processing');

    // PASS 1: Initial humanization with tone-specific prompts
    const tonePrompts = {
      regular: "You are an expert at making AI-generated text sound authentically human. Rewrite this text to feel natural, conversational, and genuinely human-written while preserving the core message. Add subtle imperfections that make it feel real.",
      formal: "You are an expert at transforming AI text into sophisticated academic/professional writing. Rewrite this with scholarly precision and professional gravitas, but ensure it reads as if written by an experienced human expert. Include thoughtful transitions and nuanced arguments.",
      persuasive: "You are a master copywriter who makes AI text feel genuinely persuasive and human. Rewrite this to be compelling and sales-oriented, using authentic emotional appeals, power words, and conversational conviction that only a skilled human salesperson would use.",
      empathetic: "You are an expert at making AI text feel warm, caring, and genuinely empathetic. Rewrite this with emotional intelligence, understanding, and human warmth. Make readers feel truly heard and supported, as if a compassionate friend is speaking.",
      sarcastic: "You are a wit master who transforms AI text into clever, sarcastic commentary. Rewrite this with sharp irony, witty observations, and dry humor that feels authentically human. Use subtle sarcasm that lands naturally, not forced.",
      funny: "You are a comedy writer who makes AI text genuinely entertaining. Rewrite this with humor, wit, and levity that feels naturally human. Include clever wordplay, unexpected observations, and authentic comedic timing."
    };

    const pass1Response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: tonePrompts[tone as keyof typeof tonePrompts] || tonePrompts.regular
          },
          { role: 'user', content: text }
        ],
        max_tokens: Math.min(Math.ceil(wordCount * 2), 4000),
        temperature: 0.8,
      }),
    });

    if (!pass1Response.ok) {
      throw new Error(`OpenAI Pass 1 error: ${pass1Response.statusText}`);
    }

    const pass1Data = await pass1Response.json();
    const pass1Result = pass1Data.choices[0].message.content;
    
    console.log('[HYBRID-HUMANIZE] Pass 1 completed, starting Pass 2');

    // PASS 2: Add human quirks and variations
    const pass2Prompt = `You are an expert at making text feel authentically human by adding natural imperfections and human quirks.

Your task: Take this already-humanized text and make it even MORE human by:
1. Varying sentence structures and lengths naturally
2. Adding occasional contractions where appropriate
3. Including natural transitions and filler phrases (sparingly)
4. Introducing subtle vocabulary variations
5. Adding personality through word choice
6. Breaking some "perfect grammar" rules where humans naturally would
7. Including natural emphasis and rhythm

DO NOT change the core message or tone. Just make it feel like a real human wrote this off-the-cuff.

Text to enhance:
${pass1Result}`;

    const pass2Response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert at making text feel authentically human with natural imperfections.' },
          { role: 'user', content: pass2Prompt }
        ],
        max_tokens: Math.min(Math.ceil(wordCount * 2), 4000),
        temperature: 0.9, // Higher temperature for more variation
      }),
    });

    if (!pass2Response.ok) {
      console.error('[HYBRID-HUMANIZE] Pass 2 failed, using Pass 1 result');
      // If Pass 2 fails, use Pass 1 result
      const finalText = pass1Result;
      return await finalizeResponse(supabase, userData.user.id, text, finalText, tone, wordCount, currentMonth, usage, currentUsage, planLimit, extraWords);
    }

    const pass2Data = await pass2Response.json();
    const finalText = pass2Data.choices[0].message.content;
    
    console.log('[HYBRID-HUMANIZE] Pass 2 completed successfully');

    return await finalizeResponse(supabase, userData.user.id, text, finalText, tone, wordCount, currentMonth, usage, currentUsage, planLimit, extraWords);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[HYBRID-HUMANIZE] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function finalizeResponse(
  supabase: any,
  userId: string,
  originalText: string,
  humanizedText: string,
  tone: string,
  wordCount: number,
  currentMonth: string,
  usage: any,
  currentUsage: number,
  planLimit: number,
  extraWords: number
) {
  // Update usage tracking and deduct from extra words if needed
  const wordsToDeductFromExtra = Math.max(0, (currentUsage + wordCount) - planLimit);
  const newExtraWordsBalance = extraWords - wordsToDeductFromExtra;
  
  if (usage) {
    await supabase
      .from('usage_tracking')
      .update({
        words_used: currentUsage + wordCount,
        requests_count: (usage.requests_count || 0) + 1
      })
      .eq('user_id', userId)
      .eq('month_year', currentMonth);
  } else {
    await supabase
      .from('usage_tracking')
      .insert({
        user_id: userId,
        month_year: currentMonth,
        words_used: wordCount,
        requests_count: 1
      });
  }

  // Update extra words balance if we used any extra words
  if (wordsToDeductFromExtra > 0) {
    await supabase
      .from('profiles')
      .update({
        extra_words_balance: newExtraWordsBalance
      })
      .eq('user_id', userId);
  }

  // Log the humanization request
  await supabase
    .from('humanization_requests')
    .insert({
      user_id: userId,
      original_text: originalText,
      humanized_text: humanizedText,
      tone,
      word_count: wordCount
    });

  return new Response(JSON.stringify({ 
    humanized_text: humanizedText,
    word_count: wordCount,
    remaining_words: Math.max(0, planLimit - (currentUsage + wordCount)),
    extra_words_remaining: newExtraWordsBalance,
    total_remaining: Math.max(0, planLimit - (currentUsage + wordCount)) + newExtraWordsBalance,
    passes_completed: 2,
    engine: 'hybrid-dual-pass'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
