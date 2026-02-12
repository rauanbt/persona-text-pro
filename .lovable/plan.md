

## Comprehensive Update: Remove "Most Popular", Redesign Extension Popup, Sync Backend Limits to 20,000

This plan covers 4 major areas: pricing label cleanup, extension popup redesign, backend word limit sync, and dashboard updates.

---

### 1. Remove "Most Popular" badge/text everywhere

**Files:** `src/components/Pricing.tsx`, `src/components/WritingJourneyPricing.tsx`

- Remove the `popular: true` property and the "Most Popular" Badge component from both pricing components
- Remove the `description: "Most popular plan"` and `subtitle: "Most popular plan"` text
- Remove the scale/shadow styling that was tied to `plan.popular`
- Keep the Ultra card visually distinct via its purple gradient (WritingJourneyPricing) or primary border (Pricing), just without the badge

---

### 2. Redesign Chrome Extension Popup (Simpler, Cleaner)

**Files:** `chrome-extension/popup.html`, `chrome-extension/popup.js`

Current issues from screenshots:
- "Refresh Connection" button clutters the login view
- Too many buttons in the main view (Dashboard, Manage Subscription, Force Refresh)
- Upgrade card shows old plans (Extension-Only at $12.95, Ultra at $54.95)

Changes to `popup.html`:
- **Login view**: Remove the "Refresh Connection" button entirely. Keep only "Login at SapienWrite.com" and "Connect Extension (already logged in)"
- **Main view**: Remove "Force Refresh Data" button. Keep "Go to Dashboard" and "Manage Subscription" only
- Remove the standalone refresh button (spinner icon) next to word count -- auto-refresh on popup open is sufficient
- **Upgrade card**: Update from "Extension-Only - $12.95/mo" and "Ultra - $54.95/mo" to a single "Upgrade to Ultra - $39.95/mo (20,000 words)" button
- Clean up visual clutter, simplify spacing

Changes to `popup.js`:
- Remove `refresh-balance-btn` event listener and related spinning logic
- Remove `force-refresh-button` event listener
- Update `showUpgradeRequiredCard()` to show single Ultra upgrade option at $39.95/mo
- Remove references to `extension_only` plan in upgrade flow (users go Free or Ultra)

---

### 3. Update Extension Config Limits

**File:** `chrome-extension/config.js`

Update limits to match the current pricing:
- `free: 1000` (was 500)
- `ultra: 20000` (was 40000)
- Remove or keep `extension_only: 5000` for legacy compatibility
- Remove separate `WEB_LIMITS` object (no web-only mode anymore)

---

### 4. Sync Backend Edge Functions to 20,000 Ultra Limit

All backend functions currently hardcode Ultra at 40,000. Update to 20,000:

**`supabase/functions/usage-summary/index.ts`:**
- `ultra: 40000` changed to `ultra: 20000`
- `free: 500` changed to `free: 1000`

**`supabase/functions/check-subscription/index.ts`:**
- `ultra: 40000` changed to `ultra: 20000`
- `free: 500` changed to `free: 1000`

**`supabase/functions/humanize-text-hybrid/index.ts`:**
- `PLAN_LIMITS.ultra: 40000` changed to `20000`
- `EXTENSION_LIMITS.ultra: 40000` changed to `20000`
- `PLAN_LIMITS.free: 500` changed to `1000`
- `EXTENSION_LIMITS.free: 500` changed to `1000`

**`supabase/functions/create-checkout/index.ts`:**
- `planDetails.ultra.fullWords: 40000` changed to `20000`

**`supabase/functions/stripe-webhook/index.ts`:**
- All Ultra price ID entries: `wordLimit: 40000` changed to `20000`
- Feature text: "40,000 words per month" changed to "20,000 words per month"

---

### 5. Dashboard Updates (Extension-Only Focus)

**File:** `src/pages/Dashboard.tsx`

The Dashboard already looks good for extension-only use. Minor tweaks:
- Remove the "Usage Breakdown" section that shows separate "Web" vs "Extension" counts (since there's no web humanizer anymore, all usage is extension). Show a single "Words used" count instead
- The upgrade section already shows correct pricing ($39.95/mo, 20,000 words) -- no change needed

---

### 6. Content Script Robustness (Gmail, LinkedIn, Twitter, Facebook, Reddit, Docs)

**File:** `chrome-extension/content.js`

The content script already has specific handling for Gmail and LinkedIn. Add/improve:
- **Twitter/X**: Add `twitter.com` and `x.com` detection. Twitter uses contenteditable divs with a `DraftEditor` class -- add specific selector for `div[data-testid="tweetTextarea_0"]` and similar
- **Facebook**: Add `facebook.com` detection. Facebook uses contenteditable with `[role="textbox"][contenteditable="true"]` -- already handled by generic selectors but add explicit fallback for FB's shadow DOM patterns
- **Reddit**: Reddit's fancy editor uses contenteditable divs. Add `reddit.com` detection with selector `div[contenteditable="true"].public-DraftEditor-content`
- **Google Docs**: Google Docs uses an iframe-based editor that doesn't allow direct DOM access. The extension already falls back to clipboard copy -- this is the correct behavior. No change needed, but improve the fallback message to be more helpful

For all platforms, improve the fallback (Tier 3) clipboard message to be clearer about why auto-replace didn't work on that specific platform.

---

### Summary of files to edit (13 files)

| File | Changes |
|------|---------|
| `src/components/Pricing.tsx` | Remove "Most Popular" badge and text |
| `src/components/WritingJourneyPricing.tsx` | Remove "Most Popular" badge and text |
| `chrome-extension/popup.html` | Simplify login/main views, remove refresh buttons, update upgrade card |
| `chrome-extension/popup.js` | Remove refresh handlers, update upgrade logic, update limits |
| `chrome-extension/config.js` | Update free to 1000, ultra to 20000 |
| `chrome-extension/content.js` | Add Twitter/Facebook/Reddit platform detection and improved fallbacks |
| `supabase/functions/usage-summary/index.ts` | free: 1000, ultra: 20000 |
| `supabase/functions/check-subscription/index.ts` | free: 1000, ultra: 20000 |
| `supabase/functions/humanize-text-hybrid/index.ts` | free: 1000, ultra: 20000 (both PLAN_LIMITS and EXTENSION_LIMITS) |
| `supabase/functions/create-checkout/index.ts` | ultra fullWords: 20000 |
| `supabase/functions/stripe-webhook/index.ts` | Ultra wordLimit: 20000, update feature text |
| `src/pages/Dashboard.tsx` | Simplify usage display (no web/extension split) |
| `src/lib/pricing.ts` | Already correct (20000) -- no change needed |

