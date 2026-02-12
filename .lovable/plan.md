

## Update Pricing Content and Word Limits

### 1. Update `src/lib/pricing.ts` (source of truth)
- Change `PLAN_LIMITS.free` from `500` to `1000`
- Change `PLAN_LIMITS.ultra` from `5000` to `15000`

### 2. Update `src/components/Pricing.tsx`

**Free plan:**
- Description: "Try SapienWrite with no commitment" --> "Free forever"
- Features updated to:
  - "1,000 words per month"
  - "All 6 tone personalities"
  - "Basic AI humanization"
  - "Right-click rewrite on any website"
  - "Works on Gmail, LinkedIn, Docs & more"
- Button text: "Get Started Free" --> "Start Free"

**Ultra plan:**
- Description: "Maximum humanization power" --> "For creators & professionals"
- Features updated to:
  - "15,000 words per month"
  - "All 6 tone personalities"
  - "Premium dual-engine humanization (Gemini + GPT)"
  - "Stronger rewrite refinement"
  - "Priority processing"
  - "Works everywhere"
- Add a tagline under the price: "Perfect for LinkedIn creators, founders, recruiters, and daily email pros."

### 3. Update `src/components/WritingJourneyPricing.tsx`
Same content changes as Pricing.tsx:
- Free: subtitle "Free forever", updated features, "Start Free" button
- Ultra: subtitle "For creators & professionals", updated features, tagline under price

### 4. Files to edit
- `src/lib/pricing.ts` -- word limits
- `src/components/Pricing.tsx` -- descriptions, features, button text, tagline
- `src/components/WritingJourneyPricing.tsx` -- same content updates
