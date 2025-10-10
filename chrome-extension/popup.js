// Popup Script - Handles UI interactions

let subscriptionData = null;
let wordBalance = 0;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initializing...');
  
  const authenticated = await isAuthenticated();
  
  if (!authenticated) {
    showLoginView();
  } else {
    await loadUserData();
  }
});

// Show login view
function showLoginView() {
  document.getElementById('loading-view').classList.add('hidden');
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('main-view').classList.add('hidden');
}

// Show main view
function showMainView() {
  document.getElementById('loading-view').classList.add('hidden');
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('main-view').classList.remove('hidden');
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
    
    // Fetch word balance
    await fetchWordBalance();
    
    showMainView();
  } catch (error) {
    console.error('[Popup] Error loading user data:', error);
    showError('Failed to load user data. Please try again.');
    showLoginView();
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
    const planLimit = PLAN_LIMITS[plan] || 750;
    
    // Fetch usage from Supabase
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/usage_tracking?user_id=eq.${session.user.id}&select=words_used`,
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
    const wordsUsed = data[0]?.words_used || 0;
    wordBalance = Math.max(0, planLimit - wordsUsed);
    
    // Update UI
    updateWordBalanceUI(wordBalance, planLimit);
    
    // Show upgrade prompt if out of words
    if (wordBalance <= 0) {
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

// Login button
document.getElementById('login-button')?.addEventListener('click', () => {
  chrome.tabs.create({ url: LOGIN_URL });
});

document.getElementById('signup-link')?.addEventListener('click', (e) => {
  e.preventDefault();
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

// Upgrade button
document.getElementById('upgrade-button')?.addEventListener('click', () => {
  chrome.tabs.create({ url: `${DASHBOARD_URL}#upgrade` });
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
      tone: 'regular'
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
    loadUserData();
  }
});
