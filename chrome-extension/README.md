# SapienWrite Chrome Extension

Humanize AI-generated text anywhere on the web with a simple right-click.

## 🚀 Features

- **Context Menu Integration**: Right-click any selected text to humanize it instantly
- **Real-time Word Balance**: Track your remaining words directly in the extension popup
- **Multiple Plans Support**: Works with Extension-Only ($12.95/month) or Master plan ($54.95/month)
- **Quick Humanize**: Paste and humanize text directly from the popup
- **Seamless Sync**: Your word balance and subscription status sync automatically with SapienWrite.com

## 📋 Requirements

- Google Chrome browser (version 88 or higher)
- Active SapienWrite subscription (Extension-Only or Master plan)
- Account at [sapienwrite.com](https://sapienwrite.com)

## 🔧 Local Testing Instructions

### 1. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder from your project
5. The extension icon should appear in your Chrome toolbar

### 2. Add Extension Icons

Before testing, you need to create extension icons:

**Required sizes:**
- 16x16 pixels (toolbar icon)
- 48x48 pixels (extension management page)
- 128x128 pixels (Chrome Web Store)

**How to create icons:**

1. Create a folder: `chrome-extension/icons/`
2. Use your SapienWrite logo or create simplified versions
3. Save as PNG files:
   - `icon-16.png`
   - `icon-48.png`
   - `icon-128.png`

**Quick icon generation tips:**
- Use [Figma](https://figma.com) or [Canva](https://canva.com) for design
- Keep design simple and recognizable at small sizes
- Use your brand colors (purple/gradient recommended)
- Export as PNG with transparent background

### 3. Test Authentication

1. Click the extension icon in Chrome toolbar
2. Click "Login at SapienWrite.com"
3. Log in to your SapienWrite account
4. Return to the extension popup
5. Verify your email and plan appear correctly

### 4. Test Context Menu

1. Go to any webpage (e.g., Google Docs, Gmail, Medium)
2. Select some text
3. Right-click → "Humanize with SapienWrite"
4. The text should be humanized and replaced automatically
5. Check that your word balance updates

### 5. Test Quick Humanize

1. Open the extension popup
2. Paste text in the "Quick Humanize" textarea
3. Click "Humanize Text"
4. The result should copy to your clipboard
5. Paste to verify the humanized text

## 🐛 Troubleshooting

### "Not authenticated" error
- Make sure you're logged in at sapienwrite.com
- Try clicking "Login at SapienWrite.com" again
- Check Chrome console for auth errors

### Context menu doesn't appear
- Refresh the webpage after loading the extension
- Make sure text is selected before right-clicking
- Check if extension is enabled in chrome://extensions/

### Text replacement fails
- Some websites prevent extensions from modifying content
- Fallback: Humanized text is copied to clipboard automatically
- Try using the Quick Humanize feature instead

### Word balance shows "Error"
- Check your internet connection
- Verify you're authenticated
- Check Chrome DevTools console for error messages

## 📦 Chrome Web Store Publishing

### Before Publishing:

1. ✅ Test all features thoroughly
2. ✅ Create all required icon sizes
3. ✅ Take 3-5 screenshots (1280x800 or 640x400)
4. ✅ Create promotional tile (440x280)
5. ✅ Prepare privacy policy URL: `https://sapienwrite.com/privacy-policy`

### Publishing Steps:

1. **Create Developer Account**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Pay $5 one-time registration fee

2. **Create ZIP Package**
   ```bash
   # From your project root
   cd chrome-extension
   zip -r sapienwrite-extension.zip * -x "*.git*" -x "README.md"
   ```

3. **Upload to Chrome Web Store**
   - Click "New Item" in Developer Dashboard
   - Upload `sapienwrite-extension.zip`
   - Fill out store listing

4. **Store Listing Details**
   - **Title**: SapienWrite - AI Text Humanizer
   - **Summary**: Humanize AI-generated text anywhere on the web. Requires SapienWrite subscription.
   - **Description**: (See full description below)
   - **Category**: Productivity
   - **Language**: English
   - **Price**: Free (with in-app purchases/subscription required)

5. **Screenshots Required**
   - Extension popup showing word balance
   - Context menu in action
   - Before/after humanization example
   - Quick humanize feature
   - Subscription management screen

6. **Privacy Practices**
   - Data usage: Authentication tokens, user email, subscription status
   - Data transmission: Encrypted via HTTPS to Supabase
   - Privacy policy: https://sapienwrite.com/privacy-policy

7. **Permissions Justification**
   - `storage`: Store user authentication session
   - `activeTab`: Access selected text on current page
   - `contextMenus`: Add "Humanize with SapienWrite" menu option
   - `host_permissions` (Supabase): Call backend API for humanization

8. **Submit for Review**
   - Review typically takes 1-3 business days
   - You'll receive email notification when approved

### Store Listing Description Template:

```
🔥 Humanize AI-generated text anywhere on the web with SapienWrite!

SapienWrite is the #1 AI text humanizer that makes your AI-generated content sound authentically human. Bypass AI detectors while maintaining meaning and quality.

✨ KEY FEATURES:
• Right-click any text to humanize instantly
• Works on Google Docs, Gmail, Medium, and all websites
• Real-time word balance tracking
• 6 distinct tone personalities
• Seamless sync with sapienwrite.com
• Advanced dual-engine humanization

📊 PRICING:
• Free Plan: 750 words/month (web platform only)
• Extension-Only: $12.95/month for 5,000 words
• Master Plan: $54.95/month for 30,000 words (best value!)

💡 HOW IT WORKS:
1. Install the extension
2. Log in with your SapienWrite account
3. Subscribe to Extension-Only or Master plan
4. Select any text on any webpage
5. Right-click → "Humanize with SapienWrite"
6. Watch your text transform instantly!

🔒 PRIVACY & SECURITY:
• All data encrypted via HTTPS
• No data sold to third parties
• Secure authentication via Supabase
• Read our privacy policy: sapienwrite.com/privacy-policy

💳 SUBSCRIPTION REQUIRED:
This extension requires an active SapienWrite subscription. Sign up for a free account at sapienwrite.com to get started with 750 free words!

⭐ WHAT USERS SAY:
"Game-changer for content creators!" - Sarah M.
"Bypasses every AI detector I've tested." - John D.
"Best humanizer I've ever used." - Emily R.

📞 SUPPORT:
Need help? Contact us at support@sapienwrite.com or visit sapienwrite.com/contact
```

## 🎯 Post-Launch Checklist

After Chrome Web Store approval:

- [ ] Update all "Download Extension" links on website to Chrome Web Store URL
- [ ] Update `/chrome-extension` page with download link
- [ ] Send email announcement to existing users
- [ ] Post on social media (Twitter, LinkedIn, Reddit)
- [ ] Monitor Chrome Web Store reviews and respond promptly
- [ ] Track extension install count and active users
- [ ] Collect user feedback for v2 features

## 📈 Analytics & Monitoring

Track these metrics post-launch:

1. **Extension Metrics**
   - Total installs
   - Active daily/monthly users
   - Uninstall rate
   - Chrome Web Store rating

2. **Business Metrics**
   - Extension-Only subscriptions from extension users
   - Master plan upgrades
   - Average revenue per extension user
   - Conversion rate (free → paid)

3. **Technical Metrics**
   - API error rates
   - Average humanization latency
   - Failed humanization attempts
   - Authentication issues

## 🚀 Future Enhancements (V2)

Ideas for next version:

1. **Auto-detection**: Automatically detect AI text on page load
2. **Inline button**: Floating button appears when typing in textareas
3. **Batch humanize**: Select multiple paragraphs at once
4. **History**: View past humanizations in popup
5. **Tone selector**: Choose tone directly from context menu
6. **Firefox/Edge**: Port to other browsers
7. **Keyboard shortcut**: Humanize with Ctrl+Shift+H

## 📝 Development Notes

- Extension uses Manifest V3 (latest Chrome standard)
- Service worker (background.js) handles context menu and API calls
- Content script (content.js) handles text replacement
- Popup (popup.html) provides quick access UI
- Authentication stored in chrome.storage.sync (syncs across devices)

## 🔗 Useful Links

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Web Store Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)

---

Made with 🔥 by SapienWrite
