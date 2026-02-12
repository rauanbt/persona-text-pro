

## Update Pricing Feature Lists

### Changes (both `WritingJourneyPricing.tsx` and `Pricing.tsx`)

#### Free plan features -- update from:
```
"500 words per month",
"250 words per request",
"All 6 tone personalities",
"Basic AI humanization",
"Right-click humanize on any website"
```
to:
```
"500 words per month",
"All 6 tone personalities",
"Basic AI humanization + Tone Generator",
"Right-click humanize on any website"
```

#### Ultra plan features -- update from:
```
"5,000 words per month",
"All 6 tone personalities",
"Premium dual-engine humanization (Gemini + ChatGPT)",
"Right-click humanize on any website",
"Works on Gmail, LinkedIn, Docs, and more"
```
to:
```
"5,000 words per month",
"All 6 tone personalities",
"Premium dual-engine humanization (Gemini + ChatGPT) + Tone Generator",
"Right-click humanize on any website",
"Works on Gmail, LinkedIn, Docs, and more"
```

### Files to edit
- `src/components/WritingJourneyPricing.tsx` (lines 24-29 for Free, lines 45-51 for Ultra)
- `src/components/Pricing.tsx` (lines 46-52 for Free, lines 63-69 for Ultra)

