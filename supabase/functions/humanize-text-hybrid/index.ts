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

// Helper: fetch with abort timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

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

// STRICTER thresholds and higher change targets for FORCE mode
const INTENSITY_THRESHOLDS: Record<string, number> = {
  light: 0.80,
  medium: 0.70,
  strong: 0.55,
  grammar: 0.95,  // Grammar mode allows 95% similarity (minimal changes)
};

const CHANGE_TARGET: Record<string, number> = {
  light: 0.30,   // 30% word change minimum
  medium: 0.45,  // 45% word change minimum
  strong: 0.60,  // 60% word change minimum
  grammar: 0.05, // Grammar mode only 5% change (fix errors only)
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

    const { text, tone, source = 'web', tone_intensity = 'strong', force_rewrite = true, speed_mode = false } = await req.json(); // source: 'web' or 'extension'
    
    if (speed_mode) {
      console.log('[HYBRID-HUMANIZE|SPEED] Speed mode ENABLED - skipping tone booster and language verification for fast response');
    }
    
    if (force_rewrite) {
      console.log('[HYBRID-HUMANIZE|FORCE] Force rewrite mode ENABLED - allowing sentence reordering');
    }
    
    if (!text || !tone) {
      throw new Error('Text and tone are required');
    }

    // Validate text input to prevent resource exhaustion and cost escalation
    if (typeof text !== 'string' || text.length > 100000) {
      return new Response(JSON.stringify({ 
        error: 'Text must be a string with maximum 100,000 characters'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const wordCount = text.trim().split(/\s+/).length;
    
    // Validate word count to prevent excessive API costs
    if (wordCount > 15000) {
      return new Response(JSON.stringify({ 
        error: 'Text must contain fewer than 15,000 words'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
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
      regular: `CRITICAL LENGTH RULES (MUST ENFORCE):
- Output must be ±10-15% of input word count (STRICT LIMIT)
- Don't add extra sentences or explanations
- Don't expand phrases unnecessarily
- Focus on word choice, not word addition
- Keep it tight and concise

ANTI-AI-DETECTION RULES (HIGHEST PRIORITY):
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

STRUCTURE PRESERVATION (ABSOLUTELY NON-NEGOTIABLE):
- Input has [PARAGRAPH_X] markers separating paragraphs
- Each [PARAGRAPH_X] marker must remain on its own line in your output
- NEVER EVER merge multiple [PARAGRAPH_X] sections into one paragraph
- NEVER reorder [PARAGRAPH_X] sections
- Example input:
  [PARAGRAPH_1]
  Hi Alice, thanks for your email!
  
  [PARAGRAPH_2]
  I wanted to follow up on the project.
  
  [PARAGRAPH_3]
  Let me know if you have questions.

- Example correct output:
  [PARAGRAPH_1]
  Hey Alice, appreciate your message!
  
  [PARAGRAPH_2]
  Following up about the project here.
  
  [PARAGRAPH_3]
  Feel free to reach out with any questions.

- WRONG (DO NOT DO THIS): Merging all into one block
- Each paragraph MUST stay separate with its marker
- Preserve ALL line breaks between [PARAGRAPH_X] sections
- Plain text only, no markdown
- Output in exact same language as input (${inputLangName} [${inputLangCode}])

Rewrite naturally as if a real human typed this casually.`,

      formal: `CRITICAL LENGTH RULES (MUST ENFORCE):
- Target output: ${Math.floor(wordCount * 0.9)}-${Math.ceil(wordCount * 1.15)} words (±10-15%)
- "Don't expand" = Don't add NEW SENTENCES or lengthy explanations
- "Do enhance" = Replace informal words with formal equivalents (same length)
- Example: "Hi team" → "Dear colleagues" (same word count) ✅
- Example: "Hi team" → "Greetings to all team members" (expansion) ❌

EXPECTED CHANGE LEVEL:
- Target: 10-20% word changes minimum (not 0%, not 50%)
- Must improve formality even if grammar is already correct
- Zero changes only if text is already perfectly formal/academic
- If input is casual, MUST formalize it within length limits

ANTI-AI-DETECTION RULES (HIGHEST PRIORITY):
❌ REDUCE: Moreover, Furthermore, Consequently (max 1x usage)
✅ FORMAL ALTERNATIVES: However, Additionally, Therefore (vary them)

PROFESSIONAL HUMAN WRITING:
1. Use some contractions in formal writing (it's, don't, can't) - real professionals do
2. Vary sentence structure - mix complex and simple
3. Active voice primarily, passive occasionally
4. Professional but not robotic - maintain personality
5. Break up long sentences with semicolons or split them
6. NO em-dashes (—), use colons (:) or regular hyphens (-)

FORMAL ENHANCEMENTS TO APPLY:
- Casual greetings → Professional greetings ("Hi" → "Dear" / "Hello")
- Incomplete phrasing → Complete formal phrasing
- Casual closings → Professional sign-offs
- Informal word choice → Formal equivalents (same length)

STRUCTURE PRESERVATION (ABSOLUTELY NON-NEGOTIABLE):
- Input has [PARAGRAPH_X] markers separating paragraphs
- Each [PARAGRAPH_X] marker must remain on its own line in your output
- NEVER EVER merge multiple [PARAGRAPH_X] sections into one paragraph
- NEVER reorder [PARAGRAPH_X] sections
- Example input:
  [PARAGRAPH_1]
  Dear Mr. Smith, thank you for your inquiry.
  
  [PARAGRAPH_2]
  I would like to address your concerns.
  
  [PARAGRAPH_3]
  Please feel free to contact me.

- Example correct output:
  [PARAGRAPH_1]
  Dear Mr. Smith, I appreciate your inquiry.
  
  [PARAGRAPH_2]
  I am pleased to address your concerns.
  
  [PARAGRAPH_3]
  Please do not hesitate to contact me.

- WRONG (DO NOT DO THIS): Merging all into one block
- Each paragraph MUST stay separate with its marker
- Preserve ALL line breaks between [PARAGRAPH_X] sections
- Plain text only, no markdown
- Output in exact same language as input (${inputLangName} [${inputLangCode}])

Make it sound like a professional human wrote this formally, not an AI.`,

      persuasive: `CRITICAL LENGTH RULES (MUST ENFORCE):
- Output must be ±10-15% of input word count (STRICT LIMIT)
- Don't add extra sentences or fluff
- Impact through word choice, not length
- Keep it punchy and tight

ANTI-AI-DETECTION RULES (HIGHEST PRIORITY):
❌ AVOID: Moreover, Ultimately, Consequently - these kill persuasion
✅ USE: But, So, And, Because, Plus - direct and powerful

PERSUASIVE HUMAN WRITING:
1. Use contractions for impact (you'll, we'll, don't, can't)
2. Vary rhythm - short punchy sentences. Then longer explanatory ones.
3. Use "you" and "your" frequently - talk TO the reader
4. Ask rhetorical questions occasionally
5. Add emotion and urgency naturally
6. NO perfect parallelism - humans don't write that way

STRUCTURE PRESERVATION (ABSOLUTELY NON-NEGOTIABLE):
- Input has [PARAGRAPH_X] markers separating paragraphs
- Each [PARAGRAPH_X] marker must remain on its own line in your output
- NEVER EVER merge multiple [PARAGRAPH_X] sections into one paragraph
- NEVER reorder [PARAGRAPH_X] sections
- Example input:
  [PARAGRAPH_1]
  This product will save you time.
  
  [PARAGRAPH_2]
  You'll see results fast.
  
  [PARAGRAPH_3]
  Don't wait - order now.

- Example correct output:
  [PARAGRAPH_1]
  This product saves you hours every week.
  
  [PARAGRAPH_2]
  You'll see results within days.
  
  [PARAGRAPH_3]
  Don't miss out - order today.

- WRONG (DO NOT DO THIS): Merging all into one block
- Each paragraph MUST stay separate with its marker
- Preserve ALL line breaks between [PARAGRAPH_X] sections
- Plain text only, no markdown
- Output in exact same language as input (${inputLangName} [${inputLangCode}])

Make it compelling like a human sales pitch, not an AI essay.`,

      empathetic: `CRITICAL LENGTH RULES (MUST ENFORCE):
- Output must be ±10-15% of input word count (STRICT LIMIT)
- Don't add extra reassurances or explanations
- Warmth through tone, not verbosity
- Keep it genuine and concise

ANTI-AI-DETECTION RULES (HIGHEST PRIORITY):
❌ FORBIDDEN: Moreover, Furthermore, Ultimately - these sound cold
✅ USE: And, But, So, Plus - warm and connecting

EMPATHETIC HUMAN WRITING:
1. Use contractions (you're, we're, it's, that's) - sounds warmer
2. Vary sentence flow - some gentle, some reassuring
3. Use "you," "your," and "we" frequently
4. Add softening phrases: "I understand," "That makes sense," "I hear you"
5. Break up text with empathetic pauses (shorter paragraphs)
6. NO clinical language - write like you're talking to a friend

STRUCTURE PRESERVATION (ABSOLUTELY NON-NEGOTIABLE):
- Input has [PARAGRAPH_X] markers separating paragraphs
- Each [PARAGRAPH_X] marker must remain on its own line in your output
- NEVER EVER merge multiple [PARAGRAPH_X] sections into one paragraph
- NEVER reorder [PARAGRAPH_X] sections
- Example input:
  [PARAGRAPH_1]
  I understand how you're feeling.
  
  [PARAGRAPH_2]
  We're here to help you through this.
  
  [PARAGRAPH_3]
  You're not alone in this.

- Example correct output:
  [PARAGRAPH_1]
  I hear you, and I understand how you feel.
  
  [PARAGRAPH_2]
  We're here to support you every step of the way.
  
  [PARAGRAPH_3]
  Remember, you're not alone.

- WRONG (DO NOT DO THIS): Merging all into one block
- Each paragraph MUST stay separate with its marker
- Preserve ALL line breaks between [PARAGRAPH_X] sections
- Plain text only, no markdown
- Output in exact same language as input (${inputLangName} [${inputLangCode}])

Write with genuine warmth like a caring human, not a counseling AI.`,

      sarcastic: `CRITICAL LENGTH RULES (MUST ENFORCE):
- Output must be ±10-15% of input word count (STRICT LIMIT)
- DON'T add extra sarcastic commentary
- Sarcasm through WORD CHOICE, not WORD ADDITION
- Keep it sharp and tight - no rambling
- If input is 50 words, output should be 45-60 words MAX

ANTI-AI-DETECTION RULES (HIGHEST PRIORITY):
❌ NEVER: Moreover, Furthermore, Consequently - ruins sarcasm completely
✅ USE: But, So, And, Plus, Oh - casual and biting

SARCASTIC HUMAN WRITING:
1. Use contractions heavily (it's, don't, won't, can't, I'm, you're)
2. Vary rhythm for comic effect - setup. Punchline.
3. Add eye-rolling phrases: "Oh great," "Sure," "Obviously," "Naturally"
4. Use italics mentally (write "really" instead of "*really*")
5. Break grammar rules for effect - fragment sentences on purpose
6. Casual tone always - sarcasm doesn't work formally

STRUCTURE PRESERVATION (ABSOLUTELY NON-NEGOTIABLE):
- Input has [PARAGRAPH_X] markers separating paragraphs
- Each [PARAGRAPH_X] marker must remain on its own line in your output
- NEVER EVER merge multiple [PARAGRAPH_X] sections into one paragraph
- NEVER reorder [PARAGRAPH_X] sections
- Example input:
  [PARAGRAPH_1]
  Thanks for your help.
  
  [PARAGRAPH_2]
  This is really useful.
  
  [PARAGRAPH_3]
  I appreciate it.

- Example correct output:
  [PARAGRAPH_1]
  Oh, thanks so much. Really needed that.
  
  [PARAGRAPH_2]
  This is super useful. Obviously.
  
  [PARAGRAPH_3]
  I definitely appreciate it.

- WRONG (DO NOT DO THIS): Merging all into one block
- Each paragraph MUST stay separate with its marker
- Preserve ALL line breaks between [PARAGRAPH_X] sections
- Plain text only, no markdown
- Output in exact same language as input (${inputLangName} [${inputLangCode}])

Write with human wit and dry humor, not AI-generated "sarcasm."`,

      grammar: `CRITICAL LENGTH RULES (MUST ENFORCE):
- Output must be ±5% of input word count (VERY STRICT)
- Only fix errors - don't rewrite anything
- Grammar fix should barely change length

GRAMMAR FIX MODE - MINIMAL CHANGES ONLY:

PRIMARY GOAL: Fix grammar mistakes while changing as little as possible.

WHAT TO FIX:
1. Subject-verb agreement (he walk → he walks)
2. Verb tense errors (I go yesterday → I went yesterday)
3. Articles (I have idea → I have an idea)
4. Preposition errors (different with → different from)
5. Plural/singular mismatches (one cars → one car)
6. Capitalization (start of sentences, proper nouns)
7. Missing or wrong punctuation (commas, periods)
8. Replace em-dashes (—) and en-dashes (–) with regular hyphens (-)
9. Basic spelling errors

WHAT NOT TO CHANGE:
❌ Don't rewrite sentences for "better" wording
❌ Don't change word choice unless grammatically wrong
❌ Don't add or remove sentences
❌ Don't reorder sentences
❌ Don't change tone or style
❌ Don't make it "sound better" - just fix errors

STRUCTURE PRESERVATION (ABSOLUTELY NON-NEGOTIABLE):
- Input has [PARAGRAPH_X] markers separating paragraphs
- Each [PARAGRAPH_X] marker must remain on its own line in your output
- NEVER EVER merge multiple [PARAGRAPH_X] sections into one paragraph
- NEVER reorder [PARAGRAPH_X] sections
- Example input:
  [PARAGRAPH_1]
  I go to store yesterday.
  
  [PARAGRAPH_2]
  She have three cars.
  
  [PARAGRAPH_3]
  They was happy.

- Example correct output:
  [PARAGRAPH_1]
  I went to the store yesterday.
  
  [PARAGRAPH_2]
  She has three cars.
  
  [PARAGRAPH_3]
  They were happy.

- WRONG (DO NOT DO THIS): Merging all into one block
- Each paragraph MUST stay separate with its marker
- Preserve ALL line breaks between [PARAGRAPH_X] sections
- If a sentence is grammatically correct, DON'T touch it
- Plain text only, no markdown
- Output in exact same language as input (${inputLangName} [${inputLangCode}])

Fix ONLY what's grammatically wrong. If input is already correct, return it almost unchanged.`
    };

    const systemPrompt = tonePrompts[tone as keyof typeof tonePrompts] || tonePrompts.regular;
    console.log(`[TONE] Selected tone: "${tone}" - Using ${tone} prompt`);
    let finalText = text;
    let bestSoFar = text;
    let passesCompleted = 0;
    let enginesUsed = '';

    // PRE-PROCESS: Add paragraph markers for structure preservation
    const paragraphs = text.split(/\n\n+/);
    const markedText = paragraphs
      .map((p, i) => `[PARAGRAPH_${i + 1}]\n${p.trim()}`)
      .join('\n\n');
    const inputParagraphCount = paragraphs.length;
    console.log(`[STRUCTURE] Input paragraphs: ${inputParagraphCount}`);

    // Determine engine configuration based on user plan
    if (userPlan === 'free') {
      // FREE PLAN: Single Gemini pass only
      console.log('[HYBRID-HUMANIZE] Free plan - Single Gemini pass');
      
      try {
        const geminiResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `${langRule}

INPUT WORD COUNT: ${wordCount} words
OUTPUT TARGET: ${Math.floor(wordCount * 0.9)}-${Math.ceil(wordCount * 1.15)} words (±15% max)

CRITICAL FORMATTING RULES:
- Input has [PARAGRAPH_X] markers
- You MUST keep each [PARAGRAPH_X] marker on its own line
- NEVER merge [PARAGRAPH_X] sections together
- Each paragraph should be humanized separately but maintain its [PARAGRAPH_X] marker

Example correct output:
[PARAGRAPH_1]
First paragraph humanized text here.

[PARAGRAPH_2]
Second paragraph humanized text here.

Input text:
${markedText}` }
            ],
          }),
        }, 15000);

        if (!geminiResponse.ok) {
          throw new Error(`Gemini humanization failed: ${geminiResponse.statusText}`);
        }

        const geminiData = await geminiResponse.json();
        finalText = geminiData.choices[0].message.content;
        
        // POST-PROCESS: Remove ALL paragraph markers (aggressive regex)
        finalText = finalText.replace(/\[PARAGRAPH_?\d+\]\s*/gi, '');
        finalText = finalText.replace(/\[PARAGRAPH\d+\]\s*/gi, '');
        finalText = finalText.replace(/PARAGRAPH\d+/gi, '');
        finalText = finalText.replace(/\n{3,}/g, '\n\n');
        
        if (finalText && finalText.trim().length > 0) { bestSoFar = finalText; }
        passesCompleted = 1;
        enginesUsed = 'gemini';
        
        // Verify structure preservation
        const outputParagraphCount = (finalText.match(/\n\n+/g) || []).length + 1;
        console.log(`[STRUCTURE] Paragraph preservation: input=${inputParagraphCount}, output=${outputParagraphCount}`);
        if (Math.abs(inputParagraphCount - outputParagraphCount) > 2) {
          console.warn('[STRUCTURE] Significant paragraph count mismatch');
        }
      } catch (error) {
        console.error('[HYBRID-HUMANIZE] Free plan error:', error);
        // Return original text on complete failure
        finalText = text;
        bestSoFar = text;
        passesCompleted = 0;
        enginesUsed = 'none';
      }

    } else if (userPlan === 'pro' || userPlan === 'wordsmith') {
      // PRO PLAN: Gemini + OpenAI (2 passes)
      console.log('[HYBRID-HUMANIZE] Pro plan - Dual-engine humanization');
      
      try {
        // Pass 1: Gemini for creative foundation
        const pass1Response = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `${langRule}

INPUT WORD COUNT: ${wordCount} words
OUTPUT TARGET: ${Math.floor(wordCount * 0.9)}-${Math.ceil(wordCount * 1.15)} words (±15% max)

CRITICAL FORMATTING RULES:
- Input has [PARAGRAPH_X] markers
- You MUST keep each [PARAGRAPH_X] marker on its own line
- NEVER merge [PARAGRAPH_X] sections together
- Each paragraph should be humanized separately but maintain its [PARAGRAPH_X] marker

Input text:
${markedText}` }
            ],
          }),
        }, 15000);

        if (!pass1Response.ok) {
          throw new Error(`Gemini Pass 1 failed: ${pass1Response.statusText}`);
        }

        const pass1Data = await pass1Response.json();
        const pass1Result = pass1Data.choices[0].message.content;
        if (pass1Result && pass1Result.trim().length > 0) { bestSoFar = pass1Result; }
        
        console.log(`[HYBRID-HUMANIZE] Pass 1 (Gemini) complete`);

        // Pass 2: OpenAI for structural refinement
        try {
          const pass2Response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-5-nano',
              messages: [
                { role: 'system', content: `${systemPrompt}\n\nRefine for accuracy and natural flow.` },
                { role: 'user', content: `${langRule}

INPUT WORD COUNT: ${wordCount} words
OUTPUT TARGET: ${Math.floor(wordCount * 0.9)}-${Math.ceil(wordCount * 1.15)} words (±15% max)

CRITICAL: Keep [PARAGRAPH_X] markers on their own lines. Never merge paragraphs.

Input text:
${pass1Result}` }
              ],
              max_completion_tokens: Math.min(Math.ceil(wordCount * 2), 4000),
            }),
          }, 15000);

          if (!pass2Response.ok) {
            throw new Error('Pass 2 failed');
          }

          const pass2Data = await pass2Response.json();
          finalText = pass2Data.choices[0].message.content;
          
          // POST-PROCESS: Remove ALL paragraph markers (aggressive regex)
          finalText = finalText.replace(/\[PARAGRAPH_?\d+\]\s*/gi, '');
          finalText = finalText.replace(/\[PARAGRAPH\d+\]\s*/gi, '');
          finalText = finalText.replace(/PARAGRAPH\d+/gi, '');
          finalText = finalText.replace(/\n{3,}/g, '\n\n');
          
          if (finalText && finalText.trim().length > 0) { bestSoFar = finalText; }
          passesCompleted = 2;
          enginesUsed = 'gemini-openai';
          
          // Verify structure preservation
          const outputParagraphCount = (finalText.match(/\n\n+/g) || []).length + 1;
          console.log(`[STRUCTURE] Pass 2 (OpenAI) complete - Paragraphs: ${outputParagraphCount}`);
        } catch (pass2Error) {
          // Use Pass 1 result if Pass 2 fails or times out
          console.log('[HYBRID-HUMANIZE] Pass 2 failed/timed out, using Pass 1 result');
          finalText = pass1Result;
          // POST-PROCESS Pass 1 result - Remove ALL paragraph markers
          finalText = finalText.replace(/\[PARAGRAPH_?\d+\]\s*/gi, '');
          finalText = finalText.replace(/\[PARAGRAPH\d+\]\s*/gi, '');
          finalText = finalText.replace(/PARAGRAPH\d+/gi, '');
          finalText = finalText.replace(/\n{3,}/g, '\n\n');
          passesCompleted = 1;
          enginesUsed = 'gemini';
        }
      } catch (error) {
        console.error('[HYBRID-HUMANIZE] Pro plan error:', error);
        // Return original text on complete failure
        finalText = text;
        bestSoFar = text;
        passesCompleted = 0;
        enginesUsed = 'none';
      }

    } else if (userPlan === 'ultra' || userPlan === 'master') {
      // ULTRA PLAN: Fast track for extension, full pipeline for web
      const isExtensionRequest = source === 'extension';
      
      try {
        if (isExtensionRequest) {
          console.log('[HYBRID-HUMANIZE] Ultra plan - Extension fast track (2 passes)');
        } else {
          console.log('[HYBRID-HUMANIZE] Ultra plan - Web full pipeline (4 passes)');
        }
        
        // Pass 1: Gemini for creative foundation
        const pass1Response = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `${langRule}

INPUT WORD COUNT: ${wordCount} words
OUTPUT TARGET: ${Math.floor(wordCount * 0.9)}-${Math.ceil(wordCount * 1.15)} words (±15% max)

CRITICAL FORMATTING RULES:
- Input has [PARAGRAPH_X] markers
- You MUST keep each [PARAGRAPH_X] marker on its own line
- NEVER merge [PARAGRAPH_X] sections together

Input text:
${markedText}` }
            ],
          }),
        }, 15000);

        if (!pass1Response.ok) {
          throw new Error(`Gemini Pass 1 failed: ${pass1Response.statusText}`);
        }

        const pass1Data = await pass1Response.json();
        const pass1Result = pass1Data.choices[0].message.content;
        if (pass1Result && pass1Result.trim().length > 0) { bestSoFar = pass1Result; }
        
        console.log(`[HYBRID-HUMANIZE] Pass 1 (Gemini) complete`);

        // Pass 2: OpenAI
        try {
          const pass2Response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-5-nano',
              messages: [
                { role: 'system', content: `${systemPrompt}\n\nRefine for accuracy and clarity.` },
                { role: 'user', content: `${langRule}

INPUT WORD COUNT: ${wordCount} words
OUTPUT TARGET: ${Math.floor(wordCount * 0.9)}-${Math.ceil(wordCount * 1.15)} words (±15% max)

CRITICAL: Keep [PARAGRAPH_X] markers on their own lines. Never merge paragraphs.

Input text:
${pass1Result}` }
              ],
              max_completion_tokens: Math.min(Math.ceil(wordCount * 2), 4000),
            }),
          }, 15000);

          if (!pass2Response.ok) {
            throw new Error('Pass 2 failed');
          }

          const pass2Data = await pass2Response.json();
          const pass2Result = pass2Data.choices[0].message.content;
          if (pass2Result && pass2Result.trim().length > 0) { bestSoFar = pass2Result; }
          
          console.log(`[HYBRID-HUMANIZE] Pass 2 (OpenAI) complete`);

          // FORK: Extension stops here, Web continues
          if (isExtensionRequest) {
            finalText = pass2Result;
            // POST-PROCESS: Remove ALL paragraph markers for extension
            finalText = finalText.replace(/\[PARAGRAPH_?\d+\]\s*/gi, '');
            finalText = finalText.replace(/\[PARAGRAPH\d+\]\s*/gi, '');
            finalText = finalText.replace(/PARAGRAPH\d+/gi, '');
            finalText = finalText.replace(/\n{3,}/g, '\n\n');
            passesCompleted = 2;
            enginesUsed = 'gemini-openai';
            console.log('[HYBRID-HUMANIZE] Extension fast track complete - 2 passes');
          } else {
            // Pass 3: Claude (web only)
            try {
              const pass3Response = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${lovableApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'anthropic/claude-sonnet-4-20250514',
                  messages: [
                    { role: 'system', content: `${systemPrompt}\n\nYou are the final polishing layer. Perfect the tone, add nuanced personality, and ensure authentic human voice.` },
                    { role: 'user', content: `${langRule}

INPUT WORD COUNT: ${wordCount} words
OUTPUT TARGET: ${Math.floor(wordCount * 0.9)}-${Math.ceil(wordCount * 1.15)} words (±15% max)

CRITICAL: Keep [PARAGRAPH_X] markers on their own lines. Never merge paragraphs.

Input text:
${pass2Result}` }
                  ],
                }),
              }, 15000);

              if (!pass3Response.ok) {
                throw new Error('Pass 3 failed');
              }

              const pass3Data = await pass3Response.json();
              finalText = pass3Data.choices[0].message.content;
              
              // POST-PROCESS: Remove ALL paragraph markers and normalize line breaks
              finalText = finalText.replace(/\[PARAGRAPH_?\d+\]\s*/gi, '');
              finalText = finalText.replace(/\[PARAGRAPH\d+\]\s*/gi, '');
              finalText = finalText.replace(/PARAGRAPH\d+/gi, '');
              finalText = finalText.replace(/\n{3,}/g, '\n\n');
              
              if (finalText && finalText.trim().length > 0) { bestSoFar = finalText; }
              passesCompleted = 3;
              enginesUsed = 'gemini-openai-claude';
              
              const outputParagraphCount = (finalText.match(/\n\n+/g) || []).length + 1;
              console.log(`[STRUCTURE] Pass 3 (Claude) complete - Paragraphs: ${outputParagraphCount}`);
              
              console.log('[HYBRID-HUMANIZE] Humanization complete - 3 passes (max 4 for Ultra) using', enginesUsed);
            } catch (pass3Error) {
              console.log('[HYBRID-HUMANIZE] Pass 3 failed, using Pass 2 result');
              finalText = pass2Result;
              // POST-PROCESS Pass 2 result - Remove ALL paragraph markers
              finalText = finalText.replace(/\[PARAGRAPH_?\d+\]\s*/gi, '');
              finalText = finalText.replace(/\[PARAGRAPH\d+\]\s*/gi, '');
              finalText = finalText.replace(/PARAGRAPH\d+/gi, '');
              finalText = finalText.replace(/\n{3,}/g, '\n\n');
              passesCompleted = 2;
              enginesUsed = 'gemini-openai';
            }
          }
        } catch (pass2Error) {
          console.log('[HYBRID-HUMANIZE] Pass 2 failed/timed out, using Pass 1 result');
          finalText = pass1Result;
          // POST-PROCESS Pass 1 result
          finalText = finalText.replace(/\[PARAGRAPH_\d+\]\s*/g, '');
          finalText = finalText.replace(/\n{3,}/g, '\n\n');
          passesCompleted = 1;
          enginesUsed = 'gemini';
        }
      } catch (error) {
        console.error('[HYBRID-HUMANIZE] Ultra plan error:', error);
        finalText = text;
        bestSoFar = text;
        passesCompleted = 0;
        enginesUsed = 'none';
      }
    }

    console.log(`[HYBRID-HUMANIZE] Humanization complete - ${passesCompleted} passes (max 4 for Ultra) using ${enginesUsed}`);

    // Post-processing length validation
    const inputWords = text.trim().split(/\s+/).length;
    const outputWords = (finalText || bestSoFar).trim().split(/\s+/).length;
    const wordChangePercent = Math.abs(outputWords - inputWords) / inputWords * 100;
    const wordsAdded = outputWords - inputWords;
    const wordsRemoved = inputWords - outputWords;
    
    console.log(`[LENGTH-CHECK] Word count validation: input=${inputWords}, output=${outputWords}, change=${wordChangePercent.toFixed(1)}% (${wordsAdded >= 0 ? '+' : ''}${wordsAdded} words)`);
    
    if (wordChangePercent > 25) {
      console.warn(`[LENGTH-CHECK] ⚠️ Output length exceeded 25% threshold! This should not happen with new constraints.`);
      console.warn(`[LENGTH-CHECK] Details: ${inputWords} → ${outputWords} words (${wordChangePercent.toFixed(1)}% change)`);
    } else if (wordChangePercent > 20) {
      console.log(`[LENGTH-CHECK] ℹ️ Output length slightly high (20-25%), but acceptable range`);
    } else {
      console.log(`[LENGTH-CHECK] ✅ Output length within acceptable range (≤20%)`);
    }

    // Post-generation language verification and correction if needed (SKIP in speed mode)
    if (!speed_mode) {
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
    } else {
      console.log('[LANG] Skipping post-generation language verification (speed mode)');
    }

    // MULTI-ENGINE TONE BOOSTER with SHORT-TEXT mode (SKIP in speed mode)
    const intensity = ['light','medium','strong'].includes(tone_intensity) ? tone_intensity : 'strong';
    const threshold = INTENSITY_THRESHOLDS[intensity] ?? INTENSITY_THRESHOLDS.strong;
    const isShortText = wordCount < 30;

    // Guard: ensure we have a non-empty draft for similarity checks
    if (!finalText || finalText.trim().length === 0) {
      console.warn('[TONE] finalText empty → using bestSoFar for similarity');
      finalText = (bestSoFar && bestSoFar.trim().length > 0) ? bestSoFar : text;
    }

    let simBefore = jaccardSimilarity(text, finalText);
    let sim = simBefore;
    
    console.log(`[TONE] tone="${tone}" intensity="${intensity}" force_rewrite=${force_rewrite} short_text=${isShortText} similarity(before)=${sim.toFixed(3)} threshold=${threshold} speed_mode=${speed_mode}`);

    // Skip tone booster entirely in speed mode (saves 5-10 seconds)
    if (speed_mode) {
      console.log('[TONE] Skipping tone booster entirely (speed mode) - saved ~5-10 seconds');
    }
    // Skip tone booster entirely for grammar mode (minimal changes only)
    // Always run at least one booster for non-regular, non-grammar tones when:
    // - force_rewrite is true (default), or
    // - similarity above intensity threshold, or very high (>= 0.85), or extremely low (<= 0.01), or
    // - draft equals original text
    else {
      const shouldForceBooster = (
        tone !== 'regular' && tone !== 'grammar' && (
          force_rewrite || sim > threshold || sim >= 0.85 || finalText.trim() === text.trim() || sim <= 0.01
        )
      );

      if (shouldForceBooster) {
      const changePct = Math.round(CHANGE_TARGET[intensity] * 100);
      const toneReinforcements: Record<string, string> = {
        formal: 'Use "However," "Additionally," "Therefore" naturally; reduce contractions; executive clarity.',
        persuasive: 'Second-person "you/your"; rhetorical questions; urgency; vary rhythm deliberately.',
        empathetic: '"I understand," "That makes sense," "Let\'s take it step by step"; soften starts.',
        sarcastic: '"Oh great," "Sure," "Obviously"; dry wit; fragments allowed.',
        regular: '',
        grammar: '' // Grammar mode doesn't use booster
      };

      const structureRule = 'Keep EVERY line break exactly where it appears. Keep EVERY sentence in its original order. Maintain exact paragraph structure.';

      const shortTextPromptAddition = isShortText
        ? `\n\nCRITICAL (Short text): Change at least ${changePct}% of words; allow re-ordering of clauses; keep meaning exact; same language; concise output.`
        : '';

      const boosterPromptBase = (extraToneReinforcement: string, engineName: string) => `
You are a human writer. Rewrite the user's text to EXPLICITLY reflect the tone "${tone}".
Requirements:
- Change at least ${changePct}% of the words${force_rewrite ? ' and reorder clauses/sentences where natural' : ''}
- Preserve meaning exactly
- ${structureRule}
- Preserve list formatting (1. 2. 3. or - bullets)
- Output ONLY plain text
- Use the same language as input (${inputLangName} [${inputLangCode}])
${extraToneReinforcement}${shortTextPromptAddition}

Engine: ${engineName}`;

      // Booster pass 1: gemini-2.5-pro
      if (sim > threshold || force_rewrite || sim >= 0.85 || finalText.trim() === text.trim() || sim <= 0.01) {
        const system = boosterPromptBase(toneReinforcements[tone] || '', 'google/gemini-2.5-pro');
        const userContent = `${langRule}

ORIGINAL:
${text}

CURRENT DRAFT:
${finalText}

Rewrite CURRENT DRAFT to meet all requirements above while ensuring it is sufficiently different from ORIGINAL.`;

        try {
          console.log('[TONE] Booster pass 1: gemini-2.5-pro');
          const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'google/gemini-2.5-pro',
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: userContent }
              ],
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            const candidate = data.choices?.[0]?.message?.content?.trim();
            if (candidate) {
              finalText = candidate;
              sim = jaccardSimilarity(text, finalText);
              enginesUsed += '+gemini-pro-booster';
              passesCompleted += 1;
              console.log(`[TONE] Booster pass 1 done: similarity=${sim.toFixed(3)} (threshold=${threshold})`);
            }
          } else {
            console.error('[TONE] Booster pass 1 API error:', resp.status, await resp.text());
          }
        } catch (boosterError) {
          console.error('[TONE] Booster pass 1 failed:', boosterError);
        }
      }

      // Booster pass 2: openai/gpt-5 (if still above threshold)
      if (sim > threshold) {
        const strongerReinforcement = toneReinforcements[tone] 
          ? toneReinforcements[tone] + '\n\nEXTRA EMPHASIS: Use MORE tone markers, reorder MORE aggressively, change MORE words.'
          : 'EXTRA EMPHASIS: Use MORE tone markers, reorder MORE aggressively, change MORE words.';
        
        const system = boosterPromptBase(strongerReinforcement, 'openai/gpt-5');
        const userContent = `${langRule}

ORIGINAL:
${text}

CURRENT DRAFT (after 1st booster):
${finalText}

This draft is still too similar to ORIGINAL (similarity=${sim.toFixed(3)}). Rewrite MORE aggressively to meet all requirements while preserving meaning.`;

        try {
          console.log('[TONE] Booster pass 2: openai/gpt-5');
          const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'openai/gpt-5',
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: userContent }
              ],
              max_completion_tokens: 4000,
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            const candidate = data.choices?.[0]?.message?.content?.trim();
            if (candidate) {
              finalText = candidate;
              sim = jaccardSimilarity(text, finalText);
              enginesUsed += '+gpt5-booster';
              passesCompleted += 1;
              console.log(`[TONE] Booster pass 2 done: similarity=${sim.toFixed(3)} (threshold=${threshold})`);
            }
          } else {
            console.error('[TONE] Booster pass 2 API error:', resp.status, await resp.text());
          }
        } catch (boosterError) {
          console.error('[TONE] Booster pass 2 failed:', boosterError);
        }
      }

        const thresholdMet = sim <= threshold;
        console.log(`[TONE] Booster complete: similarity_before=${simBefore.toFixed(3)} similarity_after=${sim.toFixed(3)} threshold=${threshold} threshold_met=${thresholdMet}`);
      }
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

    return await finalizeResponse(supabase, userData.user.id, text, finalText, tone, wordCount, currentMonth, usage, currentUsage, planLimit, extraWords, passesCompleted, enginesUsed, source, userPlan, simBefore, sim);

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
  userPlan: string = 'free',
  similarityBefore?: number,
  similarityAfter?: number
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
    similarity_before: similarityBefore,
    similarity_after: similarityAfter,
    editor_note: editorNote || undefined,
    source: source
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
