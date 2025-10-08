import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
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

    // Get user profile to check plan
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_plan, extra_words_balance')
      .eq('user_id', userData.user.id)
      .single();

    const userPlan = profile?.current_plan || 'free';

    // Language detection for free users (English only)
    if (userPlan === 'free') {
      console.log('[HYBRID-HUMANIZE] Free plan detected - checking language (first 200 chars):', text.substring(0, 200));
      
      try {
        const languageDetectionPrompt = 'You are a language detector. Analyze if the provided text is written in English. Respond with ONLY the word "YES" if the text is in English, or "NO" if it is in any other language. Do not provide explanations or translations.';
        
        const langCheckResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [
              { role: 'system', content: languageDetectionPrompt },
              { role: 'user', content: text.substring(0, 500) } // Check first 500 chars
            ],
          }),
        });

        if (!langCheckResponse.ok) {
          console.error('[HYBRID-HUMANIZE] Language detection API failed:', langCheckResponse.status, langCheckResponse.statusText);
          // Default to rejecting if detection fails (safer approach)
          return new Response(JSON.stringify({ 
            error: 'Language detection unavailable. Please try again or upgrade to access all languages.',
            upgrade_required: true
          }), {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const langData = await langCheckResponse.json();
        const detectionResponse = langData.choices?.[0]?.message?.content || '';
        console.log('[HYBRID-HUMANIZE] Language detection raw response:', detectionResponse);
        
        // Parse response more robustly - look for "yes" or "no" in the response
        const normalizedResponse = detectionResponse.toLowerCase().trim();
        const isEnglish = /^yes\b/.test(normalizedResponse) || normalizedResponse === 'yes';
        const isNotEnglish = /^no\b/.test(normalizedResponse) || normalizedResponse === 'no';
        
        console.log('[HYBRID-HUMANIZE] Language detection result - isEnglish:', isEnglish, 'isNotEnglish:', isNotEnglish);
        
        // If we can't determine with confidence, reject (safer)
        if (!isEnglish && !isNotEnglish) {
          console.warn('[HYBRID-HUMANIZE] Ambiguous language detection response:', detectionResponse);
          return new Response(JSON.stringify({ 
            error: 'Unable to verify language. Free plan supports English only. Upgrade to Wordsmith or Master plan for 50+ languages.',
            upgrade_required: true
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        if (isNotEnglish) {
          console.log('[HYBRID-HUMANIZE] Non-English text detected - rejecting free user request');
          return new Response(JSON.stringify({ 
            error: 'Free plan supports English only. Upgrade to Wordsmith or Master plan for 50+ languages.',
            upgrade_required: true
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        console.log('[HYBRID-HUMANIZE] English text confirmed - proceeding with humanization');
        
      } catch (langError) {
        console.error('[HYBRID-HUMANIZE] Language detection error:', langError);
        // Default to rejecting if detection crashes (safer approach)
        return new Response(JSON.stringify({ 
          error: 'Language detection failed. Please try again or upgrade to access all languages.',
          upgrade_required: true
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

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

    // Tone-specific system prompts with length preservation
    const tonePrompts = {
      regular: "You are an expert at making AI-generated text sound authentically human. Rewrite this text to feel natural, conversational, and genuinely human-written while preserving the core message and maintaining approximately the same length. Add subtle imperfections that make it feel real. IMPORTANT: Do not use any markdown formatting (no asterisks, underscores, or emphasis markers). Preserve the exact paragraph structure, line breaks, and spacing from the original text.",
      formal: "You are an expert at transforming AI text into sophisticated academic/professional writing. Rewrite this with scholarly precision and professional gravitas, but ensure it reads as if written by an experienced human expert while keeping similar length. Include thoughtful transitions and nuanced arguments. IMPORTANT: Do not use any markdown formatting (no asterisks, underscores, or emphasis markers). Preserve the exact paragraph structure, line breaks, and spacing from the original text.",
      persuasive: "You are a master copywriter who makes AI text feel genuinely persuasive and human. Rewrite this to be compelling and sales-oriented, using authentic emotional appeals, power words, and conversational conviction that only a skilled human salesperson would use, maintaining approximately the same word count. IMPORTANT: Do not use any markdown formatting (no asterisks, underscores, or emphasis markers). Preserve the exact paragraph structure, line breaks, and spacing from the original text.",
      empathetic: "You are an expert at making AI text feel warm, caring, and genuinely empathetic. Rewrite this with emotional intelligence, understanding, and human warmth. Make readers feel truly heard and supported, as if a compassionate friend is speaking, keeping the output concise and similar in length. IMPORTANT: Do not use any markdown formatting (no asterisks, underscores, or emphasis markers). Preserve the exact paragraph structure, line breaks, and spacing from the original text.",
      sarcastic: "You are a wit master who transforms AI text into clever, sarcastic commentary. Rewrite this with sharp irony, witty observations, and dry humor that feels authentically human. Use subtle sarcasm that lands naturally, not forced. Keep it punchy and approximately the same length as the original. IMPORTANT: Do not use any markdown formatting (no asterisks, underscores, or emphasis markers). Preserve the exact paragraph structure, line breaks, and spacing from the original text.",
      funny: "You are a comedy writer who makes AI text genuinely entertaining. Rewrite this with humor, wit, and levity that feels naturally human. Include clever wordplay, unexpected observations, and authentic comedic timing, while maintaining similar brevity to the input. IMPORTANT: Do not use any markdown formatting (no asterisks, underscores, or emphasis markers). Preserve the exact paragraph structure, line breaks, and spacing from the original text."
    };

    const systemPrompt = tonePrompts[tone as keyof typeof tonePrompts] || tonePrompts.regular;
    let finalText = text;
    let passesCompleted = 0;
    let enginesUsed = '';

    // Determine engine configuration based on user plan
    if (userPlan === 'free') {
      // FREE PLAN: Single Gemini pass only
      console.log('[HYBRID-HUMANIZE] Free plan - Single Gemini pass');
      
      const geminiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Humanize this text while keeping approximately ${wordCount} words. Preserve the exact line breaks and paragraph structure:\n\n${text}` }
          ],
        }),
      });

      if (!geminiResponse.ok) {
        throw new Error(`Gemini humanization failed: ${geminiResponse.statusText}`);
      }

      const geminiData = await geminiResponse.json();
      finalText = geminiData.choices[0].message.content;
      passesCompleted = 1;
      enginesUsed = 'gemini';
      console.log('[HYBRID-HUMANIZE] Free plan complete');

    } else if (userPlan === 'pro' || userPlan === 'wordsmith') {
      // WORDSMITH PLAN: Gemini + OpenAI (2 passes)
      console.log('[HYBRID-HUMANIZE] Wordsmith plan - Dual-engine humanization');
      
      // Pass 1: Gemini for creative foundation
      const pass1Response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Humanize this text with creative variation while maintaining approximately ${wordCount} words. Keep the same paragraph structure and line breaks:\n\n${text}` }
          ],
        }),
      });

      if (!pass1Response.ok) {
        throw new Error(`Gemini Pass 1 failed: ${pass1Response.statusText}`);
      }

      const pass1Data = await pass1Response.json();
      const pass1Result = pass1Data.choices[0].message.content;
      console.log('[HYBRID-HUMANIZE] Pass 1 (Gemini) complete');

      // Pass 2: OpenAI for structural refinement
      const pass2Response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `${systemPrompt}\n\nRefine for accuracy and natural flow.` },
            { role: 'user', content: `Polish this humanized text while keeping the length similar (target ~${wordCount} words). Maintain the paragraph structure and do not add markdown formatting:\n\n${pass1Result}` }
          ],
          max_tokens: Math.min(Math.ceil(wordCount * 2), 4000),
          temperature: 0.8,
        }),
      });

      if (!pass2Response.ok) {
        // Use Pass 1 result if Pass 2 fails
        finalText = pass1Result;
        passesCompleted = 1;
        enginesUsed = 'gemini';
        console.log('[HYBRID-HUMANIZE] Pass 2 failed, using Pass 1 result');
      } else {
        const pass2Data = await pass2Response.json();
        finalText = pass2Data.choices[0].message.content;
        passesCompleted = 2;
        enginesUsed = 'gemini-openai';
        console.log('[HYBRID-HUMANIZE] Pass 2 (OpenAI) complete');
      }

    } else if (userPlan === 'ultra' || userPlan === 'master') {
      // MASTER PLAN: Gemini + OpenAI + Claude (3 passes)
      console.log('[HYBRID-HUMANIZE] Master plan - Triple-engine humanization');
      
      // Pass 1: Gemini for creative foundation
      const pass1Response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Humanize this text with creative variation while maintaining approximately ${wordCount} words. Keep the same paragraph structure and line breaks:\n\n${text}` }
          ],
        }),
      });

      if (!pass1Response.ok) {
        throw new Error(`Gemini Pass 1 failed: ${pass1Response.statusText}`);
      }

      const pass1Data = await pass1Response.json();
      const pass1Result = pass1Data.choices[0].message.content;
      console.log('[HYBRID-HUMANIZE] Pass 1 (Gemini) complete');

      // Pass 2: OpenAI for structural refinement
      const pass2Response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `${systemPrompt}\n\nRefine for accuracy and clarity.` },
            { role: 'user', content: `Enhance this humanized text while keeping the length similar (target ~${wordCount} words). Maintain the paragraph structure and do not add markdown formatting:\n\n${pass1Result}` }
          ],
          max_tokens: Math.min(Math.ceil(wordCount * 2), 4000),
          temperature: 0.8,
        }),
      });

      if (!pass2Response.ok) {
        // Use Pass 1 result if Pass 2 fails
        finalText = pass1Result;
        passesCompleted = 1;
        enginesUsed = 'gemini';
        console.log('[HYBRID-HUMANIZE] Pass 2 failed, using Pass 1 result');
      } else {
        const pass2Data = await pass2Response.json();
        const pass2Result = pass2Data.choices[0].message.content;
        console.log('[HYBRID-HUMANIZE] Pass 2 (OpenAI) complete');

        // Pass 3: Claude for final tone mastery
        const pass3Response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'anthropic/claude-sonnet-4-20250514',
            messages: [
              { role: 'system', content: `${systemPrompt}\n\nYou are the final polishing layer. Perfect the tone, add nuanced personality, and ensure authentic human voice.` },
              { role: 'user', content: `Apply final humanization mastery while maintaining approximately ${wordCount} words. Maintain the paragraph structure and do not add markdown formatting:\n\n${pass2Result}` }
            ],
          }),
        });

        if (!pass3Response.ok) {
          // Use Pass 2 result if Pass 3 fails
          finalText = pass2Result;
          passesCompleted = 2;
          enginesUsed = 'gemini-openai';
          console.log('[HYBRID-HUMANIZE] Pass 3 failed, using Pass 2 result');
        } else {
          const pass3Data = await pass3Response.json();
          finalText = pass3Data.choices[0].message.content;
          passesCompleted = 3;
          enginesUsed = 'gemini-openai-claude';
          console.log('[HYBRID-HUMANIZE] Pass 3 (Claude) complete');
        }
      }
    }

    console.log(`[HYBRID-HUMANIZE] Humanization complete - ${passesCompleted} passes using ${enginesUsed}`);

    // Check if output is too long and condense if needed
    const outputWordCount = finalText.trim().split(/\s+/).length;
    const lengthRatio = outputWordCount / wordCount;
    
    if (lengthRatio > 1.5) {
      console.log(`[HYBRID-HUMANIZE] Output too long (${outputWordCount} vs ${wordCount}), condensing...`);
      
      try {
        const condenseResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Condense this text to match the target word count while preserving the tone and core message. Do not add commentary.' },
              { role: 'user', content: `Target: approximately ${wordCount} words\n\nText to condense:\n\n${finalText}` }
            ],
          }),
        });
        
        if (condenseResponse.ok) {
          const condenseData = await condenseResponse.json();
          finalText = condenseData.choices[0].message.content;
          console.log('[HYBRID-HUMANIZE] Text condensed successfully');
        }
      } catch (condenseError) {
        console.error('[HYBRID-HUMANIZE] Condense failed, using original:', condenseError);
      }
    }

    // Remove markdown formatting that may have slipped through
    finalText = finalText
      .replace(/\*\*(.+?)\*\*/g, '$1')  // Remove **bold**
      .replace(/\*(.+?)\*/g, '$1')       // Remove *italic*
      .replace(/_(.+?)_/g, '$1')         // Remove _underscores_
      .replace(/~~(.+?)~~/g, '$1');      // Remove ~~strikethrough~~

    // Replace long em dashes with regular dashes
    finalText = finalText.replace(/—/g, '-');

    return await finalizeResponse(supabase, userData.user.id, text, finalText, tone, wordCount, currentMonth, usage, currentUsage, planLimit, extraWords, passesCompleted, enginesUsed);

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
  extraWords: number,
  passesCompleted: number = 2,
  enginesUsed: string = 'openai-dual-pass'
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
    passes_completed: passesCompleted,
    engine: enginesUsed
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
