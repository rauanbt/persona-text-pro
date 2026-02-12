

## Two Changes: Pricing Text Updates + Login Loop Fix

### 1. Pricing text updates

**In `src/components/Pricing.tsx`:**
- Line 49: Change `"Basic AI humanization"` to `"Premium dual-engine humanization (Gemini + GPT) + tone generator"`
- Line 64: Change `"Premium dual-engine humanization (Gemini + GPT)"` to `"Premium dual-engine humanization (Gemini + GPT) + tone generator"`

**In `src/components/WritingJourneyPricing.tsx`:**
- Line 27: Change `"Basic AI humanization"` to `"Premium dual-engine humanization (Gemini + GPT) + tone generator"`
- Line 47: Change `"Premium dual-engine humanization (Gemini + GPT)"` to `"Premium dual-engine humanization (Gemini + GPT) + tone generator"`

---

### 2. Fix login loop

**Root cause:** After a successful sign-in, the `handleSignIn` function in `Auth.tsx` immediately navigates to `/dashboard`. However, the Supabase `onAuthStateChange` listener in `AuthContext.tsx` hasn't fired yet, so the `user` state is still `null`. When the `ProtectedRoute` on `/dashboard` checks the auth state, it sees `user = null` and `loading = false`, so it redirects back to `/auth`. Then `onAuthStateChange` fires, setting the user, and the Auth page's `useEffect` navigates to `/dashboard` again -- creating a loop.

**Fix in `src/pages/Auth.tsx`:**
- Remove the manual navigation from `handleSignIn` and `handleGoogleSignIn`. Let the existing `useEffect` (which watches `user` and `loading`) handle all post-login redirects. This ensures navigation only happens after the auth state has fully propagated.

Specifically:
- In `handleSignIn`: remove the `if (!error) { navigate(...) }` block (lines 60-71). The `useEffect` on line 30 already handles this.
- In `handleGoogleSignIn`: remove the `if (!error && fromExtension) { navigate(...) }` block (lines 88-91). Google OAuth redirects via the provider anyway, so this code never actually runs.

Also remove the duplicate extension redirect in `AuthContext.tsx`'s `signIn` function (lines 237-241) since Auth.tsx's useEffect already handles the extension redirect.

### Technical details

| File | Change |
|------|--------|
| `src/components/Pricing.tsx` | Update 2 feature strings to add "+ tone generator" |
| `src/components/WritingJourneyPricing.tsx` | Same 2 feature string updates |
| `src/pages/Auth.tsx` | Remove manual navigation from handleSignIn and handleGoogleSignIn |
| `src/contexts/AuthContext.tsx` | Remove duplicate extension redirect from signIn function |

