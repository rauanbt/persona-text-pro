import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Global bridge that posts session data to Chrome extension
 * Supports both new extensions (that request session) and old extensions (that passively listen)
 */
export const ExtensionSessionBridge = () => {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const hasBroadcastOnMount = useRef(false);

  // Listen for session requests from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Relaxed security check - verify it's from the same window
      if (event.source !== window) return;

      if (event.data?.type === 'SAPIENWRITE_REQUEST_SESSION' && session) {
        console.log('[ExtensionBridge] Session request received, responding...');
        
        window.postMessage({
          type: 'SAPIENWRITE_SESSION',
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            user: {
              email: session.user.email,
              id: session.user.id
            }
          }
        }, '*');

        localStorage.setItem('extensionConnected', 'true');
        console.log('[ExtensionBridge] Session responded');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [session]);

  // Handle URL params (from=extension, payment=success)
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const fromExtension = urlParams.get('from') === 'extension';
    const paymentSuccess = urlParams.get('payment') === 'success';

    // Persist extension handoff intent before cleaning URL
    if (fromExtension) {
      sessionStorage.setItem('extension_handoff_pending', '1');
      console.log('[ExtensionBridge] Extension handoff pending');
    }

    if (!session) return;

    // If opened from extension, open dedicated handoff window + post session
    if (fromExtension) {
      console.log('[ExtensionBridge] Opening extension handoff window...');
      
      // Open dedicated handoff page in small window
      window.open(
        '/extension-auth?from=extension',
        'extensionAuth',
        'width=500,height=600,noopener,noreferrer'
      );
      
      // Also post inline for extra reliability
      window.postMessage({
        type: 'SAPIENWRITE_SESSION',
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          user: {
            email: session.user.email,
            id: session.user.id
          }
        }
      }, '*');

      localStorage.setItem('extensionConnected', 'true');
    }

    // If payment was successful, notify extension to refresh subscription
    if (paymentSuccess) {
      console.log('[ExtensionBridge] Notifying extension of subscription update');
      window.postMessage({
        type: 'SUBSCRIPTION_UPDATED'
      }, '*');
    }

    // Clean URL params to prevent re-triggering
    if (fromExtension || paymentSuccess) {
      urlParams.delete('from');
      urlParams.delete('payment');
      const newSearch = urlParams.toString();
      const newUrl = `${location.pathname}${newSearch ? '?' + newSearch : ''}`;
      navigate(newUrl, { replace: true });
    }
  }, [session, location.search, navigate, location.pathname]);

  // Broadcast session after login if extension handoff is pending
  useEffect(() => {
    if (!session) return;
    
    const handoffPending = sessionStorage.getItem('extension_handoff_pending') === '1';
    if (!handoffPending) return;

    console.log('[ExtensionBridge] Broadcasting session for pending extension handoff');

    const broadcastSession = () => {
      window.postMessage({
        type: 'SAPIENWRITE_SESSION',
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          user: {
            email: session.user.email,
            id: session.user.id
          }
        }
      }, '*');
    };

    // Broadcast immediately
    broadcastSession();
    localStorage.setItem('extensionConnected', 'true');

    // Retry with exponential backoff (reduced to 3 attempts)
    let attempts = 0;
    const maxAttempts = 3;
    const retryInterval = setInterval(() => {
      attempts++;
      console.log(`[ExtensionBridge] Retry broadcast attempt ${attempts}/${maxAttempts}`);
      if (attempts >= maxAttempts) {
        clearInterval(retryInterval);
        sessionStorage.removeItem('extension_handoff_pending');
        console.log('[ExtensionBridge] Handoff complete');
      } else {
        broadcastSession();
      }
    }, 2000); // Increased to 2 seconds

    return () => clearInterval(retryInterval);
  }, [session]);

  // Reduced broadcast on mount - supports older extension versions (3 attempts)
  useEffect(() => {
    if (!session || hasBroadcastOnMount.current) return;
    
    // Validate session has required fields before broadcasting
    if (!session.access_token || !session.refresh_token || !session.user?.email) {
      console.warn('[ExtensionBridge] Incomplete session, skipping mount broadcast');
      return;
    }
    
    hasBroadcastOnMount.current = true;
    console.log('[ExtensionBridge] Starting mount broadcast sequence for older extensions');

    const broadcastSession = () => {
      window.postMessage({
        type: 'SAPIENWRITE_SESSION',
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          user: {
            email: session.user.email,
            id: session.user.id
          }
        }
      }, '*');
    };

    // Broadcast immediately
    broadcastSession();

    // Reduced retry attempts with exponential backoff
    let attempts = 0;
    const maxAttempts = 3;
    const retryInterval = setInterval(() => {
      attempts++;
      console.log(`[ExtensionBridge] Mount broadcast attempt ${attempts}/${maxAttempts}`);
      if (attempts >= maxAttempts) {
        clearInterval(retryInterval);
        console.log('[ExtensionBridge] Mount broadcast complete');
      } else {
        broadcastSession();
      }
    }, 2000); // Increased to 2 seconds

    return () => clearInterval(retryInterval);
  }, [session]); // Run when session becomes available

  // Re-broadcast when tab becomes visible
  useEffect(() => {
    if (!session) return;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[ExtensionBridge] Tab became visible, re-broadcasting session');
        window.postMessage({
          type: 'SAPIENWRITE_SESSION',
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            user: {
              email: session.user.email,
              id: session.user.id
            }
          }
        }, '*');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session]);

  return null;
};
