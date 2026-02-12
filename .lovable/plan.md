

## Update Pricing, FAQ, and Extra Words Across the Site

### 1. Update word limits in `src/lib/pricing.ts`
- Change `ultra` from `15000` to `20000`

### 2. Update `src/components/Pricing.tsx`
**Free plan:**
- Remove `"Right-click rewrite on any website"` from features (redundant with Gmail/LinkedIn line)
- Remove `"Free forever"` from description (redundant since the plan is already called "Free"). Set description to empty string or a short non-redundant line like "No credit card required"

**Ultra plan:**
- Remove `"For creators & professionals"` from description. Set to empty string or a short non-redundant line like "Most popular plan"
- Replace `"Works everywhere"` with `"Works on Gmail, LinkedIn, Docs & more"`
- Change `"15,000 words per month"` to `"20,000 words per month"`

### 3. Update `src/components/WritingJourneyPricing.tsx`
Same changes as Pricing.tsx:
- Free plan: remove redundant subtitle "Free forever" and description "Free forever", remove "Right-click rewrite on any website"
- Ultra plan: remove redundant subtitle/description "For creators & professionals", replace "Works everywhere", update to 20,000 words

### 4. Update `src/components/FAQ.tsx`
- **"How much does it cost?"** -- Update answer: "Free plan gives you 1,000 words/month. Ultra plan is $39.95/month (or $23.97/month billed annually) for 20,000 words. Both plans include all 6 tone options and work everywhere via the Chrome extension."
- **"Can I buy extra words?"** -- Change answer to: "Coming soon! We're working on extra word packages for paid plan users. Stay tuned."
- **"What is your refund policy?"** -- Update "500-word" to "1,000-word": "We encourage testing with the free 1,000-word plan before upgrading."

### 5. Update `src/components/Footer.tsx`
- Change `"500 words free. No credit card required."` to `"1,000 words free. No credit card required."`

### 6. Update `src/pages/Dashboard.tsx`
- Line 277: Change `"Ultra — $39.95/mo (5,000 words)"` to `"Ultra — $39.95/mo (20,000 words)"`

### 7. Update `src/pages/Settings.tsx`
- Line 301: Change `"Active — 5,000 words/month (shared pool)"` to `"Active — 20,000 words/month (shared pool)"`

### 8. Update `src/pages/ChromeExtension.tsx`
- The entire pricing section on this page is outdated (shows Extension-Only at $12.95 with 5,000 words, and Ultra at $39.95 with 40,000 words). Update to match current plans:
  - Free: 1,000 words/month, free
  - Ultra: 20,000 words/month, $39.95/month

### 9. Update `src/components/ExtraWordsPackages.tsx`
- Replace the purchase UI with a "Coming Soon" message for all users (not just free users). Show a friendly message like "Extra word packages are coming soon! Stay tuned."

### Files to edit (10 files total)
- `src/lib/pricing.ts`
- `src/components/Pricing.tsx`
- `src/components/WritingJourneyPricing.tsx`
- `src/components/FAQ.tsx`
- `src/components/Footer.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Settings.tsx`
- `src/pages/ChromeExtension.tsx`
- `src/components/ExtraWordsPackages.tsx`

