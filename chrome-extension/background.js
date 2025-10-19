// Background Service Worker - Simple and Reliable

console.log('[Background] Service worker initialized');

self.importScripts('config.js', 'auth.js');

// Safe message sending helper
async function safeSendMessage(tabId, message, options = {}) {
  try {
    await chrome.tabs.sendMessage(tabId, message, options);
  } catch (error) {
    // Silently ignore "receiving end does not exist" errors
    if (!error.message?.includes('Receiving end does not exist')) {
      console.error('[Background] Message send error:', error);
    }
  }
}

// Create context menu with tone submenu
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed');
  
  // Create parent menu item
  chrome.contextMenus.create({
    id: 'humanize-parent',
    title: 'Humanize with SapienWrite',
    contexts: ['selection']
  });
  
  // Create tone submenu items
  const tones = [
    { id: 'tone-regular', title: 'Regular - Natural, balanced' },
    { id: 'tone-formal', title: 'Formal/Academic - Professional, scholarly' },
    { id: 'tone-persuasive', title: 'Persuasive/Sales - Compelling, convincing' },
    { id: 'tone-empathetic', title: 'Empathetic/Warm - Understanding, caring' },
    { id: 'tone-sarcastic', title: 'Sarcastic - Witty, ironic' },
    { id: 'tone-funny', title: 'Funny - Humorous, entertaining' }
  ];
  
  tones.forEach(tone => {
    chrome.contextMenus.create({
      id: tone.id,
      parentId: 'humanize-parent',
      title: tone.title,
      contexts: ['selection']
    });
  });
  
  console.log('[Background] Context menu with tone submenu created');
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Check if it's a tone submenu item
  const toneMap = {
    'tone-regular': 'regular',
    'tone-formal': 'formal',
    'tone-persuasive': 'persuasive',
    'tone-empathetic': 'empathetic',
    'tone-sarcastic': 'sarcastic',
    'tone-funny': 'funny'
  };
  
  const tone = toneMap[info.menuItemId];
  if (!tone) return; // Not a tone item
  
  console.log('[Background] Context menu clicked with tone:', tone);
  
  const selectedText = info.selectionText;
  if (!selectedText) return;
  
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    await safeSendMessage(tab.id, {
      action: 'showNotification',
      message: 'Please login to use SapienWrite extension',
      type: 'error'
    }, { frameId: info.frameId });
    return;
  }
  
  try {
    const subscriptionData = await checkSubscription();
    const plan = subscriptionData.plan || 'free';
    
    if (plan !== 'extension_only' && plan !== 'master' && plan !== 'ultra') {
      await safeSendMessage(tab.id, {
        action: 'showUpgradeRequired',
        currentPlan: plan
      }, { frameId: info.frameId });
      return;
    }
    
    const wordCount = selectedText.trim().split(/\s+/).length;
    const session = await getSession();
    
    // Validate session before using it
    if (!session || !session.user) {
      console.error('[Background] No valid session');
      await safeSendMessage(tab.id, {
        action: 'showNotification',
        message: 'Session expired. Please reconnect the extension.',
        type: 'error'
      }, { frameId: info.frameId });
      return;
    }
    
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
      const totalUsed = (usageData.words_used || 0) + (usageData.extension_words_used || 0);
      wordBalance = Math.max(0, 30000 - totalUsed);
    } else {
      wordBalance = 0;
    }
    
    // Check if user has enough words
    if (wordCount > wordBalance) {
      await safeSendMessage(tab.id, {
        action: 'showNotification',
        message: `Not enough words! Need ${wordCount}, have ${wordBalance}.`,
        type: 'error'
      }, { frameId: info.frameId });
      return;
    }
    
    // Start humanization immediately
    await handleHumanizeRequest(selectedText, tone, tab.id, info.frameId);
    
  } catch (error) {
    console.error('[Background] Error:', error);
    await safeSendMessage(tab.id, {
      action: 'showNotification',
      message: 'Failed to check account. Please try again.',
      type: 'error'
    }, { frameId: info.frameId });
  }
});

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Message received:', message.action);
  
  if (message.action === 'humanizeWithTone') {
    handleHumanizeRequest(message.text, message.tone, sender.tab?.id, sender.frameId)
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
  
  if (message.action === 'requestSessionFromWebApp') {
    console.log('[Background] Requesting session from web app...');
    
    // Query all SapienWrite tabs
    chrome.tabs.query({}, (tabs) => {
      const sapienWriteTabs = tabs.filter(tab => 
        tab.url && (
          tab.url.includes('sapienwrite.com') ||
          tab.url.includes('lovableproject.com') ||
          tab.url.includes('localhost:5173')
        )
      );
      
      console.log('[Background] Found SapienWrite tabs:', sapienWriteTabs.length);
      
      if (sapienWriteTabs.length === 0) {
        sendResponse({ success: false, tabsFound: 0 });
        return;
      }
      
      // Send request to all matching tabs
      sapienWriteTabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SAPIENWRITE_REQUEST_SESSION'
        }).catch(err => {
          console.log('[Background] Could not send to tab', tab.id, err.message);
        });
      });
      
      sendResponse({ success: true, tabsFound: sapienWriteTabs.length });
    });
    
    return true; // Keep channel open for async response
  }
});

// Handle humanize request
async function handleHumanizeRequest(text, tone, tabId, frameId) {
  try {
    await safeSendMessage(tabId, { action: 'showProcessing' }, { frameId });
    
    const result = await callSupabaseFunction('humanize-text-hybrid', {
      text: text,
      tone: tone,
      source: 'extension'
    });
    
    console.log('[Background] Text humanized successfully');
    
    // Extract humanized text (edge function returns snake_case)
    const humanizedText = result.humanized_text || result.humanizedText;
    
    if (!humanizedText || humanizedText.trim() === '') {
      throw new Error('Empty response from humanization service');
    }
    
    // Automatically replace text
    await safeSendMessage(tabId, {
      action: 'replaceText',
      originalText: text,
      humanizedText: humanizedText
    }, { frameId });
    
  } catch (error) {
    console.error('[Background] Error humanizing:', error);
    await safeSendMessage(tabId, {
      action: 'showError',
      message: error.message || 'Failed to humanize text'
    }, { frameId });
  }
}
