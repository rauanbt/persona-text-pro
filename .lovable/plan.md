
## Plan: Remove Proration Details from Paid Plans UI

### Overview
Remove the "Today: $X → ~X words" and "February 1st: $39.95 → 40,000 words/month" proration information from the pricing cards. This information will be shown in the Stripe checkout page instead.

### Changes

#### 1. WritingJourneyPricing.tsx (lines 178-200)
Remove the entire proration calculation and display block for the Ultra plan:
- Lines 178-200: Remove the IIFE that calculates and displays the proration box

#### 2. Pricing.tsx (lines 218-240)  
Remove the same proration display block:
- Lines 218-240: Remove the IIFE that calculates and displays the proration box

### Result
The pricing cards will show the standard price without the proration breakdown, keeping the UI cleaner. Users will see the actual prorated amount when they proceed to Stripe checkout.

### Files Modified
- `src/components/WritingJourneyPricing.tsx`
- `src/components/Pricing.tsx`

### What We WON'T Touch
- Pricing logic
- Checkout functionality  
- Any other UI elements
