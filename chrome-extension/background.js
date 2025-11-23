// Background Service Worker - Simple and Reliable

console.log('[Background] Service worker initialized');

// Load configuration with fallback
try {
  self.importScripts('config.js');
} catch (e) {
  console.error('[Background] Failed to load config.js:', e);
  // Last-resort fallback so the worker can still start
  self.SUPABASE_URL = self.SUPABASE_URL || "https://nycrxoppbsakpkkeiqzb.supabase.co";
  self.SUPABASE_ANON_KEY = self.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55Y3J4b3BwYnNha3Bra2VpcXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4Nzc2NDMsImV4cCI6MjA3NDQ1MzY0M30.On7TSxxCpJT868Kygk1PgfUACyPodjx78G5lKxejt74";
}

// Load auth helpers (depends on the globals above)
self.importScripts('auth.js');

// Track in-flight humanize requests to prevent concurrent calls
const inFlight = new Map(); // key: `${tabId}:${frameId}`, value: AbortController

// Session cache - 30 second TTL to avoid slow checks
const sessionCache = {
  session: null,
  timestamp: 0,
  ttl: 30000 // 30 seconds
};

// Safe message sending helper with robust fallbacks
async function safeSendMessage(tabId, message, options = {}) {
  if (!tabId) {
    console.warn('[safeSend] No tabId provided');
    return false;
  }
  
  // Sanitize frameId - only use if it's a valid integer
  const hasValidFrameId = Number.isInteger(options?.frameId);
  const sendOptions = hasValidFrameId ? { frameId: options.frameId } : undefined;
  
  // Primary attempt: send with sanitized options
  try {
    if (sendOptions) {
      await chrome.tabs.sendMessage(tabId, message, sendOptions);
      console.log(`[safeSend] ✓ Delivered to tab ${tabId}, frame ${sendOptions.frameId}:`, message.action);
    } else {
      await chrome.tabs.sendMessage(tabId, message);
      console.log(`[safeSend] ✓ Delivered to tab ${tabId} (no frame):`, message.action);
    }
    return true;
  } catch (error) {
    console.warn(`[safeSend] Primary send failed to tab ${tabId}:`, error.message);
    
    // Fallback 1: Try without frameId if we initially used one
    if (hasValidFrameId) {
      try {
        await chrome.tabs.sendMessage(tabId, message);
        console.log(`[safeSend] ✓ Fallback 1: Delivered without frameId to tab ${tabId}:`, message.action);
        return true;
      } catch (err2) {
        console.warn(`[safeSend] Fallback 1 failed:`, err2.message);
      }
    }
    
    // Fallback 2: Broadcast to all frames
    try {
      const frames = await chrome.webNavigation.getAllFrames({ tabId });
      if (frames && frames.length > 0) {
        console.log(`[safeSend] Attempting broadcast to ${frames.length} frames`);
        for (const frame of frames) {
          try {
            await chrome.tabs.sendMessage(tabId, message, { frameId: frame.frameId });
            console.log(`[safeSend] ✓ Broadcast delivered to frame ${frame.frameId}:`, message.action);
            return true;
          } catch (frameErr) {
            // Silently continue to next frame
          }
        }
        console.warn(`[safeSend] Broadcast failed - no frames responded`);
      }
    } catch (err3) {
      console.warn(`[safeSend] Broadcast fallback failed:`, err3.message);
    }

    // Final fallback: Show notification for critical UI messages
    if (['showError', 'showUpgradeRequired'].includes(message.action)) {
      console.log(`[safeSend] Showing notification fallback for ${message.action}`);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'SapienWrite',
        message: 'Please refresh the page and try again.'
      });
    }
    
    return false;
  }
}

// Ultra-simple broadcast - send to ALL frames aggressively
async function broadcastToAllFrames(tabId, message) {
  console.log('[Background] 🔊 Broadcasting:', message.action, 'to tab', tabId);
  
  // Strategy 1: Send to main tab (no frameId)
  try {
    await chrome.tabs.sendMessage(tabId, message);
    console.log('[Background] ✅ Sent to main tab');
  } catch (e) {
    console.warn('[Background] ❌ Main tab failed:', e.message);
  }
  
  // Strategy 2: Send to ALL known frames
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    if (frames && frames.length) {
      console.log('[Background] Found', frames.length, 'frames');
      for (const frame of frames) {
        try {
          await chrome.tabs.sendMessage(tabId, message, { frameId: frame.frameId });
        } catch (e) {
          // Silent - some frames won't respond
        }
      }
      console.log('[Background] ✅ Broadcast to all frames complete');
    }
  } catch (e) {
    console.warn('[Background] ❌ Frame broadcast failed:', e.message);
  }
  
  // Strategy 3: Notify via chrome.notifications as last resort
  if (message.action === 'showError' && message.message) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'SapienWrite',
      message: message.message
    });
  }
}

// Waiters for processing ACKs per tab
const processingAckWaiters = new Map();

function waitForProcessingAck(tabId, timeoutMs = 500) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      processingAckWaiters.delete(tabId);
      resolve(false);
    }, timeoutMs);
    processingAckWaiters.set(tabId, () => {
      clearTimeout(timer);
      processingAckWaiters.delete(tabId);
      resolve(true);
    });
  });
}

// Minimal overlay injection fallback using chrome.scripting
async function injectOverlay(tabId, type, payload = {}, frameId) {
  try {
    const target = Number.isInteger(frameId) ? { tabId, frameIds: [frameId] } : { tabId, allFrames: true };
    await chrome.scripting.executeScript({
      target,
      func: (type, payload) => {
        try {
          const ROOT_ID = 'sapienwrite-overlay-root';
          let root = document.getElementById(ROOT_ID);
          if (!root) {
            root = document.createElement('div');
            root.id = ROOT_ID;
            root.style.position = 'fixed';
            root.style.inset = '0';
            root.style.zIndex = '2147483647';
            root.style.pointerEvents = 'none';
            document.documentElement.appendChild(root);
          }
          function clear() { while (root.firstChild) root.removeChild(root.firstChild); }
          function box() {
            const wrap = document.createElement('div');
            wrap.style.position = 'absolute';
            wrap.style.top = '20px';
            wrap.style.right = '20px';
            wrap.style.maxWidth = '420px';
            wrap.style.pointerEvents = 'auto';
            wrap.style.fontFamily = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
            return wrap;
          }
          clear();
          
          // Reconnect dialog (centered overlay)
          if (type === 'reconnect') {
            root.style.pointerEvents = 'auto';
            root.style.background = 'rgba(0,0,0,0.7)';
            root.style.display = 'flex';
            root.style.alignItems = 'center';
            root.style.justifyContent = 'center';
            const dialog = document.createElement('div');
            dialog.style.background = '#fff';
            dialog.style.padding = '32px';
            dialog.style.borderRadius = '12px';
            dialog.style.maxWidth = '400px';
            dialog.style.boxShadow = '0 20px 50px rgba(0,0,0,0.3)';
            dialog.style.textAlign = 'center';
            dialog.innerHTML = `
              <div style="font-size:48px;margin-bottom:16px;">🔒</div>
              <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Session Expired</h2>
              <p style="margin:0 0 24px;color:#666;line-height:1.5;">${payload.message || 'Your session expired. Click "Reconnect" to sign in again.'}</p>
              <button id="sapienwrite-reconnect-btn" style="background:#7C3AED;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;margin-right:8px;">
                Reconnect Now
              </button>
              <button id="sapienwrite-dismiss-btn" style="background:#e5e5e5;color:#333;border:none;padding:12px 24px;border-radius:8px;font-size:15px;cursor:pointer;">
                Dismiss
              </button>
            `;
            root.appendChild(dialog);
            const reconnectBtn = document.getElementById('sapienwrite-reconnect-btn');
            reconnectBtn.onclick = () => {
              // Show "Connecting..." state
              reconnectBtn.textContent = 'Connecting...';
              reconnectBtn.disabled = true;
              reconnectBtn.style.background = '#9CA3AF';
              reconnectBtn.style.cursor = 'not-allowed';
              
              // Open auth page
              window.open('https://sapienwrite.com/extension-auth', '_blank');
              
              // Signal to background that we're waiting for reconnect
              try {
                chrome.runtime.sendMessage({ action: 'waitingForReconnect' });
              } catch (e) {}
              
              // Wait 30 seconds for session sync, then auto-dismiss if successful
              setTimeout(() => {
                try {
                  chrome.runtime.sendMessage({ action: 'checkReconnectStatus' }, (response) => {
                    if (response?.success) {
                      root.remove();
                    } else {
                      // Restore button state if failed
                      reconnectBtn.textContent = 'Reconnect Now';
                      reconnectBtn.disabled = false;
                      reconnectBtn.style.background = '#7C3AED';
                      reconnectBtn.style.cursor = 'pointer';
                    }
                  });
                } catch (e) {
                  root.remove(); // Cleanup on error
                }
              }, 30000);
            };
            document.getElementById('sapienwrite-dismiss-btn').onclick = () => {
              root.remove();
            };
            return;
          }
          
          const wrap = box();
          if (type === 'processing') {
            const el = document.createElement('div');
            el.style.background = '#111827CC';
            el.style.color = '#F9FAFB';
            el.style.padding = '12px 14px';
            el.style.borderRadius = '10px';
            el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
            el.textContent = 'SapienWrite: processing…';
            wrap.appendChild(el);
            root.appendChild(wrap);
          } else if (type === 'result') {
            const { originalText, humanizedText } = payload || {};
            const el = document.createElement('div');
            el.style.background = '#111827';
            el.style.color = '#F9FAFB';
            el.style.padding = '14px';
            el.style.borderRadius = '10px';
            el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
            el.style.display = 'grid';
            el.style.gap = '10px';
            const pre = document.createElement('pre');
            pre.style.margin = '0';
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.fontFamily = 'inherit';
            pre.textContent = humanizedText || '(empty)';
            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '8px';
            
            const replace = document.createElement('button');
            replace.textContent = 'Replace';
            replace.style.background = '#7C3AED';
            replace.style.color = '#fff';
            replace.style.border = '0';
            replace.style.padding = '8px 10px';
            replace.style.borderRadius = '8px';
            replace.style.cursor = 'pointer';
            replace.style.fontWeight = '500';
            replace.addEventListener('click', async () => {
              const original = originalText || '';
              const text = humanizedText || '';
              function dispatchAll(el) {
                if (!el) return;
                try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
                try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
                try { el.dispatchEvent(new Event('keyup', { bubbles: true })); } catch {}
              }
              function gmailHtmlFromText(t) {
                const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                const lines = String(t).split('\n');
                return lines.map(l => l.length ? `<div>${esc(l)}</div>` : '<div><br></div>').join('');
              }

              let replaced = false;

              // Tier 1: Active input/textarea replacement
              const activeEl = document.activeElement;
              if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
                try {
                  const start = activeEl.selectionStart;
                  const end = activeEl.selectionEnd;
                  if (start != null && end != null && start !== end) {
                    const before = activeEl.value.slice(0, start);
                    const after = activeEl.value.slice(end);
                    activeEl.value = before + text + after;
                    const caret = before.length + text.length;
                    activeEl.selectionStart = activeEl.selectionEnd = caret;
                    dispatchAll(activeEl);
                    replaced = true;
                  } else if (typeof activeEl.value === 'string' && original && activeEl.value.includes(original)) {
                    activeEl.value = activeEl.value.replace(original, text);
                    dispatchAll(activeEl);
                    replaced = true;
                  }
                } catch (e) {}
              }

              // Tier 2: ContentEditable selection replacement
              if (!replaced) {
                try {
                  const sel = window.getSelection && window.getSelection();
                  if (sel && sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    // Gmail multiline handling
                    if (location.hostname.includes('mail.google.com') && text.includes('\n')) {
                      try {
                        const html = gmailHtmlFromText(text);
                        if (document.execCommand('insertHTML', false, html)) {
                          replaced = true;
                        }
                      } catch (e) {}
                    }
                    if (!replaced) {
                      try {
                        if (document.execCommand('insertText', false, text)) {
                          replaced = true;
                        }
                      } catch (e) {}
                    }
                    if (!replaced) {
                      try {
                        range.deleteContents();
                        const node = document.createTextNode(text);
                        range.insertNode(node);
                        range.setStartAfter(node);
                        range.setEndAfter(node);
                        sel.removeAllRanges();
                        sel.addRange(range);
                        replaced = true;
                      } catch (e) {}
                    }
                  }
                } catch (e) {}
              }

              if (replaced) {
                replace.textContent = '✓ Replaced!';
                replace.style.background = '#10B981';
                setTimeout(() => { clear(); root.remove(); }, 800);
                return;
              }

              // Tier 3: Clipboard fallback with clear instructions UI
              try { await navigator.clipboard.writeText(text); } catch (e) {}

              // Replace overlay content with guidance instead of changing button to "Copied!"
              el.innerHTML = '';
              const msg = document.createElement('div');
              msg.style.lineHeight = '1.5';
              msg.innerHTML = '<strong>⚠ Couldn\'t auto-replace</strong><br>The text was copied. Click your editor and press Ctrl/Cmd+V to paste.';

              const actions2 = document.createElement('div');
              actions2.style.display = 'flex';
              actions2.style.gap = '8px';
              actions2.style.marginTop = '8px';

              const copyAgain = document.createElement('button');
              copyAgain.textContent = 'Copy again';
              copyAgain.style.background = '#2563EB';
              copyAgain.style.color = '#fff';
              copyAgain.style.border = '0';
              copyAgain.style.padding = '8px 10px';
              copyAgain.style.borderRadius = '8px';
              copyAgain.style.cursor = 'pointer';
              copyAgain.onclick = async () => { try { await navigator.clipboard.writeText(text); copyAgain.textContent = 'Copied!'; } catch {} };

              const closeBtn = document.createElement('button');
              closeBtn.textContent = 'Close';
              closeBtn.style.background = '#374151';
              closeBtn.style.color = '#E5E7EB';
              closeBtn.style.border = '0';
              closeBtn.style.padding = '8px 10px';
              closeBtn.style.borderRadius = '8px';
              closeBtn.style.cursor = 'pointer';
              closeBtn.onclick = () => { clear(); root.remove(); };

              actions2.appendChild(copyAgain);
              actions2.appendChild(closeBtn);
              el.appendChild(msg);
              el.appendChild(actions2);
            });
            
            const copy = document.createElement('button');
            copy.textContent = 'Copy';
            copy.style.background = '#2563EB';
            copy.style.color = '#fff';
            copy.style.border = '0';
            copy.style.padding = '8px 10px';
            copy.style.borderRadius = '8px';
            copy.style.cursor = 'pointer';
            copy.addEventListener('click', async () => {
              try { await navigator.clipboard.writeText(humanizedText || ''); copy.textContent = 'Copied!'; } catch {}
            });
            const close = document.createElement('button');
            close.textContent = 'Close';
            close.style.background = '#374151';
            close.style.color = '#E5E7EB';
            close.style.border = '0';
            close.style.padding = '8px 10px';
            close.style.borderRadius = '8px';
            close.style.cursor = 'pointer';
            close.addEventListener('click', () => { clear(); root.remove(); });
            actions.appendChild(replace);
            actions.appendChild(copy);
            actions.appendChild(close);
            el.appendChild(pre);
            el.appendChild(actions);
            wrap.appendChild(el);
            root.appendChild(wrap);
          } else if (type === 'error') {
            const { message } = payload || {};
            const el = document.createElement('div');
            el.style.background = '#FEE2E2';
            el.style.color = '#991B1B';
            el.style.padding = '12px 14px';
            el.style.borderRadius = '10px';
            el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
            el.textContent = message || 'SapienWrite: Something went wrong.';
            wrap.appendChild(el);
            root.appendChild(wrap);
          }
        } catch (e) { /* no-op */ }
      },
      args: [type, payload]
    });
    return true;
  } catch (e) {
    console.warn('[Background] injectOverlay failed:', e?.message);
    return false;
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
  // Check if reconnect is blocked after logout
  const { block_reconnect_until } = await chrome.storage.local.get(['block_reconnect_until']);
  if (block_reconnect_until && Date.now() < block_reconnect_until) {
    console.log('[Background] Reconnect blocked after recent logout');
    return { success: false, reason: 'blocked_after_logout' };
  }
  
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
async function requestSessionFromWebApp(timeoutMs = 2000, isReconnectFlow = false) {
  // Check if reconnect is blocked after logout
  const { block_reconnect_until } = await chrome.storage.local.get(['block_reconnect_until']);
  if (block_reconnect_until && Date.now() < block_reconnect_until) {
    console.log('[Background] Reconnect blocked after recent logout');
    return { success: false, reason: 'blocked_after_logout' };
  }
  
  return new Promise((resolve) => {
    chrome.tabs.query({}, async (tabs) => {
      const sapienWriteTabs = tabs.filter(tab => 
        tab.url && (
          tab.url.includes('sapienwrite.com') ||
          tab.url.includes('lovableproject.com') ||
          tab.url.includes('localhost:5173')
        )
      );
      
      if (sapienWriteTabs.length === 0 && !isReconnectFlow) {
        // If reconnecting, don't fail immediately - user might be opening the auth page
        resolve({ success: false, reason: 'no_tabs' });
        return;
      }
      
      // If reconnecting, keep checking for new tabs every 2 seconds
      let checkInterval;
      if (isReconnectFlow) {
        checkInterval = setInterval(() => {
          chrome.tabs.query({}, (tabs) => {
            const authTabs = tabs.filter(tab => 
              tab.url && tab.url.includes('sapienwrite.com/extension-auth')
            );
            authTabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, {
                type: 'SAPIENWRITE_REQUEST_SESSION'
              }).catch(() => {});
            });
          });
        }, 2000);
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
          if (checkInterval) clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve({ success: true });
        }
      };
      
      chrome.runtime.onMessage.addListener(sessionListener);
      
      const timeout = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(sessionListener);
        if (checkInterval) clearInterval(checkInterval);
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

// Periodic session health check - refresh tokens before they expire
// Runs every 15 minutes to keep sessions alive
chrome.alarms.create('session-health-check', { periodInMinutes: 15 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'session-health-check') {
    console.log('[Background] Periodic session health check...');
    const result = await ensureValidSession();
    if (result.success) {
      console.log('[Background] ✅ Session healthy');
    } else {
      console.log('[Background] ⚠️ Session needs reconnect:', result.reason);
    }
  }
});

// Try to sync session on startup
(async () => {
  const session = await getSession();
  if (!session) {
    console.log('[Background] No session on startup, requesting from web app...');
    await requestSessionFromWebApp(2000);
  }
})();

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

// Handle context menu clicks - INSTANT spinner + auto-run
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
  
  console.log(`[Background] ========= TONE CLICKED: ${tone} =========`);
  console.log('[Background] Tab:', tab.id, 'Frame:', info.frameId);
  
  
  // STEP 1: ENSURE VALID SESSION (with auto-refresh)
  console.log('[Background] Ensuring valid session...');
  const sessionResult = await ensureValidSession();

  if (!sessionResult.success) {
    console.log('[Background] Session validation failed:', sessionResult.reason);
    
    // If we have a refresh_token but refresh failed, try web app sync first
    if (sessionResult.reason === 'refresh_failed') {
      console.log('[Background] Attempting web app session sync...');
      const webAppSync = await requestSessionFromWebApp(3000); // Give it 3 seconds
      
      if (webAppSync.success) {
        console.log('[Background] ✅ Web app sync successful, continuing...');
        // Proceed to humanize
      } else {
        // Both refresh AND web app failed - show dialog
        console.log('[Background] All auto-recovery attempts failed - showing reconnect dialog');
        await injectOverlay(tab.id, 'reconnect', {
          message: 'Your session expired. Click "Reconnect" to sign in again.'
        }, info.frameId);
        return; // Stop here
      }
    } else {
      // No refresh_token at all - show dialog immediately
      console.log('[Background] No credentials stored - showing reconnect dialog');
      await injectOverlay(tab.id, 'reconnect', {
        message: 'Please sign in to use SapienWrite.'
      }, info.frameId);
      return;
    }
  }

  console.log('[Background] ✅ Session validated, continuing with humanize...');
  
  // STEP 1: Get selected text (ALWAYS try structured extraction first)
  let selectedText = null;
  
  // Try to get structured text from content script first
  console.log('[Background] Requesting structured text from content...');
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getLastSelection' }, Number.isInteger(info.frameId) ? { frameId: info.frameId } : undefined);
    if (response?.text) {
      selectedText = response.text;
      console.log('[Background] Got structured text from content:', selectedText.substring(0, 100));
    }
  } catch (e) {
    console.warn('[Background] Content script not ready, falling back to info.selectionText');
  }
  
  // Fallback to Chrome's plain API
  if (!selectedText || !selectedText.trim()) {
    selectedText = info.selectionText;
    console.log('[Background] Using info.selectionText fallback');
  }
  
  if (!selectedText || !selectedText.trim()) {
    console.log('[Background] ❌ No text selected, aborting');
    await safeSendMessage(tab.id, {
      action: 'showError',
      message: 'No text selected. Please select text and try again.'
    }, Number.isInteger(info.frameId) ? { frameId: info.frameId } : {});
    return;
  }
  
  console.log('[Background] ✅ Selected text:', selectedText.substring(0, 100));
  
  // STEP 2: Show spinner INSTANTLY
  console.log('[Background] 🎬 Showing spinner NOW');
  await safeSendMessage(tab.id, { action: 'showProcessing' }, Number.isInteger(info.frameId) ? { frameId: info.frameId } : {});
  const ack = await waitForProcessingAck(tab.id, 500);
  if (!ack) {
    console.log('[Background] No processingAck received, injecting fallback spinner');
    await injectOverlay(tab.id, 'processing', {}, info.frameId);
  }
  // STEP 3: Call edge function immediately (backend handles ALL validation)
  console.log('[Background] 🚀 Calling edge function');
  const mappedTone = mapToneToSupported(tone);
  await handleHumanizeRequest(
    selectedText,
    mappedTone,
    'strong',
    true,
    tab.id,
    info.frameId
  );
  
  console.log('[Background] ========= TONE HANDLER COMPLETE =========');
});

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Message received:', message.action);
  
  if (message.action === 'humanizeWithTone') {
    (async () => {
      try {
        // Map legacy tone names to supported tones
        const mappedTone = mapToneToSupported(message.tone);
        const intensity = message.toneIntensity || 'strong';
        const forceRewrite = message.forceRewrite !== undefined ? message.forceRewrite : true;
        console.log('[Background] ✅ TONE SELECTED:', message.tone, mappedTone !== message.tone ? `→ ${mappedTone}` : '', '| intensity:', intensity, '| force_rewrite:', forceRewrite);
        
        // Show processing spinner
        await safeSendMessage(sender.tab.id, { action: 'showProcessing' }, { frameId: sender.frameId });
        
        await handleHumanizeRequest(message.text, mappedTone, intensity, forceRewrite, sender.tab?.id, sender.frameId);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
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
  
  if (message.action === 'processingAck') {
    const tabId = sender.tab?.id;
    if (tabId && processingAckWaiters.has(tabId)) {
      try { processingAckWaiters.get(tabId)(); } catch {}
    }
    console.log('[Background] ✅ Processing UI rendered successfully in tab', tabId);
    return false;
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
  
  if (message.action === 'waitingForReconnect') {
    console.log('[Background] User clicked Reconnect, starting extended wait...');
    // Store flag that we're waiting for reconnect
    chrome.storage.local.set({ reconnecting: true, reconnect_started_at: Date.now() });
    sendResponse({ acknowledged: true });
    return true;
  }
  
  if (message.action === 'checkReconnectStatus') {
    chrome.storage.local.get(['reconnecting', 'reconnect_started_at'], async (data) => {
      if (!data.reconnecting) {
        sendResponse({ success: false, reason: 'not_reconnecting' });
        return;
      }
      
      // Check if session is now available
      const session = await getSession();
      if (session) {
        console.log('[Background] Reconnect successful!');
        await chrome.storage.local.remove(['reconnecting', 'reconnect_started_at']);
        sendResponse({ success: true });
      } else {
        // Still waiting or failed
        const elapsed = Date.now() - (data.reconnect_started_at || 0);
        if (elapsed > 30000) {
          // Timeout after 30 seconds
          await chrome.storage.local.remove(['reconnecting', 'reconnect_started_at']);
          sendResponse({ success: false, reason: 'timeout' });
        } else {
          sendResponse({ success: false, reason: 'still_waiting' });
        }
      }
    });
    return true;
  }
  
  if (message.action === 'signOut') {
    console.log('[Background] Sign out requested');
    signOut()
      .then(async () => {
        // Clear session cache
        sessionCache.session = null;
        sessionCache.timestamp = 0;
        
        // Block reconnect for 60 seconds to prevent auto-reconnect from web
        const blockUntil = Date.now() + 60000;
        await chrome.storage.local.set({ block_reconnect_until: blockUntil });
        console.log('[Background] Reconnect blocked for 60 seconds after logout');
        
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
    console.log(`[Background] 📤 Calling edge function (tone: "${tone}" | intensity: "${toneIntensity}")`);
    
    // Get session
    const session = await getSession();
    if (!session) {
      throw new Error('Session expired. Please reconnect the extension.');
    }
    
    // Call edge function - it will enforce all limits
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
        speed_mode: true
      }),
      signal: controller.signal
    });
    
    const result = await response.json();
    
    // Handle upgrade/limit errors from backend
    if (!response.ok || result.upgrade_required) {
      console.log('[Background] Backend requires upgrade:', result);
      await safeSendMessage(tabId, {
        action: 'showUpgradeRequired',
        currentPlan: result.current_plan || 'free'
      }, Number.isInteger(frameId) ? { frameId } : {});
      return;
    }
    
    if (result.error) {
      throw new Error(result.error);
    }
    
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
    
    // SANITIZE humanizedText before sending (belt-and-suspenders)
    const cleanText = humanizedText.replace(/\[?\s*PARAGRAPH[_\s-]?\d+\s*\]?/gi, '').replace(/\n{3,}/g, '\n\n').trim();
    console.log('[Background] Sanitized text length:', cleanText.length);
    
    const resultMessage = {
      action: 'showResult',
      originalText: text,
      humanizedText: cleanText,
      tone: tone,
      toneIntensity: toneIntensity,
      warning: warning
    };
    
    console.log('[Background] Sending message:', resultMessage);
    let delivered = await safeSendMessage(tabId, resultMessage, Number.isInteger(frameId) ? { frameId } : {});
    if (!delivered) {
      await new Promise(r => setTimeout(r, 200));
      delivered = await safeSendMessage(tabId, resultMessage, Number.isInteger(frameId) ? { frameId } : {});
    }
    if (!delivered) {
      await new Promise(r => setTimeout(r, 200));
      delivered = await safeSendMessage(tabId, resultMessage, Number.isInteger(frameId) ? { frameId } : {});
    }
    if (!delivered) {
      await injectOverlay(tabId, 'result', { originalText: text, humanizedText: humanizedText }, frameId);
    }
    console.log('[Background] Message sent successfully');
    
    // Broadcast balance update to popup for real-time sync
    chrome.runtime.sendMessage({
      action: 'balanceUpdated',
      wordsUsed: wordCount
    }).catch(err => console.log('[Background] Could not notify popup:', err));
    
  } catch (error) {
    console.error('[Background] Error humanizing:', error);
    
    if (error.name === 'AbortError') {
      {
        const delivered = await safeSendMessage(tabId, {
          action: 'showError',
          message: 'Request canceled or timed out. Please try again.'
        }, Number.isInteger(frameId) ? { frameId } : {});
        if (!delivered) {
          await injectOverlay(tabId, 'error', { message: 'Request canceled or timed out. Please try again.' }, frameId);
        }
      }
    } else {
      {
        const delivered = await safeSendMessage(tabId, {
          action: 'showError',
          message: error.message || 'Failed to humanize text'
        }, Number.isInteger(frameId) ? { frameId } : {});
        if (!delivered) {
          await injectOverlay(tabId, 'error', { message: error.message || 'Failed to humanize text' }, frameId);
        }
      }
    }
  } finally {
    clearTimeout(timeout);
    inFlight.delete(key);
  }
}
