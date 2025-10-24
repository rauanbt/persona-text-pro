// Background Service Worker - Simple and Reliable

console.log('[Background] Service worker initialized');

self.importScripts('config.js', 'auth.js');

// Track in-flight humanize requests to prevent concurrent calls
const inFlight = new Map(); // key: `${tabId}:${frameId}`, value: AbortController

// Session cache - 30 second TTL to avoid slow checks
const sessionCache = {
  session: null,
  timestamp: 0,
  ttl: 30000 // 30 seconds
};

// Safe message sending helper
async function safeSendMessage(tabId, message, options = {}) {
  try {
    await chrome.tabs.sendMessage(tabId, message, options);
  } catch (error) {
    if (error.message?.includes('Receiving end does not exist')) {
      // Try without frameId if frameId was specified
      if (options.frameId !== undefined) {
        console.log('[Background] Retrying without frameId...');
        try {
          await chrome.tabs.sendMessage(tabId, message);
          return;
        } catch (retryError) {
          console.log('[Background] Retry failed:', retryError.message);
        }
      }
      // Silently ignore - this is expected when content script isn't loaded
      console.log('[Background] Content script not loaded in tab, ignoring');
    } else {
      console.error('[Background] Message send error:', error);
    }
  }
}

// Fast session check for humanization (uses cache)
async function ensureFreshSessionFast() {
  const now = Date.now();
  
  // Check cache first
  if (sessionCache.session && (now - sessionCache.timestamp) < sessionCache.ttl) {
    return { success: true };
  }
  
  // Quick authentication check
  const authenticated = await isAuthenticated();
  if (authenticated) {
    const session = await getSession();
    if (session) {
      // Update cache
      sessionCache.session = session;
      sessionCache.timestamp = now;
      return { success: true };
    }
  }
  
  // No session - fail fast (no slow reconnect attempts)
  return { success: false, reason: 'no_session' };
}

// Full session check (used by popup and non-urgent flows)
async function ensureFreshSession() {
  const authenticated = await isAuthenticated();
  if (authenticated) {
    const session = await getSession();
    if (session) {
      // Update cache
      sessionCache.session = session;
      sessionCache.timestamp = Date.now();
      return { success: true };
    }
  }
  
  // Check for remember_me flag and auto-reconnect
  const data = await chrome.storage.local.get(['remember_me', 'needs_reconnect', 'user_email']);
  
  if (data.remember_me && data.needs_reconnect) {
    console.log('[Background] Auto-reconnecting for', data.user_email);
    
    // Attempt auto-reconnect (up to 2 tries)
    for (let i = 0; i < 2; i++) {
      console.log(`[Background] Reconnect attempt ${i + 1}/2`);
      const result = await requestSessionFromWebApp(2000);
      
      if (result.success) {
        await chrome.storage.local.remove(['needs_reconnect']);
        console.log('[Background] Auto-reconnect successful');
        // Update cache
        const session = await getSession();
        sessionCache.session = session;
        sessionCache.timestamp = Date.now();
        return { success: true };
      }
      
      // Wait 1 second between attempts
      if (i < 1) await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Failed after 2 attempts
    console.log('[Background] Auto-reconnect failed, manual action required');
    chrome.notifications.create({
      type: 'basic',
      title: 'SapienWrite - Reconnect Required',
      message: 'Please open the extension to reconnect',
      iconUrl: 'icons/icon-48.png'
    });
    return { success: false, reason: 'reconnect_failed' };
  }
  
  // No remember_me, just try to get session from open tabs
  console.log('[Background] No session - requesting from web app');
  return await requestSessionFromWebApp(2000);
}

// Helper to request session from web app
async function requestSessionFromWebApp(timeoutMs = 2000) {
  return new Promise((resolve) => {
    chrome.tabs.query({}, async (tabs) => {
      const sapienWriteTabs = tabs.filter(tab => 
        tab.url && (
          tab.url.includes('sapienwrite.com') ||
          tab.url.includes('lovableproject.com') ||
          tab.url.includes('localhost:5173')
        )
      );
      
      if (sapienWriteTabs.length === 0) {
        resolve({ success: false, reason: 'no_tabs' });
        return;
      }
      
      // Request session from all matching tabs
      sapienWriteTabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SAPIENWRITE_REQUEST_SESSION'
        }).catch(() => {});
      });
      
      // Wait for session
      const sessionListener = (message) => {
        if (message.action === 'sessionStored') {
          chrome.runtime.onMessage.removeListener(sessionListener);
          clearTimeout(timeout);
          resolve({ success: true });
        }
      };
      
      chrome.runtime.onMessage.addListener(sessionListener);
      
      const timeout = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(sessionListener);
        resolve({ success: false, reason: 'timeout' });
      }, timeoutMs);
    });
  });
}

// Proactive session sync when SapienWrite tab is activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && (
      tab.url.includes('sapienwrite.com') ||
      tab.url.includes('lovableproject.com') ||
      tab.url.includes('localhost:5173')
    )) {
      console.log('[Background] SapienWrite tab focused, syncing session...');
      // Wait 100ms for tab to be fully loaded
      setTimeout(() => {
        chrome.tabs.sendMessage(activeInfo.tabId, {
          type: 'SAPIENWRITE_REQUEST_SESSION'
        }).catch(() => {});
      }, 100);
    }
  } catch (e) {
    // Tab might not exist anymore
  }
});

// Map legacy tone names to supported tones
function mapToneToSupported(tone) {
  const toneMap = {
    'professional': 'formal',
    'casual': 'regular',
    'academic': 'formal',
    'creative': 'regular'
  };
  
  return toneMap[tone] || tone;
}

// Create context menu with tone submenu
function setupContextMenu() {
  console.log('[Background] Setting up context menu...');
  
  // Remove existing menus to avoid duplicates
  chrome.contextMenus.removeAll(() => {
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
      { id: 'tone-grammar', title: 'Grammar Fix - Correct errors only' }
    ];
    
    tones.forEach(tone => {
      chrome.contextMenus.create({
        id: tone.id,
        parentId: 'humanize-parent',
        title: tone.title,
        contexts: ['selection']
      });
    });
    
    console.log('[Background] Context menu created');
  });
}

// Register context menu on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed');
  setupContextMenu();
});

// Register context menu on browser startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Browser started');
  setupContextMenu();
});

// Register context menu immediately when service worker loads
setupContextMenu();

// Handle context menu clicks - IMMEDIATE one-click humanize
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Check if it's a tone submenu item
  const toneMap = {
    'tone-regular': 'regular',
    'tone-formal': 'formal',
    'tone-persuasive': 'persuasive',
    'tone-empathetic': 'empathetic',
    'tone-sarcastic': 'sarcastic',
    'tone-grammar': 'grammar'
  };
  
  const tone = toneMap[info.menuItemId];
  if (!tone) return; // Not a tone item
  
  console.log(`[Background] Context menu → starting humanize immediately (tone=${tone}, intensity=medium, force=true)`);
  
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
  
  // Send processing status IMMEDIATELY (best effort - don't wait)
  safeSendMessage(tab.id, {
    action: 'showProcessing'
  }, { frameId: info.frameId });
  
  // Validate session and check subscription
  const sessionResult = await ensureFreshSession();
  if (!sessionResult.success) {
    await safeSendMessage(tab.id, {
      action: 'showError',
      message: 'Reconnect required. Open sapienwrite.com to refresh your session.'
    }, { frameId: info.frameId });
    return;
  }
  
  try {
    const subscriptionData = await checkSubscription();
    const plan = subscriptionData.plan || 'free';
    
    // Block free and pro users from extension access
    if (plan === 'free' || plan === 'pro') {
      await safeSendMessage(tab.id, {
        action: 'showUpgradeRequired',
        currentPlan: plan
      }, { frameId: info.frameId });
      return;
    }
    
    const session = await getSession();
    if (!session || !session.user) {
      console.error('[Background] No valid session');
      await safeSendMessage(tab.id, {
        action: 'showError',
        message: 'Session expired. Please reconnect the extension.'
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
    
    const wordCount = selectedText.trim().split(/\s+/).length;
    
    // Check if enough words
    if (wordCount > wordBalance) {
      await safeSendMessage(tab.id, {
        action: 'showUpgradeRequired',
        currentPlan: plan
      }, { frameId: info.frameId });
      return;
    }
    
    console.log('[Background] Usage check passed:', { plan, wordBalance, wordCount });
    
    // IMMEDIATELY start humanization - don't wait for dialog button (using medium intensity for speed)
    await handleHumanizeRequest(selectedText, tone, 'medium', true, tab.id, info.frameId);
    
  } catch (error) {
    console.error('[Background] Error in context menu handler:', error);
    await safeSendMessage(tab.id, {
      action: 'showError',
      message: 'Failed to check account. Please try again.'
    }, { frameId: info.frameId });
  }
});

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Message received:', message.action);
  
  if (message.action === 'humanizeWithTone') {
    // Map legacy tone names to supported tones
    const mappedTone = mapToneToSupported(message.tone);
    const intensity = message.toneIntensity || 'strong';
    const forceRewrite = message.forceRewrite !== undefined ? message.forceRewrite : true;
    console.log('[Background] ✅ TONE SELECTED:', message.tone, mappedTone !== message.tone ? `→ ${mappedTone}` : '', '| intensity:', intensity, '| force_rewrite:', forceRewrite);
    
    handleHumanizeRequest(message.text, mappedTone, intensity, forceRewrite, sender.tab?.id, sender.frameId)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'cancelHumanize') {
    const key = `${sender.tab?.id}:${sender.frameId}`;
    const controller = inFlight.get(key);
    if (controller) {
      console.log('[Background] Canceling humanize request for', key);
      controller.abort();
      inFlight.delete(key);
    }
    sendResponse({ canceled: true });
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
        
        // Update session cache
        sessionCache.session = message.session;
        sessionCache.timestamp = Date.now();
        
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
  
  if (message.action === 'ensureFreshSession') {
    console.log('[Background] Manual session refresh requested');
    ensureFreshSession()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'signOut') {
    console.log('[Background] Sign out requested');
    signOut()
      .then(() => {
        // Clear session cache
        sessionCache.session = null;
        sessionCache.timestamp = 0;
        sendResponse({ success: true });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
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

// Simple Jaccard similarity check
function quickSimilarity(a, b) {
  const aw = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const bw = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (aw.size === 0 && bw.size === 0) return 1;
  const inter = [...aw].filter(w => bw.has(w)).length;
  const union = new Set([...aw, ...bw]).size;
  return union === 0 ? 0 : inter / union;
}

// Handle humanize request with timeout and cancel support
async function handleHumanizeRequest(text, tone, toneIntensity, forceRewrite, tabId, frameId) {
  const key = `${tabId}:${frameId}`;
  
  // Single-flight guard: prevent concurrent humanize from same frame
  if (inFlight.has(key)) {
    console.log('[Background] Request already in flight for', key, '- ignoring duplicate');
    return;
  }
  
  const controller = new AbortController();
  inFlight.set(key, controller);
  
  // Hard timeout: 20 seconds
  const timeout = setTimeout(() => {
    console.log('[Background] Request timeout for', key);
    controller.abort(new DOMException('Request timed out', 'AbortError'));
  }, 20000);
  
  try {
    console.log(`[Background] 📤 Sending to edge function with tone: "${tone}" | intensity: "${toneIntensity}" | force_rewrite: ${forceRewrite}`);
    await safeSendMessage(tabId, { action: 'showProcessing' }, { frameId });
    
    // Fast session check (uses cache to avoid slow reconnects)
    const sessionCheck = await ensureFreshSessionFast();
    if (!sessionCheck.success) {
      throw new Error('Session expired. Please reconnect the extension.');
    }
    
    const session = await getSession();
    if (!session) {
      throw new Error('Session expired. Please reconnect the extension.');
    }
    
    // Direct fetch with abort signal instead of callSupabaseFunction
    const response = await fetch(`${SUPABASE_URL}/functions/v1/humanize-text-hybrid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        text: text,
        tone: tone,
        tone_intensity: toneIntensity,
        force_rewrite: forceRewrite,
        source: 'extension',
        speed_mode: true  // Enable speed mode for extension (skips tone booster & language verification)
      }),
      signal: controller.signal
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed: ${errorText}`);
    }
    
    const result = await response.json();
    
    console.log('[Background] ✅ Response received - tone:', tone, 'intensity:', toneIntensity);
    
    // Extract humanized_text and similarity meta from result
    const humanizedText = typeof result.humanized_text === 'string' ? result.humanized_text : (result.humanizedText || '');
    const simBeforeMeta = typeof result.similarity_before === 'number' ? result.similarity_before : undefined;
    const simAfterMeta = typeof result.similarity_after === 'number' ? result.similarity_after : undefined;
    
    if (!humanizedText || !humanizedText.trim()) {
      throw new Error('Empty result from server');
    }

    // Check if result is too similar to original
    const similarity = quickSimilarity(text, humanizedText);
    console.log(`[Background] Similarity check: ${(similarity * 100).toFixed(1)}%`, simBeforeMeta !== undefined ? `(server before=${(simBeforeMeta*100).toFixed(1)}% after=${(simAfterMeta*100).toFixed(1)}%)` : '');
    
    const tooSimilar = (similarity > 0.85) || (humanizedText.trim() === text.trim());
    let warning = undefined;
    
    if (tone !== 'regular' && tooSimilar) {
      const metaLine = (simBeforeMeta !== undefined && simAfterMeta !== undefined)
        ? ` (server similarity: before ${(simBeforeMeta*100).toFixed(0)}% → after ${(simAfterMeta*100).toFixed(0)}%)`
        : '';
      warning = `⚠️ Text came back ${(similarity * 100).toFixed(0)}% similar.${metaLine} Try a different tone or stronger intensity.`;
    }
    
    // ALWAYS show result dialog for user verification
    console.log('[Background] ===== SENDING SHOW RESULT MESSAGE =====');
    console.log('[Background] tabId:', tabId, 'frameId:', frameId);
    console.log('[Background] originalText length:', text.length);
    console.log('[Background] humanizedText length:', humanizedText.length);
    
    const resultMessage = {
      action: 'showResult',
      originalText: text,
      humanizedText: humanizedText,
      tone: tone,
      toneIntensity: toneIntensity,
      warning: warning
    };
    
    console.log('[Background] Sending message:', resultMessage);
    await safeSendMessage(tabId, resultMessage, { frameId });
    console.log('[Background] Message sent successfully');
    
  } catch (error) {
    console.error('[Background] Error humanizing:', error);
    
    if (error.name === 'AbortError') {
      await safeSendMessage(tabId, {
        action: 'showError',
        message: 'Request canceled or timed out. Please try again.'
      }, { frameId });
    } else {
      await safeSendMessage(tabId, {
        action: 'showError',
        message: error.message || 'Failed to humanize text'
      }, { frameId });
    }
  } finally {
    clearTimeout(timeout);
    inFlight.delete(key);
  }
}
