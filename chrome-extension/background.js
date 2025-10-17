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
      
      // Check if extension-only or ultra plan
      if (plan !== 'extension_only' && plan !== 'master' && plan !== 'ultra') {
        // Show upgrade required dialog instead of just notification
        chrome.tabs.sendMessage(tab.id, {
          action: 'showUpgradeRequired',
          currentPlan: plan
        });
        return;
      }
      
      // Get word count
      const wordCount = selectedText.trim().split(/\s+/).length;
      
      // Fetch word balance
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
      
      // Calculate word balance
      let wordBalance;
      if (plan === 'free') {
        const totalUsed = (usageData.words_used || 0) + (usageData.extension_words_used || 0);
        wordBalance = Math.max(0, extensionLimit - totalUsed);
      } else if (plan === 'extension_only') {
        const extensionUsed = usageData.extension_words_used || 0;
        wordBalance = Math.max(0, extensionLimit - extensionUsed);
      } else if (plan === 'ultra' || plan === 'master') {
        const extensionRemaining = Math.max(0, 5000 - (usageData.extension_words_used || 0));
        const webRemaining = Math.max(0, 30000 - (usageData.words_used || 0));
        wordBalance = extensionRemaining + webRemaining;
      } else {
        wordBalance = 0;
      }
      
      // Show dialog instead of immediately processing
      chrome.tabs.sendMessage(tab.id, {
        action: 'showDialog',
        text: selectedText,
        wordCount: wordCount,
        wordBalance: wordBalance
      });
      
    } catch (error) {
      console.error('[Background] Error:', error);
      chrome.tabs.sendMessage(tab.id, {
        action: 'showNotification',
        message: 'Failed to check account. Please try again.',
        type: 'error'
      });
    }
  }
});

// Handle messages from popup, content scripts, and auth bridge
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Message received:', message);
  
  if (message.action === 'humanizeWithTone') {
    handleHumanizeRequest(message.text, message.tone, sender.tab?.id)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'checkAuth') {
    console.log('[Background] Checking authentication...');
    isAuthenticated().then(authenticated => {
      console.log('[Background] Auth result:', authenticated);
      sendResponse({ authenticated });
    });
    return true;
  }
  
  if (message.action === 'getSubscription') {
    console.log('[Background] Getting subscription...');
    checkSubscription().then(data => {
      console.log('[Background] Subscription data:', data);
      sendResponse(data);
    }).catch(error => {
      console.error('[Background] Subscription error:', error);
      sendResponse({ error: error.message });
    });
    return true;
  }
  
  if (message.action === 'storeSession') {
    console.log('[Background] Storing session...');
    storeSession(message.session)
      .then(() => {
        console.log('[Background] Session stored successfully');
        // Verify storage
        chrome.storage.sync.get(['access_token'], (result) => {
          console.log('[Background] Verified storage - has access_token:', !!result.access_token);
        });
        
        // Mark last connection time to prevent auto-handoff loops
        try { chrome.storage.local.set({ connected: true, last_connected_at: Date.now() }); } catch (e) { /* noop */ }
        
        // Notify popup that session is stored
        chrome.runtime.sendMessage({ action: 'sessionStored' }).catch(() => {
          // Popup might not be open, that's fine
          console.log('[Background] Could not notify popup (likely closed)');
        });
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('[Background] Failed to store session:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.action === 'subscriptionUpdated') {
    console.log('[Background] Subscription updated notification received');
    // Forward to popup if it's open
    chrome.runtime.sendMessage({ action: 'subscriptionUpdated' }).catch(() => {
      console.log('[Background] Could not forward to popup (likely closed)');
    });
    sendResponse({ success: true });
    return true;
  }
});

// Handle humanize request with tone
async function handleHumanizeRequest(text, tone, tabId) {
  try {
    // Show processing notification
    chrome.tabs.sendMessage(tabId, {
      action: 'showProcessing'
    });
    
    // Call humanize function
    const result = await callSupabaseFunction('humanize-text-hybrid', {
      text: text,
      tone: tone,
      source: 'extension'
    });
    
    console.log('[Background] Text humanized successfully');
    
    // Send result to dialog
    chrome.tabs.sendMessage(tabId, {
      action: 'showResult',
      originalText: text,
      humanizedText: result.humanizedText
    });
    
  } catch (error) {
    console.error('[Background] Error humanizing:', error);
    chrome.tabs.sendMessage(tabId, {
      action: 'showError',
      message: error.message || 'Failed to humanize text'
    });
  }
}
