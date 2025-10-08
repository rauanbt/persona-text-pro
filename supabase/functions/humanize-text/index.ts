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

    // Get user profile to check plan and extra words
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_plan, extra_words_balance')
      .eq('user_id', userData.user.id)
      .single();

    const userPlan = profile?.current_plan || 'free';
    const extraWords = profile?.extra_words_balance || 0;
    const planLimit = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS];

    // Get or create usage tracking for current month
    const { data: usage, error: usageError } = await supabase
      .from('usage_tracking')
      .select('words_used, requests_count')
      .eq('user_id', userData.user.id)
      .eq('month_year', currentMonth)
      .single();

    const currentUsage = usage?.words_used || 0;
    const totalAvailableWords = planLimit - currentUsage + extraWords;
    
    // Check if user would exceed their total available words (plan + extra)
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

    // Create tone-specific system prompts
    const tonePrompts = {
      regular: "You are an expert at humanizing AI text. PRIMARY GOAL: Preserve the exact line breaks, paragraph spacing, and text structure from the original. SECONDARY GOAL: Make it sound naturally human. CRITICAL: Do not merge separate paragraphs. Do not merge separate lines. Keep each line break exactly where it is. Do not use markdown formatting (no **, *, _, ~~). Output plain text only.",
      casual: "You are an expert at humanizing AI text with a casual tone. PRIMARY GOAL: Preserve the exact line breaks, paragraph spacing, and text structure from the original. SECONDARY GOAL: Make it informal and friendly. CRITICAL: Do not merge separate paragraphs. Do not merge separate lines. Keep each line break exactly where it is. Do not use markdown formatting (no **, *, _, ~~). Output plain text only.",
      formal: "You are an expert at humanizing AI text with a formal tone. PRIMARY GOAL: Preserve the exact line breaks, paragraph spacing, and text structure from the original. SECONDARY GOAL: Make it professional and polished. CRITICAL: Do not merge separate paragraphs. Do not merge separate lines. Keep each line break exactly where it is. Do not use markdown formatting (no **, *, _, ~~). Output plain text only.",
      funny: "You are an expert at humanizing AI text with humor. PRIMARY GOAL: Preserve the exact line breaks, paragraph spacing, and text structure from the original. SECONDARY GOAL: Add appropriate humor. CRITICAL: Do not merge separate paragraphs. Do not merge separate lines. Keep each line break exactly where it is. Do not use markdown formatting (no **, *, _, ~~). Output plain text only.",
      sarcastic: "You are an expert at humanizing AI text with sarcasm. PRIMARY GOAL: Preserve the exact line breaks, paragraph spacing, and text structure from the original. SECONDARY GOAL: Add sarcasm and wit. CRITICAL: Do not merge separate paragraphs. Do not merge separate lines. Keep each line break exactly where it is. Do not use markdown formatting (no **, *, _, ~~). Output plain text only.",
      smart: "You are an expert at humanizing AI text with intelligence. PRIMARY GOAL: Preserve the exact line breaks, paragraph spacing, and text structure from the original. SECONDARY GOAL: Elevate the language. CRITICAL: Do not merge separate paragraphs. Do not merge separate lines. Keep each line break exactly where it is. Do not use markdown formatting (no **, *, _, ~~). Output plain text only."
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
          { role: 'user', content: `CRITICAL: Keep every line break and paragraph exactly as shown. Do not merge lines:\n\n${text}` }
        ],
        max_tokens: Math.min(Math.ceil(wordCount * 1.5), 4000),
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    let humanizedText = data.choices[0].message.content;

    // Remove markdown formatting more aggressively
    humanizedText = humanizedText
      .replace(/\*\*([^*]+)\*\*/g, '$1')    // Remove **bold**
      .replace(/\*([^*\n]+)\*/g, '$1')       // Remove *italic* (not crossing lines)
      .replace(/__([^_]+)__/g, '$1')         // Remove __bold__
      .replace(/_([^_\n]+)_/g, '$1')         // Remove _italic_
      .replace(/~~([^~]+)~~/g, '$1')         // Remove ~~strikethrough~~
      .replace(/\*/g, '')                    // Remove any remaining lone asterisks
      .replace(/_/g, '');                    // Remove any remaining lone underscores

    // Normalize all dash-like separators to em dashes
    humanizedText = humanizedText
      .replace(/--+/g, '—')                  // Double or longer hyphens -> em dash
      .replace(/(\s)-(\s)/g, '$1—$2')        // Spaced hyphen -> em dash
      .replace(/(\s)–(\s)/g, '$1—$2')        // Spaced en dash -> em dash
      .replace(/\s*—\s*/g, ' — ');           // Normalize spacing around em dash

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

    // Update extra words balance if we used any extra words
    if (wordsToDeductFromExtra > 0) {
      await supabase
        .from('profiles')
        .update({
          extra_words_balance: newExtraWordsBalance
        })
        .eq('user_id', userData.user.id);
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
      remaining_words: Math.max(0, planLimit - (currentUsage + wordCount)),
      extra_words_remaining: newExtraWordsBalance,
      total_remaining: Math.max(0, planLimit - (currentUsage + wordCount)) + newExtraWordsBalance
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in humanize-text function:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});