

## Add "Works on Gmail, LinkedIn, Docs, and more" to Free Plan

### Change
Add the line `"Works on Gmail, LinkedIn, Docs, and more"` to the Free plan's feature list in both pricing components. This makes both plans show the same platform support since the extension works everywhere regardless of plan.

### Files to edit
- **`src/components/Pricing.tsx`** (line 50): Add the new feature after "Right-click humanize on any website"
- **`src/components/WritingJourneyPricing.tsx`** (line 28): Same addition

### Result -- Free plan features will be:
1. 500 words per month
2. All 6 tone personalities
3. Basic AI humanization + Tone Generator
4. Right-click humanize on any website
5. Works on Gmail, LinkedIn, Docs, and more

