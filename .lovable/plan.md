

## Fix Login Loop + Remove "Most Popular" Text

### 1. Fix the login deadlock (Root Cause)

**File:** `src/contexts/AuthContext.tsx`

**The bug:** Inside the `onAuthStateChange` callback (line 174), the code awaits `checkSubscription(sess)` which internally calls `supabase.functions.invoke()` and `supabase.from('profiles').select()`. Supabase's auth state change callback holds an internal lock -- calling other Supabase methods inside it causes a deadlock, hanging the app on a white page forever.

**The fix:** Restructure the auth initialization to:
- Use `setTimeout(() => ..., 0)` to defer `checkSubscription` calls out of the `onAuthStateChange` callback, avoiding the deadlock
- Only control `loading` state from the initial `getSession()` call (not from `onAuthStateChange`)
- The `onAuthStateChange` listener should only update `user` and `session` state synchronously, then defer any async work

```text
Before (deadlocks):
  onAuthStateChange -> await checkSubscription() -> supabase calls -> DEADLOCK

After (works):
  onAuthStateChange -> setUser/setSession -> setTimeout -> checkSubscription()
  getSession() -> checkSubscription() -> setLoading(false)  (initial load only)
```

### 2. Remove "Most popular plan" description text

**Files:** `src/components/Pricing.tsx`, `src/components/WritingJourneyPricing.tsx`

- Change the Ultra plan `description` from `"Most popular plan"` to an empty string `""` (or remove the field)

### Technical details

| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Defer checkSubscription out of onAuthStateChange using setTimeout; only set loading=false from initial getSession |
| `src/components/Pricing.tsx` | Remove "Most popular plan" from Ultra description |
| `src/components/WritingJourneyPricing.tsx` | Remove "Most popular plan" from Ultra subtitle/description |

