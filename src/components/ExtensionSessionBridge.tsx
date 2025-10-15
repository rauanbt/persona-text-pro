import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Global bridge that posts session data to Chrome extension
 * whenever the app is opened from the extension (from=extension param)
 */
export const ExtensionSessionBridge = () => {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Listen for session requests from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: only respond to same-origin requests
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'SAPIENWRITE_REQUEST_SESSION' && session) {
        console.log('[ExtensionBridge] Responding to session request from extension');
        
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

    // If opened from extension, post session immediately
    if (fromExtension) {
      console.log('[ExtensionBridge] Posting session to extension');
      
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
      sessionStorage.removeItem('extension_handoff_pending');
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

    // Retry a few times in case extension service worker is waking up
    let attempts = 0;
    const maxAttempts = 5;
    const retryInterval = setInterval(() => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(retryInterval);
        sessionStorage.removeItem('extension_handoff_pending');
        console.log('[ExtensionBridge] Handoff complete');
      } else {
        broadcastSession();
      }
    }, 1000);

    return () => clearInterval(retryInterval);
  }, [session]);

  // Opportunistic broadcast on mount for already logged-in users
  useEffect(() => {
    if (!session) return;
    
    const extensionConnected = localStorage.getItem('extensionConnected') === 'true';
    if (extensionConnected) return;

    console.log('[ExtensionBridge] Opportunistic session broadcast on mount');
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
  }, []); // Only run once on mount

  return null;
};
