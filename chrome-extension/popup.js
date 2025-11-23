// Popup Script - Clean initialization with guaranteed UI

// Use extension limits from config.js (loaded globally via popup.html)
const EXT_LIMITS = (typeof EXTENSION_LIMITS !== 'undefined') 
  ? EXTENSION_LIMITS 
  : { free: 500, extension_only: 5000, ultra: 30000, master: 30000, pro: 0, wordsmith: 0 };

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
      // Handle refresh_token_already_used error
      if (subError.message?.includes('refresh_token_already_used') || 
          subError.message?.includes('Invalid Refresh Token')) {
        console.log('[Popup] Token error - requesting fresh session');
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

// Fetch word balance
async function fetchWordBalance() {
  // Clear any cached balance on popup open
  console.log('[Popup] Fetching fresh word balance...');
  
  try {
    const session = await getSession();
    
    // Validate session before using it
    if (!session || !session.user) {
      console.error('[Popup] No valid session for word balance');
      await clearSession();
      showLoginView();
      return;
    }
    
    const plan = subscriptionData.plan || 'free';
    const extensionLimit = EXT_LIMITS[plan] || 500;
    
    // Get current month in YYYY-MM format using UTC to avoid timezone issues
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const currentMonth = `${year}-${month}`;
    
    console.log('[Popup] Fetching usage for month:', currentMonth);
    console.log('[Popup] Current date (UTC):', now.toISOString());
    console.log('[Popup] Current date (Local):', now.toLocaleString());
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/usage_tracking?user_id=eq.${session.user.id}&month_year=eq.${currentMonth}&select=words_used,extension_words_used`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session.access_token}`
        }
      }
    );
    
    if (!response.ok) throw new Error('Failed to fetch usage');
    
    const data = await response.json();
    console.log('[Popup] Usage data received:', data);
    const usageData = data[0] || { words_used: 0, extension_words_used: 0 };
    console.log('[Popup] Parsed usage:', usageData);
    
    // Calculate balance based on plan
    let totalLimit = extensionLimit;
    if (plan === 'free') {
      const totalUsed = (usageData.words_used || 0) + (usageData.extension_words_used || 0);
      wordBalance = Math.max(0, extensionLimit - totalUsed);
    } else if (plan === 'extension_only') {
      const extensionUsed = usageData.extension_words_used || 0;
      wordBalance = Math.max(0, extensionLimit - extensionUsed);
    } else if (plan === 'ultra' || plan === 'master') {
      const totalUsed = (usageData.words_used || 0) + (usageData.extension_words_used || 0);
      wordBalance = Math.max(0, 40000 - totalUsed);
      totalLimit = 40000; // Shared 40k pool for web + extension
    } else {
      wordBalance = 0;
    }
    
    updateWordBalanceUI(wordBalance, totalLimit);
    
    // Store last fetch timestamp and balance for cache management
    await localSet({ 
      lastBalanceFetch: Date.now(),
      lastKnownBalance: wordBalance 
    });
    console.log('[Popup] Word balance updated:', wordBalance);
    
    if (wordBalance <= 0 && plan !== 'pro' && plan !== 'wordsmith') {
      document.getElementById('upgrade-prompt').classList.remove('hidden');
    }
  } catch (error) {
    console.error('[Popup] Error fetching word balance:', error);
    document.getElementById('word-count').textContent = 'Error';
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

document.getElementById('refresh-connection-button')?.addEventListener('click', async () => {
  console.log('[Popup] Manual refresh triggered');
  const refreshBtn = document.getElementById('refresh-connection-button');
  const originalText = refreshBtn.textContent;
  
  try {
    // Show loading state
    refreshBtn.textContent = 'Checking...';
    refreshBtn.disabled = true;
    
    // Request session from any open SapienWrite tabs
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'requestSessionFromWebApp' }, resolve);
    });
    
    console.log('[Popup] Request session response:', response);
    
    if (!response.success || response.tabsFound === 0) {
      showError('No SapienWrite tabs open. Please log in at sapienwrite.com first.');
      refreshBtn.textContent = originalText;
      refreshBtn.disabled = false;
      await populateDiagnostics();
      return;
    }
    
    // Wait for session to be stored (give web app time to respond)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if authenticated now
    const authenticated = await isAuthenticated();
    if (authenticated) {
      await loadUserData();
      await populateDiagnostics();
    } else {
      showError('Not logged in. Please log in at sapienwrite.com and try again.');
      showLoginView();
      await populateDiagnostics();
    }
    
    refreshBtn.textContent = originalText;
    refreshBtn.disabled = false;
  } catch (e) {
    console.error('[Popup] Refresh failed:', e);
    showError('Failed to refresh. Please log in at sapienwrite.com/extension-auth');
    refreshBtn.textContent = originalText;
    refreshBtn.disabled = false;
  }
});

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

document.getElementById('upgrade-extension-button')?.addEventListener('click', () => {
  chrome.tabs.create({ url: `https://sapienwrite.com/auth?from=extension&redirect=pricing&plan=extension` });
});

document.getElementById('upgrade-ultra-button')?.addEventListener('click', () => {
  chrome.tabs.create({ url: `https://sapienwrite.com/auth?from=extension&redirect=pricing&plan=ultra` });
});

document.getElementById('logout-link')?.addEventListener('click', async (e) => {
  e.preventDefault();
  console.log('[Popup] Logout clicked');
  // Complete sign out - clears remember_me flag and blocks reconnect
  await chrome.runtime.sendMessage({ action: 'signOut' });
  // Don't call requestSessionFromWebApp - let the logout complete
  showLoginView();
});

// Wire up manual refresh button
document.getElementById('refresh-balance-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('refresh-balance-btn');
  if (!btn) return;
  
  console.log('[Popup] Manual refresh triggered');
  btn.classList.add('spinning');
  btn.disabled = true;
  
  try {
    await fetchWordBalance();
  } finally {
    btn.classList.remove('spinning');
    btn.disabled = false;
  }
});

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
