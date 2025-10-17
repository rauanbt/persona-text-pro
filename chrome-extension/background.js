// Background Service Worker - Simple and Reliable

console.log('[Background] Service worker initialized');

self.importScripts('config.js', 'auth.js');

// Create context menu
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
    if (!selectedText) return;
    
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'showNotification',
        message: 'Please login to use SapienWrite extension',
        type: 'error'
      });
      return;
    }
    
    try {
      const subscriptionData = await checkSubscription();
      const plan = subscriptionData.plan || 'free';
      
      if (plan !== 'extension_only' && plan !== 'master' && plan !== 'ultra') {
        chrome.tabs.sendMessage(tab.id, {
          action: 'showUpgradeRequired',
          currentPlan: plan
        });
        return;
      }
      
      const wordCount = selectedText.trim().split(/\s+/).length;
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

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Message received:', message.action);
  
  if (message.action === 'humanizeWithTone') {
    handleHumanizeRequest(message.text, message.tone, sender.tab?.id)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'checkAuth') {
    isAuthenticated().then(authenticated => {
      sendResponse({ authenticated });
    });
    return true;
  }
  
  if (message.action === 'getSubscription') {
    checkSubscription().then(data => {
      sendResponse(data);
    }).catch(error => {
      sendResponse({ error: error.message });
    });
    return true;
  }
  
  if (message.action === 'storeSession') {
    console.log('[Background] Storing session...');
    storeSession(message.session)
      .then(() => {
        console.log('[Background] Session stored successfully');
        
        // Notify popup
        chrome.runtime.sendMessage({ action: 'sessionStored' }).catch(() => {
          console.log('[Background] Popup not open');
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
    console.log('[Background] Subscription updated');
    chrome.runtime.sendMessage({ action: 'subscriptionUpdated' }).catch(() => {
      console.log('[Background] Popup not open');
    });
    sendResponse({ success: true });
    return true;
  }
});

// Handle humanize request
async function handleHumanizeRequest(text, tone, tabId) {
  try {
    chrome.tabs.sendMessage(tabId, { action: 'showProcessing' });
    
    const result = await callSupabaseFunction('humanize-text-hybrid', {
      text: text,
      tone: tone,
      source: 'extension'
    });
    
    console.log('[Background] Text humanized successfully');
    
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
