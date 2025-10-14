// Content script for auth session transfer
// Only runs on sapienwrite.com pages

console.log('[AuthBridge] Content script loaded');

// Listen for session data from the web app
window.addEventListener('message', (event) => {
  // Security: verify origin
  if (event.origin !== window.location.origin) {
    return;
  }

  if (event.data.type === 'SAPIENWRITE_SESSION') {
    console.log('[AuthBridge] Received session from web app');
    
    // Forward session to extension background script
    chrome.runtime.sendMessage({
      action: 'storeSession',
      session: event.data.session
    }, (response) => {
      if (response?.success) {
        console.log('[AuthBridge] Session stored successfully');
      } else {
        console.error('[AuthBridge] Failed to store session');
      }
    });
  }
});

console.log('[AuthBridge] Ready to receive session data');
