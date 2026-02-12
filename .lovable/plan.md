

## Simplify Pricing: 2 Plans + Move to Footer

### Overview
Remove the Extension-Only plan (since the product IS the extension), update Ultra to 5,000 words at $39.95, rewrite features for extension context, and move the Pricing link from header to footer navigation.

### Changes

#### 1. Header (`src/components/Header.tsx`)
- Remove the "Pricing" nav link and the `handlePricingClick` function
- Keep only: Logo + Dashboard/Sign In buttons

#### 2. Footer (`src/components/Footer.tsx`)
- Add a "Pricing" link that scrolls to `#pricing` section (same scroll behavior the header had)
- Add it alongside Privacy Policy, Terms, Contact

#### 3. Pricing Source of Truth (`src/lib/pricing.ts`)
- Remove `extension_only` from `PLAN_PRICES`
- Remove `extension_only` from `PLAN_LIMITS`
- Change `ultra` limit from 40,000 to 5,000

#### 4. WritingJourneyPricing (`src/components/WritingJourneyPricing.tsx`)
- Remove the Extension-Only plan card entirely (3rd journey)
- Change grid from `md:grid-cols-3` to `md:grid-cols-2`
- Update Ultra features list to be extension-focused:
  - "5,000 words per month"
  - "1,000 words per request"
  - "All 6 tone personalities"
  - "Premium triple-engine humanization (Gemini + ChatGPT + Claude)"
  - "Right-click humanize on any website"
  - "Works on Gmail, LinkedIn, Docs, and more"
- Update Free features to match extension context:
  - "500 words per month"
  - "250 words per request"
  - "All 6 tone personalities"
  - "Basic AI humanization"
  - "Right-click humanize on any website"
- Update prorated pricing example to use 5,000 words instead of 40,000
- Remove "writing journey" flowery language, simplify headings

#### 5. Pricing Component (`src/components/Pricing.tsx`)
- Remove Extension-Only plan
- Change grid from `md:grid-cols-3` to `md:grid-cols-2`
- Update Ultra features to match above
- Update Free features to match above
- Update prorated example to 5,000 words

#### 6. Dashboard (`src/pages/Dashboard.tsx`)
- Update references: remove `extension_only` plan checks
- Update displayed limits to reflect 5,000 for Ultra

#### 7. Settings (`src/pages/Settings.tsx`)
- Remove `extension_only` checks in subscription status and delete account sections

#### 8. Edge Functions (display only -- NOT changing backend logic)
- Note: `humanize-text-hybrid/index.ts` and `usage-summary/index.ts` have `extension_only` references. These should be kept for now to handle any existing Extension-Only subscribers gracefully. No backend changes in this pass.

### What We WON'T Touch
- Edge functions (existing subscribers may still have extension_only plan)
- Auth, Stripe webhooks, checkout logic
- Chrome extension code
- Stripe price IDs (Ultra price ID stays the same -- word limit is enforced server-side)

