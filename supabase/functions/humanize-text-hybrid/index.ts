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
  free: 750,
  wordsmith: 15000,
  master: 30000,
  extension_only: 5000,
  pro: 15000, // legacy
  ultra: 30000 // legacy
};

// Lightweight ISO 639-1 language name map for logs/prompts
const ISO_NAME_MAP: Record<string, string> = {
  en: 'English', ru: 'Russian', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', uk: 'Ukrainian', tr: 'Turkish',
  pl: 'Polish', ar: 'Arabic', hi: 'Hindi', id: 'Indonesian', vi: 'Vietnamese', nl: 'Dutch',
  sv: 'Swedish', no: 'Norwegian', fi: 'Finnish'
};

// Detect input language using Lovable AI (Gemini). Returns ISO 639-1 code and readable name.
async function detectLanguageIso(sample: string): Promise<{ code: string; name: string }> {
  try {
    const languageDetectionPrompt = 'Return ONLY the ISO 639-1 two-letter code for the language of the user text. Lowercase. Example: "en". If uncertain, return "en". No extra words.';
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: languageDetectionPrompt },
          { role: 'user', content: sample.substring(0, 500) }
        ],
      }),
    });
    if (!resp.ok) throw new Error(`Language detect failed: ${resp.status} ${resp.statusText}`);
    const data = await resp.json();
    const raw: string = (data.choices?.[0]?.message?.content ?? '').trim().toLowerCase();
    const code = /^[a-z]{2}$/.test(raw) ? raw : (raw.match(/\b[a-z]{2}\b/)?.[0] ?? 'en');
    const name = ISO_NAME_MAP[code] ?? code;
    return { code, name };
  } catch (e) {
    console.error('[LANG] detectLanguageIso error:', e);
    return { code: 'en', name: 'English' };
  }
}

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

    // Detect input language for all plans
    let inputLangCode = 'en';
    let inputLangName = 'English';
    try {
      const det = await detectLanguageIso(text);
      inputLangCode = det.code;
      inputLangName = det.name;
      console.log(`[LANG] Detected inputLang=${inputLangCode} (${inputLangName})`);
    } catch (langError) {
      console.error('[LANG] Language detection failed:', langError);
    }

    // Restrict free plan to English only
    if (userPlan === 'free' && inputLangCode !== 'en') {
      console.log('[HYBRID-HUMANIZE] Non-English text detected - rejecting free user request');
      return new Response(JSON.stringify({ 
        error: 'Free plan supports English only. Upgrade to Wordsmith or Master plan for 50+ languages.',
        upgrade_required: true
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build language rule for all passes
    const langRule = `Input language detected: ${inputLangName} [${inputLangCode}]. Your output MUST be ${inputLangName} [${inputLangCode}] — NEVER translate or switch languages.`;

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

    // Tone-specific system prompts with language + structure preservation as PRIMARY goals
    const tonePrompts = {
      regular: "RULES (follow in order):\n1) Output in the exact same language as the input (no translation).\n2) Preserve ALL line breaks 1:1.\n3) Preserve list formatting exactly.\nThen make subtle human improvements for natural flow. No markdown; plain text only.",
      formal: "RULES (follow in order):\n1) Output in the exact same language as the input (no translation).\n2) Preserve ALL line breaks 1:1.\n3) Preserve list formatting exactly.\nThen transform to a formal, professional tone with appropriate phrasing. No markdown; plain text only.",
      persuasive: "RULES (follow in order):\n1) Output in the exact same language as the input (no translation).\n2) Preserve ALL line breaks 1:1.\n3) Preserve list formatting exactly.\nThen rewrite to be persuasive and compelling with stronger word choices. No markdown; plain text only.",
      empathetic: "RULES (follow in order):\n1) Output in the exact same language as the input (no translation).\n2) Preserve ALL line breaks 1:1.\n3) Preserve list formatting exactly.\nThen add warmth and empathy while keeping meaning faithful. No markdown; plain text only.",
      sarcastic: "RULES (follow in order):\n1) Output in the exact same language as the input (no translation).\n2) Preserve ALL line breaks 1:1.\n3) Preserve list formatting exactly.\nThen rewrite with sarcasm and dry wit while keeping the core message. Example (language must stay the same): English input 'This is great' → English output (sarcastic): 'Oh wow, this is just fantastic.' Do not switch languages. No markdown; plain text only.",
      funny: "RULES (follow in order):\n1) Output in the exact same language as the input (no translation).\n2) Preserve ALL line breaks 1:1.\n3) Preserve list formatting exactly.\nThen add humor and playfulness while preserving meaning. No markdown; plain text only."
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
            { role: 'user', content: `${langRule}\n\nABSOLUTELY CRITICAL:\n- Keep EVERY line break exactly where it appears\n- If there are numbered lists (1. 2. 3.), preserve that exact format\n- FORBIDDEN to merge separate lines into paragraphs\n\nInput text:\n${text}` }
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
      
      // Verify structure preservation
      const inputLineBreaks = (text.match(/\n/g) || []).length;
      const outputLineBreaks = (finalText.match(/\n/g) || []).length;
      console.log(`[HYBRID-HUMANIZE] Free plan complete - Line breaks: input=${inputLineBreaks}, output=${outputLineBreaks}`);

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
            { role: 'user', content: `${langRule}\n\nABSOLUTELY CRITICAL:\n- Keep EVERY line break exactly where it appears\n- If there are numbered lists (1. 2. 3.), preserve that exact format\n- FORBIDDEN to merge separate lines into paragraphs\n\nInput text:\n${text}` }
          ],
        }),
      });

      if (!pass1Response.ok) {
        throw new Error(`Gemini Pass 1 failed: ${pass1Response.statusText}`);
      }

      const pass1Data = await pass1Response.json();
      const pass1Result = pass1Data.choices[0].message.content;
      
      // Verify structure preservation after Pass 1
      const inputLineBreaks = (text.match(/\n/g) || []).length;
      const pass1LineBreaks = (pass1Result.match(/\n/g) || []).length;
      console.log(`[HYBRID-HUMANIZE] Pass 1 (Gemini) complete - Line breaks: input=${inputLineBreaks}, output=${pass1LineBreaks}`);

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
            { role: 'user', content: `${langRule}\n\nABSOLUTELY CRITICAL:\n- Keep EVERY line break exactly where it appears\n- If there are numbered lists, preserve that exact format\n- FORBIDDEN to merge separate lines into paragraphs\n\nInput text:\n${pass1Result}` }
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
        
        // Verify structure preservation after Pass 2
        const pass2LineBreaks = (finalText.match(/\n/g) || []).length;
        console.log(`[HYBRID-HUMANIZE] Pass 2 (OpenAI) complete - Line breaks: output=${pass2LineBreaks}`);
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
            { role: 'user', content: `${langRule}\n\nABSOLUTELY CRITICAL:\n- Keep EVERY line break exactly where it appears\n- If there are numbered lists (1. 2. 3.), preserve that exact format\n- FORBIDDEN to merge separate lines into paragraphs\n\nInput text:\n${text}` }
          ],
        }),
      });

      if (!pass1Response.ok) {
        throw new Error(`Gemini Pass 1 failed: ${pass1Response.statusText}`);
      }

      const pass1Data = await pass1Response.json();
      const pass1Result = pass1Data.choices[0].message.content;
      
      // Verify structure preservation after Pass 1
      const inputLineBreaks = (text.match(/\n/g) || []).length;
      const pass1LineBreaks = (pass1Result.match(/\n/g) || []).length;
      console.log(`[HYBRID-HUMANIZE] Pass 1 (Gemini) complete - Line breaks: input=${inputLineBreaks}, output=${pass1LineBreaks}`);

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
            { role: 'user', content: `${langRule}\n\nABSOLUTELY CRITICAL:\n- Keep EVERY line break exactly where it appears\n- If there are numbered lists, preserve that exact format\n- FORBIDDEN to merge separate lines into paragraphs\n\nInput text:\n${pass1Result}` }
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
        
        // Verify structure preservation after Pass 2
        const pass2LineBreaks = (pass2Result.match(/\n/g) || []).length;
        console.log(`[HYBRID-HUMANIZE] Pass 2 (OpenAI) complete - Line breaks: output=${pass2LineBreaks}`);

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
              { role: 'user', content: `${langRule}\n\nABSOLUTELY CRITICAL:\n- Keep EVERY line break exactly where it appears\n- If there are numbered lists, preserve that exact format\n- FORBIDDEN to merge separate lines into paragraphs\n\nInput text:\n${pass2Result}` }
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
          
          // Verify structure preservation after Pass 3
          const pass3LineBreaks = (finalText.match(/\n/g) || []).length;
          console.log(`[HYBRID-HUMANIZE] Pass 3 (Claude) complete - Line breaks: output=${pass3LineBreaks}`);
        }
      }
    }

    console.log(`[HYBRID-HUMANIZE] Humanization complete - ${passesCompleted} passes using ${enginesUsed}`);

    // Post-generation language verification and correction if needed
    try {
      const outLang = await detectLanguageIso(finalText);
      console.log(`[LANG] Output language detected: ${outLang.name} [${outLang.code}]`);
      if (outLang.code !== inputLangCode) {
        console.warn(`[LANG] Mismatch detected: input=${inputLangCode}, output=${outLang.code} — correcting`);
        const correctionResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: `Rewrite the user's text into ${inputLangName} [${inputLangCode}] without changing meaning, tone ("${tone}"), structure, or formatting. Keep every line break and list exactly as-is. Output plain text only. Do NOT add commentary.` },
              { role: 'user', content: `${langRule}\n\nRewrite this text into the exact same language as specified while keeping tone and structure identical:\n${finalText}` }
            ],
          }),
        });
        if (correctionResp.ok) {
          const corr = await correctionResp.json();
          finalText = corr.choices?.[0]?.message?.content || finalText;
          console.log('[LANG] Correction applied successfully');
        } else {
          console.error('[LANG] Correction failed:', correctionResp.status, correctionResp.statusText);
        }
      }
    } catch (e) {
      console.error('[LANG] Post-generation language verification failed:', e);
    }

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
              { role: 'system', content: 'Condense to target word count while preserving ALL line breaks and paragraph structure exactly. Do not merge separate lines. Output in the SAME LANGUAGE as input (do NOT translate). Output plain text with no markdown.' },
              { role: 'user', content: `${langRule}\nABSOLUTELY CRITICAL:\n- KEEP EVERY LINE BREAK EXACTLY AS SHOWN\n- Condense to ~${wordCount} words\n\nInput text:\n${finalText}` }
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

    // Remove markdown formatting more aggressively
    finalText = finalText
      .replace(/\*\*([^*]+)\*\*/g, '$1')    // Remove **bold**
      .replace(/\*([^*\n]+)\*/g, '$1')       // Remove *italic* (not crossing lines)
      .replace(/__([^_]+)__/g, '$1')         // Remove __bold__
      .replace(/_([^_\n]+)_/g, '$1')         // Remove _italic_
      .replace(/~~([^~]+)~~/g, '$1')         // Remove ~~strikethrough~~
      .replace(/\*/g, '')                    // Remove any remaining lone asterisks
      .replace(/_/g, '');                    // Remove any remaining lone underscores

    // Strip any AI-generated em dashes or en dashes - keep only regular hyphens
    finalText = finalText
      .replace(/\s*—\s*/g, ' - ')            // em dash -> regular hyphen
      .replace(/\s*–\s*/g, ' - ');           // en dash -> regular hyphen

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

  // Calculate text similarity for regular/empathetic tones
  let editorNote = "";
  if (tone === "regular" || tone === "empathetic") {
    const originalWords = new Set(originalText.toLowerCase().split(/\s+/));
    const humanizedWords = new Set(humanizedText.toLowerCase().split(/\s+/));
    const intersection = new Set([...originalWords].filter(x => humanizedWords.has(x)));
    const similarity = intersection.size / Math.max(originalWords.size, 1);
    
    if (similarity > 0.9) {
      editorNote = "Your text already sounds quite natural! Only minor adjustments were made for flow.";
    }
  }

  return new Response(JSON.stringify({ 
    humanized_text: humanizedText,
    word_count: wordCount,
    remaining_words: Math.max(0, planLimit - (currentUsage + wordCount)),
    extra_words_remaining: newExtraWordsBalance,
    total_remaining: Math.max(0, planLimit - (currentUsage + wordCount)) + newExtraWordsBalance,
    passes_completed: passesCompleted,
    engine: enginesUsed,
    editor_note: editorNote || undefined
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
