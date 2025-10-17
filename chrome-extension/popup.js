// Popup Script - Handles UI interactions

// Extension word limits (must match config.js)
const EXTENSION_LIMITS = {
  free: 750,           // Shared pool with web
  extension_only: 5000, // Extension only
  ultra: 5000,          // Bonus extension words
  master: 5000,         // Bonus extension words (legacy)
  pro: 0,              // No extension access
  wordsmith: 0         // No extension access (legacy)
};

let subscriptionData = null;
let wordBalance = 0;

// chrome.storage.local promise wrappers
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

// chrome.storage.sync promise wrapper
function syncGet(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(keys, (items) => resolve(items || {}));
    } catch (e) {
      console.error('[Popup] syncGet error:', e);
      resolve({});
    }
  });
}

// Diagnostics helpers
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
    const { connected = false, handshake_opened_at = 0, last_connected_at = 0 } = await localGet([
      'connected',
      'handshake_opened_at',
      'last_connected_at'
    ]);
    const sync = await syncGet(['access_token', 'refresh_token']);

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('diag-connected', String(!!connected));
    setText('diag-last-connected', formatTimestamp(last_connected_at));
    setText('diag-handshake', formatTimestamp(handshake_opened_at));
    setText('diag-at', sync.access_token ? 'present' : 'missing');
    setText('diag-rt', sync.refresh_token ? 'present' : 'missing');
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

    await populateDiagnostics();
  } catch (e) {
    console.warn('[Popup] initDiagnostics error', e);
  }
}
// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initializing...');
  
  // Safety UI fallback: switch to login after 300ms if nothing else rendered
  const uiFallbackId = setTimeout(() => {
    try { showLoginView(); } catch (e) { console.warn('[Popup] UI fallback error', e); }
  }, 300);

  // Initialize diagnostics panel/version label
  try { await initDiagnostics(); } catch (e) { console.warn('[Popup] Diagnostics init failed', e); }
  
  try {
    const authenticated = await isAuthenticated();
    console.log('[Popup] Authentication check result:', authenticated);
    
    clearTimeout(uiFallbackId);
    
    if (!authenticated) {
      console.log('[Popup] Not authenticated - showing login view');
      showLoginView();
    } else {
      console.log('[Popup] Authenticated - loading user data');
      await loadUserData();
    }
  } catch (error) {
    console.error('[Popup] Error during initialization:', error);
    clearTimeout(uiFallbackId);
    showLoginView();
  }
});

// Show login view
function showLoginView() {
  const loading = document.getElementById('loading-view');
  const login = document.getElementById('login-view');
  const main = document.getElementById('main-view');
  loading?.classList.add('hidden');
  login?.classList.remove('hidden');
  main?.classList.add('hidden');
}

// Show main view
function showMainView() {
  const loading = document.getElementById('loading-view');
  const login = document.getElementById('login-view');
  const main = document.getElementById('main-view');
  loading?.classList.add('hidden');
  login?.classList.add('hidden');
  main?.classList.remove('hidden');
}

// Show error message
function showError(message) {
  const errorEl = document.getElementById('error-message');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  
  setTimeout(() => {
    errorEl.style.display = 'none';
  }, 5000);
}

// Load user data
async function loadUserData() {
  try {
    const session = await getSession();
    
    // Update UI with user email
    document.getElementById('user-email').textContent = session.user.email;
    
    // Check subscription
    subscriptionData = await checkSubscription();
    console.log('[Popup] Subscription data:', subscriptionData);
    
    // Update plan badge
    updatePlanBadge(subscriptionData.plan || 'free');
    
    // Check if user has extension access
    const plan = subscriptionData.plan || 'free';
    showUpgradeRequiredCard(plan);
    
    // Fetch word balance
    await fetchWordBalance();
    
    showMainView();
  } catch (error) {
    console.error('[Popup] Error loading user data:', error);
    showError('Failed to load user data. Please try again.');
    showLoginView();
  }
}

// Show upgrade required card for Free/Pro users
function showUpgradeRequiredCard(plan) {
  const upgradeCard = document.getElementById('upgrade-required-card');
  const quickHumanize = document.querySelector('.card:has(#quick-text)');
  const wordBalanceCard = quickHumanize?.previousElementSibling;
  
  if (plan === 'free' || plan === 'pro' || plan === 'wordsmith') {
    // Show upgrade required card
    upgradeCard.classList.remove('hidden');
    
    // Hide quick humanize and word balance features
    if (quickHumanize) quickHumanize.style.display = 'none';
    if (wordBalanceCard) wordBalanceCard.style.display = 'none';
    
    // Update current plan name
    const planNames = {
      free: 'Free',
      pro: 'Pro',
      wordsmith: 'Pro'
    };
    document.getElementById('current-plan-name').textContent = planNames[plan] || plan;
  } else {
    // Hide upgrade card, show normal features
    upgradeCard.classList.add('hidden');
    if (quickHumanize) quickHumanize.style.display = 'block';
    if (wordBalanceCard) wordBalanceCard.style.display = 'block';
  }
}

// Update plan badge
function updatePlanBadge(plan) {
  const badge = document.getElementById('plan-badge');
  const planNames = {
    free: 'Free',
    extension_only: 'Extension',
    pro: 'Pro',
    wordsmith: 'Pro', // legacy
    ultra: 'Ultra',
    master: 'Ultra' // legacy
  };
  
  const planClasses = {
    free: 'status-free',
    extension_only: 'status-extension',
    pro: 'status-pro',
    wordsmith: 'status-pro', // legacy
    ultra: 'status-ultra',
    master: 'status-ultra' // legacy
  };
  
  badge.textContent = planNames[plan] || 'Free';
  badge.className = `status-badge ${planClasses[plan] || 'status-free'}`;
}

// Fetch word balance from Supabase
async function fetchWordBalance() {
  try {
    const session = await getSession();
    const plan = subscriptionData.plan || 'free';
    const extensionLimit = EXTENSION_LIMITS[plan] || 750;
    
    // Fetch usage from Supabase
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/usage_tracking?user_id=eq.${session.user.id}&select=words_used,extension_words_used`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session.access_token}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch usage');
    }
    
    const data = await response.json();
    const usageData = data[0] || { words_used: 0, extension_words_used: 0 };
    
    // Calculate word balance based on plan
    if (plan === 'free') {
      // Free plan: shared pool
      const totalUsed = (usageData.words_used || 0) + (usageData.extension_words_used || 0);
      wordBalance = Math.max(0, extensionLimit - totalUsed);
    } else if (plan === 'extension_only') {
      // Extension-Only: separate extension pool
      const extensionUsed = usageData.extension_words_used || 0;
      wordBalance = Math.max(0, extensionLimit - extensionUsed);
    } else if (plan === 'ultra' || plan === 'master') {
      // Ultra/Master: extension pool + web pool fallback
      const extensionRemaining = Math.max(0, 5000 - (usageData.extension_words_used || 0));
      const webRemaining = Math.max(0, 30000 - (usageData.words_used || 0));
      
      // Total available words = extension pool + web pool
      wordBalance = extensionRemaining + webRemaining;
      
      // Store both values for detailed display
      chrome.storage.local.set({
        extensionPoolRemaining: extensionRemaining,
        webPoolRemaining: webRemaining,
        usingFallback: extensionRemaining === 0
      });
    } else {
      // Pro/Wordsmith: No extension access
      wordBalance = 0;
    }
    
    // Update UI
    updateWordBalanceUI(wordBalance, extensionLimit);
    
    // Display fallback notification for Ultra/Master users
    if ((plan === 'ultra' || plan === 'master')) {
      chrome.storage.local.get(['extensionPoolRemaining', 'webPoolRemaining', 'usingFallback'], (result) => {
        const wordBalanceEl = document.getElementById('word-balance');
        if (!wordBalanceEl) return;
        
        // Remove existing notifications
        const existingNotification = wordBalanceEl.querySelector('.fallback-notification');
        const existingBreakdown = wordBalanceEl.querySelector('.pool-breakdown');
        if (existingNotification) existingNotification.remove();
        if (existingBreakdown) existingBreakdown.remove();
        
        if (result.usingFallback) {
          // Show fallback notification
          const notificationEl = document.createElement('div');
          notificationEl.className = 'fallback-notification';
          notificationEl.innerHTML = `ℹ️ Extension bonus exhausted - using web pool (${result.webPoolRemaining.toLocaleString()} words remaining)`;
          wordBalanceEl.appendChild(notificationEl);
        } else if (result.extensionPoolRemaining !== undefined) {
          // Show pool breakdown
          const breakdownEl = document.createElement('div');
          breakdownEl.className = 'pool-breakdown';
          breakdownEl.innerHTML = `Extension: ${result.extensionPoolRemaining.toLocaleString()} | Web: ${result.webPoolRemaining.toLocaleString()}`;
          wordBalanceEl.appendChild(breakdownEl);
        }
      });
    }
    
    // Show upgrade prompt if out of words
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
  
  const percentage = (remaining / total) * 100;
  document.getElementById('progress-fill').style.width = `${percentage}%`;
}

// Login button - open with extension parameter
document.getElementById('login-button')?.addEventListener('click', async () => {
  await chrome.storage.local.set({ handshake_opened_at: Date.now() });
  chrome.tabs.create({ url: `${LOGIN_URL}?from=extension` });
});

// Connect Extension button - for users already logged in
document.getElementById('connect-extension-button')?.addEventListener('click', async () => {
  await chrome.storage.local.set({ handshake_opened_at: Date.now() });
  chrome.tabs.create({ url: 'https://sapienwrite.com/extension-auth?from=extension' });
});

document.getElementById('signup-link')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await chrome.storage.local.set({ handshake_opened_at: Date.now() });
  chrome.tabs.create({ url: LOGIN_URL });
});

// Dashboard button
document.getElementById('dashboard-button')?.addEventListener('click', () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

// Manage subscription button
document.getElementById('manage-subscription-button')?.addEventListener('click', async () => {
  try {
    const data = await callSupabaseFunction('customer-portal', {});
    chrome.tabs.create({ url: data.url });
  } catch (error) {
    console.error('[Popup] Error opening customer portal:', error);
    showError('Failed to open subscription management. Please try from the dashboard.');
  }
});

// Upgrade buttons
document.getElementById('upgrade-button')?.addEventListener('click', () => {
  chrome.tabs.create({ url: `https://sapienwrite.com/pricing?from=extension` });
});

document.getElementById('upgrade-extension-button')?.addEventListener('click', () => {
  chrome.tabs.create({ url: `https://sapienwrite.com/auth?from=extension&redirect=pricing&plan=extension` });
});

document.getElementById('upgrade-ultra-button')?.addEventListener('click', () => {
  chrome.tabs.create({ url: `https://sapienwrite.com/auth?from=extension&redirect=pricing&plan=ultra` });
});

// Logout link
document.getElementById('logout-link')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await clearSession();
  showLoginView();
});

// Humanize button
document.getElementById('humanize-button')?.addEventListener('click', async () => {
  const text = document.getElementById('quick-text').value.trim();
  
  if (!text) {
    showError('Please enter text to humanize');
    return;
  }
  
  const wordCount = text.split(/\s+/).length;
  
  if (wordBalance < wordCount) {
    showError(`Not enough words! You need ${wordCount} words but only have ${wordBalance} remaining.`);
    document.getElementById('upgrade-prompt').classList.remove('hidden');
    return;
  }
  
  // Disable button
  const button = document.getElementById('humanize-button');
  button.disabled = true;
  button.textContent = 'Humanizing...';
  
  try {
    const result = await callSupabaseFunction('humanize-text-hybrid', {
      text: text,
      tone: 'regular',
      source: 'extension'
    });
    
    // Copy to clipboard
    await navigator.clipboard.writeText(result.humanizedText);
    
    button.textContent = '✓ Copied to Clipboard!';
    
    // Refresh word balance
    await fetchWordBalance();
    
    setTimeout(() => {
      button.disabled = false;
      button.textContent = 'Humanize Text';
      document.getElementById('quick-text').value = '';
    }, 2000);
  } catch (error) {
    console.error('[Popup] Error humanizing text:', error);
    showError('Failed to humanize text. Please try again.');
    button.disabled = false;
    button.textContent = 'Humanize Text';
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'sessionStored') {
    console.log('[Popup] Session stored, reloading user data');
    // Mark connected and last connection time to prevent loops
    try { localSet({ connected: true, last_connected_at: Date.now() }); } catch (e) { /* noop */ }
    try { populateDiagnostics?.(); } catch (e) { /* noop */ }
    loadUserData();
  }
  
  if (message.action === 'subscriptionUpdated') {
    console.log('[Popup] Subscription updated, refreshing data');
    try { populateDiagnostics?.(); } catch (e) { /* noop */ }
    loadUserData();
  }
});
