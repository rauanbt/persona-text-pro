

## Pricing & FAQ Cleanup

### Changes

#### 1. Remove "1,000 words per request" from Ultra features
Both `WritingJourneyPricing.tsx` and `Pricing.tsx` list this -- remove it from both.

#### 2. Fix engine description: "Gemini + ChatGPT + Claude" is wrong
The backend actually uses **Gemini + ChatGPT** (OpenAI). Claude is not used at all. Update the Ultra feature to:
- **"Premium dual-engine humanization (Gemini + ChatGPT)"**

This applies to both `WritingJourneyPricing.tsx` and `Pricing.tsx`.

#### 3. Remove the "Prorated First Month" section entirely
The screenshot shows this section at the bottom of pricing. Remove it from both:
- `WritingJourneyPricing.tsx` (lines 193-219)
- `Pricing.tsx` (lines 187-210)

This info can be shown during checkout instead, but we won't add it there in this pass.

#### 4. Reframe FAQ to remove "bypass AI detection" language
The product rephrases and humanizes text -- it doesn't "bypass" detection. Update:
- **FAQ question "Does SapienWrite bypass AI detection tools?"** -- Rewrite to focus on rephrasing: "Does SapienWrite make text sound more natural?" with an answer about improving readability and tone, not bypassing detectors.
- **FAQ answer for "How much does it cost?"** -- Update pricing info (remove Extension-Only plan reference, fix word counts, remove "AI detection bypass" phrasing).
- **FAQ answer about the extension** -- Remove "Gemini + ChatGPT + Claude" reference, just say "advanced AI models."

#### 5. Clean up hero subtitle
Currently says "rephrase, fix grammar, and humanize" -- this is fine, no "bypass" language there. No change needed.

### Files to Edit
- `src/components/WritingJourneyPricing.tsx` -- Remove "1,000 words per request", fix engine names, remove prorated section
- `src/components/Pricing.tsx` -- Same changes
- `src/components/FAQ.tsx` -- Rewrite Q&A to remove bypass/detection language, update pricing info

### What We Won't Touch
- Backend edge functions (they work fine as-is)
- Hero section (already clean)
- Extension code
- Pricing source of truth (`pricing.ts`)
