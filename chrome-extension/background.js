// Background Service Worker - Handles context menus and messages

console.log('[Background] Service worker initialized');

// Import config and auth (service workers need to use importScripts)
self.importScripts('config.js', 'auth.js');

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed');
  
  chrome.contextMenus.create({
    id: 'humanize-selection',
    title: 'Humanize with SapienWrite',
    contexts: ['selection']
  });
  
  console.log('[Background] Context menu created');
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'humanize-selection') {
    console.log('[Background] Context menu clicked');
    
    const selectedText = info.selectionText;
    if (!selectedText) {
      console.log('[Background] No text selected');
      return;
    }
    
    // Check authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      console.log('[Background] User not authenticated');
      // Notify user to login
      chrome.tabs.sendMessage(tab.id, {
        action: 'showNotification',
        message: 'Please login to use SapienWrite extension',
        type: 'error'
      });
      return;
    }
    
    try {
      // Check subscription and word balance
      const subscriptionData = await checkSubscription();
      const plan = subscriptionData.plan || 'free';
      
      // Check if extension-only or ultra plan (also support legacy master)
      if (plan !== 'extension_only' && plan !== 'master' && plan !== 'ultra') {
        chrome.tabs.sendMessage(tab.id, {
          action: 'showNotification',
          message: 'Upgrade to Extension-Only or Ultra plan to use the Chrome Extension',
          type: 'error'
        });
        return;
      }
      
      // Get word count
      const wordCount = selectedText.trim().split(/\s+/).length;
      console.log('[Background] Selected text word count:', wordCount);
      
      // Fetch current usage
      const session = await getSession();
      const extensionLimit = EXTENSION_LIMITS[plan] || 750;
      
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/usage_tracking?user_id=eq.${session.user.id}&select=words_used,extension_words_used`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );
      
      const data = await response.json();
      const usageData = data[0] || { words_used: 0, extension_words_used: 0 };
      
      // Calculate word balance based on plan
      let wordBalance;
      if (plan === 'free') {
        // Free plan: shared pool
        const totalUsed = (usageData.words_used || 0) + (usageData.extension_words_used || 0);
        wordBalance = Math.max(0, extensionLimit - totalUsed);
      } else if (plan === 'extension_only' || plan === 'ultra' || plan === 'master') {
        // Extension-Only, Ultra, Master: separate extension pool
        const extensionUsed = usageData.extension_words_used || 0;
        wordBalance = Math.max(0, extensionLimit - extensionUsed);
      } else {
        wordBalance = 0; // Pro plan has no extension access
      }
      
      console.log('[Background] Word balance:', wordBalance);
      
      if (wordBalance < wordCount) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'showNotification',
          message: `Not enough words! Need ${wordCount} but have ${wordBalance} remaining.`,
          type: 'error'
        });
        return;
      }
      
      // Show processing notification
      chrome.tabs.sendMessage(tab.id, {
        action: 'showNotification',
        message: `Humanizing ${wordCount} words...`,
        type: 'info'
      });
      
      // Call humanize function with source indicator
      const result = await callSupabaseFunction('humanize-text-hybrid', {
        text: selectedText,
        tone: 'regular',
        source: 'extension'
      });
      
      console.log('[Background] Text humanized successfully');
      
      // Send humanized text back to content script
      chrome.tabs.sendMessage(tab.id, {
        action: 'replaceText',
        originalText: selectedText,
        humanizedText: result.humanizedText,
        wordCount: wordCount
      });
      
    } catch (error) {
      console.error('[Background] Error humanizing text:', error);
      chrome.tabs.sendMessage(tab.id, {
        action: 'showNotification',
        message: 'Failed to humanize text. Please try again.',
        type: 'error'
      });
    }
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Message received:', message);
  
  if (message.action === 'checkAuth') {
    isAuthenticated().then(authenticated => {
      sendResponse({ authenticated });
    });
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'getSubscription') {
    checkSubscription().then(data => {
      sendResponse(data);
    }).catch(error => {
      sendResponse({ error: error.message });
    });
    return true;
  }
});
