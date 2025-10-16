// Authentication Helper Functions

// Store session in chrome.storage.sync
async function storeSession(session) {
  if (!session) return;
  
  await chrome.storage.sync.set({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user_email: session.user?.email || '',
    user_id: session.user?.id || ''
  });
  
  console.log('[Auth] Session stored successfully');
}

// Refresh session using refresh_token
async function refreshSession() {
  const data = await chrome.storage.sync.get(['refresh_token', 'user_email', 'user_id']);
  if (!data.refresh_token) {
    console.log('[Auth] No refresh_token available');
    return null;
  }
  
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ refresh_token: data.refresh_token })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error('[Auth] Refresh failed:', errText);
      return null;
    }
    
    const json = await res.json();
    const expires_at = Math.floor(Date.now() / 1000) + (json.expires_in || 3600);
    const newSession = {
      access_token: json.access_token,
      refresh_token: json.refresh_token || data.refresh_token,
      expires_at,
      user: {
        email: json.user?.email || data.user_email || '',
        id: json.user?.id || data.user_id || ''
      }
    };
    
    await storeSession(newSession);
    console.log('[Auth] Session refreshed successfully');
    return newSession;
  } catch (error) {
    console.error('[Auth] Refresh error:', error);
    return null;
  }
}

// Get session from chrome.storage.sync
async function getSession() {
  const data = await chrome.storage.sync.get([
    'access_token',
    'refresh_token',
    'expires_at',
    'user_email',
    'user_id'
  ]);
  
  if (!data.access_token) {
    console.log('[Auth] No session found');
    return null;
  }
  
  const now = Math.floor(Date.now() / 1000);
  
  // Refresh if expiring within 60 seconds
  if (data.expires_at && now >= (data.expires_at - 60)) {
    console.log('[Auth] Access token expired/near-expiry - refreshing...');
    const refreshed = await refreshSession();
    if (refreshed) return refreshed;
    await clearSession();
    return null;
  }
  
  // Valid session
  console.log('[Auth] Session retrieved (valid)');
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    user: {
      email: data.user_email,
      id: data.user_id
    }
  };
}

// Clear session from storage
async function clearSession() {
  await chrome.storage.sync.remove([
    'access_token',
    'refresh_token',
    'expires_at',
    'user_email',
    'user_id'
  ]);
  console.log('[Auth] Session cleared');
}

// Check if user is authenticated
async function isAuthenticated() {
  const session = await getSession();
  return session !== null;
}

// Call Supabase edge function
async function callSupabaseFunction(functionName, body = {}) {
  const session = await getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(body)
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Function call failed: ${error}`);
  }
  
  return await response.json();
}

// Check subscription status
async function checkSubscription() {
  try {
    const data = await callSupabaseFunction('check-subscription', {});
    console.log('[Auth] Subscription status:', data);
    return data;
  } catch (error) {
    console.error('[Auth] Error checking subscription:', error);
    throw error;
  }
}
