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

// Word limits per plan (web dashboard)
const PLAN_LIMITS = {
  free: 750,          // Shared pool (web + extension)
  wordsmith: 15000,   // Web only
  master: 30000,      // Web (+ 5k extension bonus)
  extension_only: 0,  // Extension only plan has no web access
  pro: 15000,         // Web only
  ultra: 30000        // Web (+ 5k extension bonus)
};

// Extension word limits
const EXTENSION_LIMITS = {
  free: 750,           // Shared with web pool
  extension_only: 5000, // Extension only plan
  ultra: 30000,         // Shared pool with web (no separate bonus)
  master: 30000         // Shared pool with web (no separate bonus, legacy)
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

// Simple Jaccard similarity between word sets
function jaccardSimilarity(a: string, b: string): number {
  try {
    const aw = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
    const bw = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
    if (aw.size === 0 && bw.size === 0) return 1;
    const inter = [...aw].filter((w) => bw.has(w)).length;
    const union = new Set([...aw, ...bw]).size;
    return union === 0 ? 0 : inter / union;
  } catch {
    return 0;
  }
}

const INTENSITY_THRESHOLDS: Record<string, number> = {
  light: 0.85,
  medium: 0.75,
  strong: 0.6,
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

    const { text, tone, source = 'web' } = await req.json(); // source: 'web' or 'extension'
    
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
        error: 'Free plan supports English only. Upgrade to Pro or Ultra plan for 50+ languages.',
        upgrade_required: true
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build language rule for all passes
    const langRule = `Input language detected: ${inputLangName} [${inputLangCode}]. Your output MUST be ${inputLangName} [${inputLangCode}] — NEVER translate or switch languages.`;

    const extraWords = profile?.extra_words_balance || 0;
    
    // Determine word limit and usage column based on source and plan
    const isExtensionRequest = source === 'extension';
    const isExtensionOnlyPlan = userPlan === 'extension_only';
    const hasExtensionAccess = userPlan === 'ultra' || userPlan === 'master';
    const isFreePlan = userPlan === 'free';
    
    // Get or create usage tracking for current month
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('words_used, extension_words_used, requests_count')
      .eq('user_id', userData.user.id)
      .eq('month_year', currentMonth)
      .single();

    const webWordsUsed = usage?.words_used || 0;
    const extensionWordsUsed = usage?.extension_words_used || 0;
    
    // Calculate available words based on plan and source
    let planLimit: number;
    let currentUsage: number;
    let totalAvailableWords: number;
    
    if (isExtensionOnlyPlan) {
      // Extension-Only plan: 5000 extension words, no web access
      if (!isExtensionRequest) {
        return new Response(JSON.stringify({ 
          error: 'Extension-Only plan users must use the Chrome Extension. Upgrade to Pro or Ultra for web access.',
          upgrade_required: true
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      planLimit = EXTENSION_LIMITS.extension_only;
      currentUsage = extensionWordsUsed;
      totalAvailableWords = planLimit - currentUsage;
    } else if (isFreePlan) {
      // Free plan: 750 shared words (web + extension)
      planLimit = PLAN_LIMITS.free;
      currentUsage = webWordsUsed + extensionWordsUsed; // Combined usage for free plan
      totalAvailableWords = planLimit - currentUsage + extraWords;
    } else if (hasExtensionAccess) {
      // Ultra/Master: 30,000 shared words (web + extension combined)
      planLimit = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS] || 30000;
      currentUsage = webWordsUsed + extensionWordsUsed; // Combined usage for shared pool
      totalAvailableWords = planLimit - currentUsage + extraWords;
    } else if (isExtensionRequest) {
      // Pro/Wordsmith: No extension access
      return new Response(JSON.stringify({ 
        error: 'Pro plan does not include Chrome Extension access. Upgrade to Ultra or get Extension-Only plan.',
        upgrade_required: true
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Web request for Pro/Wordsmith
      planLimit = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
      currentUsage = webWordsUsed;
      totalAvailableWords = planLimit - currentUsage + extraWords;
    }
    
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

    // Tone-specific system prompts with ANTI-AI-DETECTION rules as PRIMARY goal
    const tonePrompts = {
      regular: `ANTI-AI-DETECTION RULES (HIGHEST PRIORITY):
❌ FORBIDDEN WORDS: Moreover, Furthermore, Ultimately, Consequently, Therefore, Nevertheless, Subsequently, Additionally, Specifically, Particularly, Essentially
✅ USE INSTEAD: But, So, And, Plus, Also, Now, Then, Still, Yet, Though

HUMAN WRITING RULES:
1. Use contractions naturally (it's, don't, won't, can't, I'm, you're, we're, they're, isn't, aren't)
2. Mix sentence lengths wildly - some short. Others longer with natural flow.
3. Use casual connectors, not formal transitions
4. Add intentional imperfections: occasional fragments. Or comma splices for effect.
5. Break paragraph balance - make some 1 line, others 4-5 lines
6. NO em-dashes (—), use regular hyphens (-) or just commas
7. Vary punctuation - not every sentence needs perfect grammar
8. Add conversational touches when natural: "basically," "honestly," "you know what"

STRUCTURE PRESERVATION:
- Output in exact same language as input (${inputLangName} [${inputLangCode}])
- Keep EVERY line break exactly where it appears
- Preserve list formatting (1. 2. 3. or - bullets)
- Plain text only, no markdown

Rewrite naturally as if a real human typed this casually.`,

      formal: `ANTI-AI-DETECTION RULES (HIGHEST PRIORITY):
❌ REDUCE: Moreover, Furthermore, Consequently (use sparingly, max 1x)
✅ FORMAL ALTERNATIVES: However, Additionally, Therefore (but vary them)

PROFESSIONAL HUMAN WRITING:
1. Use some contractions even in formal writing (it's, don't, can't) - professionals do this
2. Vary sentence structure - not all complex, not all simple
3. Use active voice primarily, passive occasionally
4. Professional but not robotic - real executives write with personality
5. Break up long sentences with semicolons or split them
6. NO em-dashes (—), use colons (:) or regular hyphens (-)

STRUCTURE PRESERVATION:
- Output in exact same language as input (${inputLangName} [${inputLangCode}])
- Keep EVERY line break exactly where it appears
- Preserve list formatting exactly
- Plain text only, no markdown

Write professionally but with natural human flow.`,

      persuasive: `ANTI-AI-DETECTION RULES (HIGHEST PRIORITY):
❌ AVOID: Moreover, Ultimately, Consequently - these kill persuasion
✅ USE: But, So, And, Because, Plus - direct and powerful

PERSUASIVE HUMAN WRITING:
1. Use contractions for impact (you'll, we'll, don't, can't)
2. Vary rhythm - short punchy sentences. Then longer explanatory ones.
3. Use "you" and "your" frequently - talk TO the reader
4. Ask rhetorical questions occasionally
5. Add emotion and urgency naturally
6. NO perfect parallelism - humans don't write that way

STRUCTURE PRESERVATION:
- Output in exact same language as input (${inputLangName} [${inputLangCode}])
- Keep EVERY line break exactly where it appears
- Preserve list formatting exactly
- Plain text only, no markdown

Make it compelling like a human sales pitch, not an AI essay.`,

      empathetic: `ANTI-AI-DETECTION RULES (HIGHEST PRIORITY):
❌ FORBIDDEN: Moreover, Furthermore, Ultimately - these sound cold
✅ USE: And, But, So, Plus - warm and connecting

EMPATHETIC HUMAN WRITING:
1. Use contractions (you're, we're, it's, that's) - sounds warmer
2. Vary sentence flow - some gentle, some reassuring
3. Use "you," "your," and "we" frequently
4. Add softening phrases: "I understand," "That makes sense," "I hear you"
5. Break up text with empathetic pauses (shorter paragraphs)
6. NO clinical language - write like you're talking to a friend

STRUCTURE PRESERVATION:
- Output in exact same language as input (${inputLangName} [${inputLangCode}])
- Keep EVERY line break exactly where it appears
- Preserve list formatting exactly
- Plain text only, no markdown

Write with genuine warmth like a caring human, not a counseling AI.`,

      sarcastic: `ANTI-AI-DETECTION RULES (HIGHEST PRIORITY):
❌ NEVER: Moreover, Furthermore, Consequently - ruins sarcasm completely
✅ USE: But, So, And, Plus, Oh - casual and biting

SARCASTIC HUMAN WRITING:
1. Use contractions heavily (it's, don't, won't, can't, I'm, you're)
2. Vary rhythm for comic effect - setup. Punchline.
3. Add eye-rolling phrases: "Oh great," "Sure," "Obviously," "Naturally"
4. Use italics mentally (write "really" instead of "*really*")
5. Break grammar rules for effect - fragment sentences on purpose
6. Casual tone always - sarcasm doesn't work formally

STRUCTURE PRESERVATION:
- Output in exact same language as input (${inputLangName} [${inputLangCode}])
- Keep EVERY line break exactly where it appears
- Preserve list formatting exactly
- Plain text only, no markdown

Write with human wit and dry humor, not AI-generated "sarcasm."`,

      funny: `ANTI-AI-DETECTION RULES (HIGHEST PRIORITY):
❌ FORBIDDEN: Moreover, Ultimately, Consequently - comedy killer
✅ USE: But, So, And, Plus, Then - setup for punchlines

FUNNY HUMAN WRITING:
1. Use contractions (it's, don't, won't) - funnier and more casual
2. Vary rhythm for comedic timing - build up. Then payoff.
3. Add unexpected comparisons and exaggerations
4. Use fragments and run-ons for comic effect
5. Break rules intentionally - grammar can be funny when broken
6. NO perfect structure - humor thrives on chaos

STRUCTURE PRESERVATION:
- Output in exact same language as input (${inputLangName} [${inputLangCode}])
- Keep EVERY line break exactly where it appears
- Preserve list formatting exactly
- Plain text only, no markdown

Write like a funny human, not an AI trying to tell jokes.`
    };

    const systemPrompt = tonePrompts[tone as keyof typeof tonePrompts] || tonePrompts.regular;
    console.log(`[TONE] Selected tone: "${tone}" - Using ${tone} prompt`);
    let finalText = text;
    let bestSoFar = text;
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
      if (finalText && finalText.trim().length > 0) { bestSoFar = finalText; }
      passesCompleted = 1;
      enginesUsed = 'gemini';
      
      // Verify structure preservation
      const inputLineBreaks = (text.match(/\n/g) || []).length;
      const outputLineBreaks = (finalText.match(/\n/g) || []).length;
      console.log(`[HYBRID-HUMANIZE] Free plan complete - Line breaks: input=${inputLineBreaks}, output=${outputLineBreaks}`);

    } else if (userPlan === 'pro' || userPlan === 'wordsmith') {
      // PRO PLAN: Gemini + OpenAI (2 passes)
      console.log('[HYBRID-HUMANIZE] Pro plan - Dual-engine humanization');
      
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
      if (pass1Result && pass1Result.trim().length > 0) { bestSoFar = pass1Result; }
      
      // Verify structure preservation after Pass 1
      const inputLineBreaks = (text.match(/\n/g) || []).length;
      const pass1LineBreaks = (pass1Result.match(/\n/g) || []).length;
      console.log(`[HYBRID-HUMANIZE] Pass 1 (Gemini) complete - Line breaks: input=${inputLineBreaks}, output=${pass1LineBreaks}`);

      // Pass 2: OpenAI for structural refinement (switched to gpt-5-nano for more casual output)
      const pass2Response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-nano',
          messages: [
            { role: 'system', content: `${systemPrompt}\n\nRefine for accuracy and natural flow.` },
            { role: 'user', content: `${langRule}\n\nABSOLUTELY CRITICAL:\n- Keep EVERY line break exactly where it appears\n- If there are numbered lists, preserve that exact format\n- FORBIDDEN to merge separate lines into paragraphs\n\nInput text:\n${pass1Result}` }
          ],
          max_completion_tokens: Math.min(Math.ceil(wordCount * 2), 4000),
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
        if (finalText && finalText.trim().length > 0) { bestSoFar = finalText; }
        passesCompleted = 2;
        enginesUsed = 'gemini-openai';
        
        // Verify structure preservation after Pass 2
        const pass2LineBreaks = (finalText.match(/\n/g) || []).length;
        console.log(`[HYBRID-HUMANIZE] Pass 2 (OpenAI) complete - Line breaks: output=${pass2LineBreaks}`);
      }

    } else if (userPlan === 'ultra' || userPlan === 'master') {
      // ULTRA PLAN: Gemini + OpenAI + Claude (3 passes)
      console.log('[HYBRID-HUMANIZE] Ultra plan - Triple-engine humanization');
      
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
      if (pass1Result && pass1Result.trim().length > 0) { bestSoFar = pass1Result; }
      
      // Verify structure preservation after Pass 1
      const inputLineBreaks = (text.match(/\n/g) || []).length;
      const pass1LineBreaks = (pass1Result.match(/\n/g) || []).length;
      console.log(`[HYBRID-HUMANIZE] Pass 1 (Gemini) complete - Line breaks: input=${inputLineBreaks}, output=${pass1LineBreaks}`);

      // Pass 2: OpenAI for structural refinement (switched to gpt-5-nano for more casual output)
      const pass2Response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-nano',
          messages: [
            { role: 'system', content: `${systemPrompt}\n\nRefine for accuracy and clarity.` },
            { role: 'user', content: `${langRule}\n\nABSOLUTELY CRITICAL:\n- Keep EVERY line break exactly where it appears\n- If there are numbered lists, preserve that exact format\n- FORBIDDEN to merge separate lines into paragraphs\n\nInput text:\n${pass1Result}` }
          ],
          max_completion_tokens: Math.min(Math.ceil(wordCount * 2), 4000),
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
        if (pass2Result && pass2Result.trim().length > 0) { bestSoFar = pass2Result; }
        
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
          if (finalText && finalText.trim().length > 0) { bestSoFar = finalText; }
          passesCompleted = 3;
          enginesUsed = 'gemini-openai-claude';
          
          // Verify structure preservation after Pass 3
          const pass3LineBreaks = (finalText.match(/\n/g) || []).length;
          console.log(`[HYBRID-HUMANIZE] Pass 3 (Claude) complete - Line breaks: output=${pass3LineBreaks}`);
          
          // Pass 4: Anti-Detection Cleanup (ULTRA/MASTER ONLY)
          console.log('[HYBRID-HUMANIZE] Pass 4: Anti-detection cleanup');
          
          const pass4Response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { 
                  role: 'system', 
                  content: `You are a human writing expert. Your ONLY job: make AI-generated text sound naturally human WITHOUT changing meaning.

REMOVE these AI fingerprints:
- "Moreover," "Furthermore," "Ultimately," "Consequently" → replace with "But," "So," "And," "Plus"
- Em-dashes (—) → use regular hyphens (-) or commas
- Perfect grammar → add natural imperfections (fragments, comma splices)
- Uniform sentences → vary lengths dramatically

ADD human touches:
- Contractions (it's, don't, won't, can't)
- Occasional sentence fragments. For emphasis.
- Conversational asides
- Natural rhythm breaks

PRESERVE STRUCTURE:
- Keep EVERY line break exactly as shown
- Same language: ${inputLangName} [${inputLangCode}]
- Preserve all lists exactly
- Plain text only, no markdown`
                },
                { 
                  role: 'user', 
                  content: `${langRule}\n\nRemove AI patterns from this text while keeping meaning identical:\n\n${finalText}` 
                }
              ],
            }),
          });

          if (!pass4Response.ok) {
            console.log('[HYBRID-HUMANIZE] Pass 4 failed, using Pass 3 result');
          } else {
            const pass4Data = await pass4Response.json();
            finalText = pass4Data.choices[0].message.content;
            if (finalText && finalText.trim().length > 0) { bestSoFar = finalText; }
            passesCompleted = 4;
            enginesUsed = 'gemini-gpt-claude-cleanup';
            
            const pass4LineBreaks = (finalText.match(/\n/g) || []).length;
            console.log(`[HYBRID-HUMANIZE] Pass 4 (Cleanup) complete - Line breaks: output=${pass4LineBreaks}`);
          }
        }
      }
    }

    console.log(`[HYBRID-HUMANIZE] Humanization complete - ${passesCompleted} passes (max 4 for Ultra) using ${enginesUsed}`);

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
          if (finalText && finalText.trim().length > 0) { bestSoFar = finalText; }
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
          if (finalText && finalText.trim().length > 0) { bestSoFar = finalText; }
          console.log('[HYBRID-HUMANIZE] Text condensed successfully');
        }
      } catch (condenseError) {
        console.error('[HYBRID-HUMANIZE] Condense failed, using original:', condenseError);
      }
    }

    // Aggressive AI pattern removal and cleanup
    const preCleanup = finalText;
    finalText = finalText
      // Remove markdown
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_\n]+)_/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/\*/g, '')
      .replace(/_/g, '')
      // Remove AI-style dashes
      .replace(/\s*—\s*/g, ' - ')  // em dash
      .replace(/\s*–\s*/g, ' - ')  // en dash
      // Remove overly formal transition words (if they slipped through)
      .replace(/\bMoreover,\s*/gi, 'But ')
      .replace(/\bFurthermore,\s*/gi, 'Plus ')
      .replace(/\bConsequently,\s*/gi, 'So ')
      .replace(/\bUltimately,\s*/gi, 'In the end, ')
      .replace(/\bNevertheless,\s*/gi, 'Still, ')
      .replace(/\bSubsequently,\s*/gi, 'Then ')
      .replace(/\bAdditionally,\s*/gi, 'Also ')
      // Fix double spaces
      .replace(/  +/g, ' ');

    if (!finalText || finalText.trim().length === 0) {
      console.warn('[HYBRID-HUMANIZE] Empty output after cleanup — reverting to previous non-empty pass');
      if (preCleanup && preCleanup.trim().length > 0) {
        finalText = preCleanup;
      } else if (bestSoFar && bestSoFar.trim().length > 0) {
        finalText = bestSoFar;
      } else {
        console.warn('[HYBRID-HUMANIZE] No non-empty pass result — returning original text');
        finalText = text;
      }
    }

    // Final safety: ensure non-empty before response
    if (!finalText || finalText.trim().length === 0) {
      finalText = text;
    }

    return await finalizeResponse(supabase, userData.user.id, text, finalText, tone, wordCount, currentMonth, usage, currentUsage, planLimit, extraWords, passesCompleted, enginesUsed, source, userPlan);

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
  enginesUsed: string = 'openai-dual-pass',
  source: string = 'web',
  userPlan: string = 'free'
) {
  const isExtensionRequest = source === 'extension';
  const hasExtensionAccess = ['ultra', 'master'].includes(userPlan);
  const isFreePlan = userPlan === 'free';
  
  // For plans with shared pools (Free, Ultra, Master), deduct from extra words if needed
  const hasSharedPool = isFreePlan || hasExtensionAccess;
  const wordsToDeductFromExtra = hasSharedPool ? Math.max(0, (currentUsage + wordCount) - planLimit) : 0;
  const newExtraWordsBalance = extraWords - wordsToDeductFromExtra;
  
  if (usage) {
    // Update the appropriate column based on source
    const updateData: any = {
      requests_count: (usage.requests_count || 0) + 1
    };
    
    if (isExtensionRequest) {
      // Extension requests always update extension_words_used column
      updateData.extension_words_used = (usage.extension_words_used || 0) + wordCount;
    } else {
      // Web requests always update words_used column
      updateData.words_used = (usage.words_used || 0) + wordCount;
    }
    
    await supabase
      .from('usage_tracking')
      .update(updateData)
      .eq('user_id', userId)
      .eq('month_year', currentMonth);
  } else {
    await supabase
      .from('usage_tracking')
      .insert({
        user_id: userId,
        month_year: currentMonth,
        words_used: isExtensionRequest ? 0 : wordCount,
        extension_words_used: isExtensionRequest ? wordCount : 0,
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

  // Calculate remaining words for response (simplified for shared pools)
  const totalRemaining = hasSharedPool 
    ? Math.max(0, planLimit - (currentUsage + wordCount)) + newExtraWordsBalance
    : Math.max(0, planLimit - (currentUsage + wordCount)) + (!isExtensionRequest ? newExtraWordsBalance : 0);

  return new Response(JSON.stringify({
    humanized_text: humanizedText,
    word_count: wordCount,
    remaining_words: Math.max(0, planLimit - (currentUsage + wordCount)),
    extra_words_remaining: newExtraWordsBalance,
    total_remaining: totalRemaining,
    passes_completed: passesCompleted,
    engine: enginesUsed,
    editor_note: editorNote || undefined,
    source: source
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
