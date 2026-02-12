// Popup Script - Clean initialization with guaranteed UI

// Use extension limits from config.js (loaded globally via popup.html)
const EXT_LIMITS = (typeof EXTENSION_LIMITS !== 'undefined') 
  ? EXTENSION_LIMITS 
  : { free: 1000, extension_only: 5000, ultra: 20000, master: 30000 };

let subscriptionData = null;
let wordBalance = 0;

// Simple storage helpers
function localGet(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (items) => resolve(items || {}));
    } catch (e) {
      console.error('[Popup] localGet error:', e);
      resolve({});
    }
  });
}

function localSet(items) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(items, () => resolve());
    } catch (e) {
      console.error('[Popup] localSet error:', e);
      resolve();
    }
  });
}

// Diagnostics
function formatTimestamp(ts) {
  if (!ts) return '—';
  const age = Date.now() - ts;
  const secs = Math.round(age / 1000);
  try {
    return `${new Date(ts).toLocaleString()} (${secs}s ago)`;
  } catch {
    return `${ts} (${secs}s ago)`;
  }
}

async function populateDiagnostics() {
  try {
    const data = await localGet([
      'access_token',
      'refresh_token',
      'session_stored_at',
      'user_email'
    ]);

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('diag-connected', data.access_token ? 'Yes' : 'No');
    setText('diag-last-connected', formatTimestamp(data.session_stored_at));
    setText('diag-at', data.access_token ? 'present' : 'missing');
    setText('diag-rt', data.refresh_token ? 'present' : 'missing');
    setText('diag-storage-type', 'local (reliable)');
    setText('diag-user-email', data.user_email || 'N/A');
  } catch (e) {
    console.warn('[Popup] populateDiagnostics error', e);
  }
}

async function initDiagnostics() {
  try {
    const manifest = chrome.runtime.getManifest?.();
    const versionEl = document.getElementById('version-label');
    if (versionEl && manifest?.version) versionEl.textContent = `v${manifest.version}`;

    const toggle = document.getElementById('toggle-diagnostics');
    const diag = document.getElementById('diagnostics');
    if (toggle && diag) {
      toggle.addEventListener('click', async (e) => {
        e.preventDefault();
        diag.classList.toggle('hidden');
        await populateDiagnostics();
      });
    }

    const clearBtn = document.getElementById('clear-storage-button');
    if (clearBtn) {
      clearBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (confirm('Clear all extension storage? You will need to reconnect.')) {
          try {
            await chrome.storage.local.clear();
            console.log('[Popup] Storage cleared');
            showLoginView();
            await populateDiagnostics();
          } catch (e) {
            console.error('[Popup] Failed to clear storage:', e);
          }
        }
      });
    }

    await populateDiagnostics();
  } catch (e) {
    console.warn('[Popup] initDiagnostics error', e);
  }
}

// GUARANTEED UI - Never hangs
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initializing...');
  
  // Display version from manifest
  try {
    const manifest = chrome.runtime.getManifest();
    const versionLabel = document.getElementById('version-label');
    if (versionLabel && manifest?.version) {
      versionLabel.textContent = `v${manifest.version}`;
      console.log('[Popup] Version:', manifest.version);
    }
  } catch (e) {
    console.warn('[Popup] Could not set version:', e);
  }
  
  // HARD DEADLINE: Show UI within 1 second no matter what
  const uiDeadline = setTimeout(() => {
    console.warn('[Popup] UI deadline reached - forcing login view');
    showLoginView();
  }, 1000);

  // Initialize diagnostics
  try {
    await initDiagnostics();
  } catch (e) {
    console.warn('[Popup] Diagnostics init failed', e);
  }
  
  try {
    // Check authentication with timeout
    const authCheckPromise = isAuthenticated();
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(false), 800));
    
    const authenticated = await Promise.race([authCheckPromise, timeoutPromise]);
    console.log('[Popup] Authentication check:', authenticated);
    
    clearTimeout(uiDeadline);
    
    if (!authenticated) {
      console.log('[Popup] Not authenticated - showing login view');
      showLoginView();
    } else {
      console.log('[Popup] Authenticated - loading user data');
      showMainView();
      await loadUserData();
    }
  } catch (error) {
    console.error('[Popup] Initialization error:', error);
    clearTimeout(uiDeadline);
    showLoginView();
  }
});

// View management
function showLoginView() {
  document.getElementById('loading-view')?.classList.add('hidden');
  document.getElementById('login-view')?.classList.remove('hidden');
  document.getElementById('main-view')?.classList.add('hidden');
}

function showMainView() {
  document.getElementById('loading-view')?.classList.add('hidden');
  document.getElementById('login-view')?.classList.add('hidden');
  document.getElementById('main-view')?.classList.remove('hidden');
}

function showError(message) {
  const errorEl = document.getElementById('error-message');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  setTimeout(() => errorEl.style.display = 'none', 5000);
}

// Load user data
async function loadUserData() {
  try {
    // Check for reconnect state
    const storageData = await localGet(['remember_me', 'needs_reconnect', 'user_email']);
    
    if (storageData.needs_reconnect && storageData.remember_me) {
      console.log('[Popup] Needs reconnect - showing reconnect UI');
      showReconnectUI(storageData.user_email);
      return;
    }
    
    const session = await getSession();
    
    if (!session) {
      console.log('[Popup] No session found - requesting from web app');
      // Try to get session from web app
      await requestSessionFromWebApp();
      showLoginView();
      return;
    }
    
    // Validate session has required fields
    if (!session.user || !session.access_token) {
      console.log('[Popup] Invalid session - missing fields');
      await clearSession();
      await requestSessionFromWebApp();
      showLoginView();
      return;
    }
    
    // Proactive refresh if token expires soon (< 10 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && (session.expires_at - now) < 600) {
      console.log('[Popup] Token expires soon, refreshing proactively...');
      chrome.runtime.sendMessage({ action: 'ensureFreshSession' }).catch(() => {});
    }
    
    document.getElementById('user-email').textContent = session.user.email;
    
    try {
      subscriptionData = await checkSubscription();
      console.log('[Popup] Subscription:', subscriptionData);
    } catch (subError) {
      // Handle account deleted or invalid token errors
      if (subError.message?.includes('refresh_token_already_used') || 
          subError.message?.includes('Invalid Refresh Token') ||
          subError.message?.includes('Session expired or account deleted')) {
        console.log('[Popup] Auth error - session invalid or account deleted');
        await clearSession();
        await requestSessionFromWebApp();
        showLoginView();
        return;
      }
      throw subError;
    }
    
    const plan = subscriptionData.plan || 'free';
    updatePlanBadge(plan);
    showUpgradeRequiredCard(plan);
    
    await fetchWordBalance();
    
    showMainView();
  } catch (error) {
    console.error('[Popup] Error loading user data:', error);
    showError('Failed to load user data. Please try again.');
    showLoginView();
  }
}

// Show upgrade card for Free/Pro users
function showUpgradeRequiredCard(plan) {
  const upgradeCard = document.getElementById('upgrade-required-card');
  
  if (plan === 'free' || plan === 'pro' || plan === 'wordsmith') {
    upgradeCard.classList.remove('hidden');
    
    const planNames = { free: 'Free', pro: 'Pro', wordsmith: 'Pro' };
    document.getElementById('current-plan-name').textContent = planNames[plan] || plan;
  } else {
    upgradeCard.classList.add('hidden');
  }
}

// Update plan badge
function updatePlanBadge(plan) {
  const badge = document.getElementById('plan-badge');
  const planNames = {
    free: 'Free',
    extension_only: 'Extension',
    pro: 'Pro',
    wordsmith: 'Pro',
    ultra: 'Ultra',
    master: 'Ultra'
  };
  
  const planClasses = {
    free: 'status-free',
    extension_only: 'status-extension',
    pro: 'status-pro',
    wordsmith: 'status-pro',
    ultra: 'status-ultra',
    master: 'status-ultra'
  };
  
  badge.textContent = planNames[plan] || 'Free';
  badge.className = `status-badge ${planClasses[plan] || 'status-free'}`;
}

// Fetch word balance using canonical usage-summary function
async function fetchWordBalance() {
  console.log('[Popup] ========= FETCHING FRESH BALANCE =========');
  console.log('[Popup] Timestamp:', new Date().toISOString());
  
  try {
    const session = await getSession();
    
    if (!session || !session.user) {
      console.error('[Popup] No valid session for word balance');
      await clearSession();
      showLoginView();
      return;
    }
    
    console.log('[Popup] Calling usage-summary API...');
    // Call the canonical usage-summary edge function
    const data = await callSupabaseFunction('usage-summary', { source: 'extension' });
    
    console.log('[Popup] ========= RAW API RESPONSE =========');
    console.log('[Popup] Full response:', JSON.stringify(data, null, 2));
    console.log('[Popup] extension_remaining:', data.extension_remaining);
    console.log('[Popup] remaining_shared:', data.remaining_shared);
    console.log('[Popup] plan_limit:', data.plan_limit);
    console.log('[Popup] extension_limit:', data.extension_limit);
    console.log('[Popup] plan:', data.plan);
    console.log('[Popup] =======================================');
    
    const remaining = data.extension_remaining || data.remaining_shared || 0;
    const limit = data.extension_limit || data.plan_limit || 0;
    
    wordBalance = remaining;
    updateWordBalanceUI(remaining, limit);
    
    // Store diagnostic info for troubleshooting
    await localSet({ 
      lastBalanceFetch: Date.now(),
      lastKnownBalance: remaining,
      last_usage_summary: {
        timestamp: new Date().toISOString(),
        plan: data.plan,
        plan_limit: data.plan_limit,
        web_used: data.web_used,
        extension_used: data.extension_used,
        shared_used: data.shared_used,
        remaining_shared: data.remaining_shared,
        extension_limit: data.extension_limit,
        extension_remaining: data.extension_remaining,
        extra_words: data.extra_words,
        month_year: data.month_year
      }
    });
    
    console.log('[Popup] Word balance updated:', remaining, '/', limit);
    
    const plan = data.plan || 'free';
    if (wordBalance <= 0 && plan !== 'pro' && plan !== 'wordsmith') {
      document.getElementById('upgrade-prompt').classList.remove('hidden');
    }
  } catch (error) {
    console.error('[Popup] Error fetching word balance:', error);
    
    // Handle account deleted error
    if (error.message?.includes('Session expired or account deleted')) {
      console.log('[Popup] Account deleted - showing login view');
      await clearSession();
      showLoginView();
      return;
    }
    
    document.getElementById('word-count').textContent = 'Error';
    showError('Failed to fetch word balance. Please try refreshing.');
  }
}

// Update word balance UI
function updateWordBalanceUI(remaining, total) {
  document.getElementById('word-count').textContent = remaining.toLocaleString();
  const percentage = Math.max(0, Math.min(100, (remaining / total) * 100));
  document.getElementById('progress-fill').style.width = `${percentage}%`;
}

// Event listeners
document.getElementById('login-button')?.addEventListener('click', async () => {
  await localSet({ handshake_opened_at: Date.now() });
  chrome.tabs.create({ url: `${LOGIN_URL}?from=extension` });
});

document.getElementById('connect-extension-button')?.addEventListener('click', async () => {
  await localSet({ handshake_opened_at: Date.now() });
  chrome.tabs.create({ url: 'https://sapienwrite.com/extension-auth?from=extension' });
});

// Refresh connection button removed - auto-refresh on popup open is sufficient

document.getElementById('signup-link')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await localSet({ handshake_opened_at: Date.now() });
  chrome.tabs.create({ url: LOGIN_URL });
});

document.getElementById('dashboard-button')?.addEventListener('click', () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

document.getElementById('manage-subscription-button')?.addEventListener('click', async () => {
  try {
    const data = await callSupabaseFunction('customer-portal', {});
    chrome.tabs.create({ url: data.url });
  } catch (error) {
    console.error('[Popup] Error opening portal:', error);
    showError('Failed to open subscription management.');
  }
});

document.getElementById('upgrade-button')?.addEventListener('click', () => {
  chrome.tabs.create({ url: `https://sapienwrite.com/pricing?from=extension` });
});

document.getElementById('upgrade-ultra-button')?.addEventListener('click', () => {
  chrome.tabs.create({ url: `https://sapienwrite.com/auth?from=extension&redirect=pricing&plan=ultra` });
});

document.getElementById('logout-link')?.addEventListener('click', async (e) => {
  e.preventDefault();
  console.log('[Popup] User requested logout - performing aggressive cleanup');
  
  const link = e.target;
  const originalText = link.textContent;
  link.textContent = 'Signing out...';
  link.style.opacity = '0.5';
  link.style.pointerEvents = 'none';
  
  try {
    // Clear ALL storage immediately and aggressively
    console.log('[Popup] Clearing all local and session storage...');
    await Promise.all([
      chrome.storage.local.clear(),
      chrome.storage.session.clear()
    ]);
    
    // Send logout signal to background script
    chrome.runtime.sendMessage({ action: 'signOut' }).catch(err => {
      console.warn('[Popup] Background signOut failed (non-critical):', err);
    });
    
    console.log('[Popup] Logout complete - all storage cleared');
    
    // Force show login view immediately
    showLoginView();
    
  } catch (error) {
    console.error('[Popup] Logout error:', error);
    // Even if there's an error, show login view and clear local state
    showLoginView();
    showError('Logged out locally. Please refresh if needed.');
  } finally {
    // Reset link state
    link.textContent = originalText;
    link.style.opacity = '1';
    link.style.pointerEvents = 'auto';
  }
});

// Cache clear button removed - auto-refresh on popup open is sufficient

// Refresh balance button removed - auto-refresh on popup open is sufficient

// Force refresh button removed - auto-refresh on popup open is sufficient

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.access_token) {
    console.log('[Popup] Session updated - refreshing');
    loadUserData().catch(() => showLoginView());
  }
});

// Listen for balance updates from background script (real-time sync)
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'balanceUpdated') {
    console.log('[Popup] Balance updated from background, refreshing...', message.wordsUsed);
    fetchWordBalance(); // Refresh balance immediately
  }
});

// Helper to request session from web app
async function requestSessionFromWebApp() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'requestSessionFromWebApp' }, (response) => {
      console.log('[Popup] Request session response:', response);
      
      if (!response?.success || response.tabsFound === 0) {
        console.log('[Popup] No SapienWrite tabs open');
        resolve(false);
        return;
      }
      
      // Wait 2 seconds for session to arrive
      const listener = (message) => {
        if (message.action === 'sessionStored') {
          chrome.runtime.onMessage.removeListener(listener);
          clearTimeout(timeout);
          console.log('[Popup] Session received');
          resolve(true);
        }
      };
      
      chrome.runtime.onMessage.addListener(listener);
      
      const timeout = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(listener);
        console.log('[Popup] Session timeout');
        resolve(false);
      }, 2000);
    });
  });
}

// Show reconnect UI when session needs reconnection
function showReconnectUI(email) {
  document.getElementById('loading-view')?.classList.add('hidden');
  document.getElementById('login-view')?.classList.add('hidden');
  const mainView = document.getElementById('main-view');
  mainView?.classList.remove('hidden');
  
  const statusText = document.getElementById('status-text');
  const planText = document.getElementById('plan-text');
  const statsContainer = document.querySelector('.stats-card');
  const actionsContainer = document.querySelector('.actions');
  
  if (statusText) statusText.textContent = 'Session expired';
  if (planText) planText.textContent = email ? `Last login: ${email}` : 'Please reconnect';
  
  // Hide stats
  if (statsContainer) statsContainer.style.display = 'none';
  
  // Clear and rebuild actions
  if (actionsContainer) {
    actionsContainer.innerHTML = '';
    
    // Reconnect button
    const reconnectBtn = document.createElement('button');
    reconnectBtn.className = 'action-button primary';
    reconnectBtn.textContent = email ? `Reconnect as ${email}` : 'Reconnect';
    reconnectBtn.onclick = async () => {
      reconnectBtn.textContent = 'Connecting...';
      reconnectBtn.disabled = true;
      
      const result = await chrome.runtime.sendMessage({ action: 'ensureFreshSession' });
      
      if (result?.success) {
        setTimeout(() => loadUserData(), 1000);
      } else {
        reconnectBtn.textContent = 'Connection failed - Try again';
        reconnectBtn.disabled = false;
        
        // Suggest opening the web app
        const helpText = document.createElement('p');
        helpText.style.cssText = 'margin-top: 8px; font-size: 12px; color: #666;';
        helpText.textContent = 'Please open SapienWrite.com to reconnect';
        actionsContainer.appendChild(helpText);
      }
    };
    
    // Sign out completely button
    const signOutBtn = document.createElement('button');
    signOutBtn.className = 'action-button secondary';
    signOutBtn.textContent = 'Sign out completely';
    signOutBtn.style.cssText = 'margin-top: 8px; background: transparent; border: 1px solid #ddd;';
    signOutBtn.onclick = async () => {
      await chrome.runtime.sendMessage({ action: 'signOut' });
      showLoginView();
    };
    
    actionsContainer.appendChild(reconnectBtn);
    actionsContainer.appendChild(signOutBtn);
  }
}


// Listen for messages from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'sessionStored' || message.action === 'subscriptionUpdated') {
    console.log('[Popup] Received update notification');
    loadUserData().catch(() => showLoginView());
  }
});
