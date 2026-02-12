

## Simplify Website to Extension-First (Flunto-style)

### What Changes

The website will be stripped down from a full web-app with a text humanizer tool to a clean, focused landing page + account portal, just like Flunto. The Chrome extension becomes the sole product.

### New Site Structure

**Pages to KEEP (simplified):**
1. **Landing Page (/)** - Complete redesign, Flunto-style:
   - Hero: Big headline like "Humanize AI Text Anywhere on the Web"
   - Subtitle: "Right-click any text to rephrase, fix grammar, and humanize - directly in Gmail, LinkedIn, Docs, and more"
   - Two CTAs: "Install from Chrome Web Store" + "Sign Up Free"
   - Animated demo showing right-click context menu in action
   - Features section (3 cards): Right-click Humanize, Multiple Tones, Works Everywhere
   - Pricing section (simplified, 2-3 plans)
   - Minimal footer

2. **Auth (/auth)** - Keep as-is (sign up / login)

3. **Dashboard (/dashboard)** - Stripped down to a **usage portal**:
   - Usage stats (words used / remaining, progress bar)
   - Current plan + "Manage Subscription" button
   - Extension setup instructions / download link
   - Extra words purchase option
   - No more text input box, no humanizer tool, no AI detection tab

4. **Settings (/settings)** - Keep as-is (history, account, delete)

5. **Privacy Policy & Terms** - Keep as-is

**Pages to REMOVE:**
- `/about` - Not needed for extension-focused product
- `/blog` - Can be added back later
- `/contact` - Move to a simple email link in footer
- `/chrome-extension` - Redundant; landing page IS the extension page now

**Components to REMOVE:**
- `HeroSection.tsx` - Replace with new extension-focused hero
- `CaveEvolutionStory.tsx` - Remove storytelling section
- `UseCasesDemo.tsx` - Remove
- `ChromeExtensionDemo.tsx` - Fold into new hero demo
- `SapienWriteDifference.tsx` - Remove
- `Testimonials.tsx` - Remove (can add back later)
- `HowItWorks.tsx` - Remove
- `Features.tsx` - Replace with simpler version
- `ToneSelector.tsx` on landing page - Remove (tones are in extension)
- `AIDetectionResults.tsx` on landing page - Remove

**Components to KEEP:**
- `WritingJourneyPricing.tsx` - Simplify to 2 plans (Free + Ultra)
- `FAQ.tsx` - Update questions for extension focus
- `Footer.tsx` - Simplify
- `Header.tsx` - Simplify nav links
- All UI components, auth, Supabase integration

### Detailed Changes

#### 1. New Landing Page (`src/pages/Index.tsx`)
- Header: Logo + Pricing + Sign In / Dashboard
- Hero with extension install CTA
- 3-card features section
- Pricing (reuse WritingJourneyPricing)
- Short FAQ
- Footer with privacy/terms links

#### 2. New Hero Component (`src/components/HeroSection.tsx`)
- Rewrite entirely: big headline, subtitle, Chrome Web Store install button
- Visual demo showing the extension context menu
- No text input area, no AI detection

#### 3. Simplified Dashboard (`src/pages/Dashboard.tsx`)
Remove the entire humanizer tool (textarea, tone selector, result display, AI detection tab). Keep only:
- Usage card with progress bar
- Plan info + upgrade/manage subscription
- Extension download/setup section
- Extra words purchase

#### 4. Simplified Header (`src/components/Header.tsx`)
Nav links: Pricing | Sign In / Dashboard (remove Blog, Contact, Chrome Extension links)

#### 5. Updated Router (`src/App.tsx`)
Remove routes: `/about`, `/blog`, `/contact`, `/chrome-extension`

#### 6. Simplified Footer (`src/components/Footer.tsx`)
Minimal: Privacy Policy | Terms of Service | Contact email

### What We WON'T Touch
- Chrome extension code (stays as-is)
- All Supabase edge functions (humanize, checkout, webhooks, etc.)
- Auth system
- Stripe integration
- Database schema
- Settings page

### Execution Order
1. Update Header (simplify nav)
2. Rewrite HeroSection (extension-focused)
3. Rebuild Index page (new sections)
4. Strip Dashboard down to usage portal
5. Clean up router (remove unused routes)
6. Simplify Footer

