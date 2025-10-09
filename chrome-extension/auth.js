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
  
  // Check if token is expired
  const now = Math.floor(Date.now() / 1000);
  if (data.expires_at && now >= data.expires_at) {
    console.log('[Auth] Session expired');
    await clearSession();
    return null;
  }
  
  console.log('[Auth] Session retrieved');
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
