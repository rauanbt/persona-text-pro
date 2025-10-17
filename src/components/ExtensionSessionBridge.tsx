import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Simplified Extension Session Bridge
 * Single broadcast strategy - reliable and simple
 */
export const ExtensionSessionBridge = () => {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const hasBroadcastOnMount = useRef(false);

  // Listen for session requests from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;

      if (event.data?.type === 'SAPIENWRITE_REQUEST_SESSION' && session) {
        console.log('[ExtensionBridge] Session request received');
        
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

  // Handle URL params from extension
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const fromExtension = urlParams.get('from') === 'extension';
    const paymentSuccess = urlParams.get('payment') === 'success';

    if (fromExtension) {
      sessionStorage.setItem('extension_handoff_pending', '1');
    }

    if (!session) return;

    // Open dedicated handoff window for extension
    if (fromExtension) {
      console.log('[ExtensionBridge] Opening handoff window');
      
      window.open(
        '/extension-auth?from=extension',
        'extensionAuth',
        'width=500,height=600,noopener,noreferrer'
      );
    }

    // Notify extension of subscription update
    if (paymentSuccess) {
      console.log('[ExtensionBridge] Notifying subscription update');
      window.postMessage({ type: 'SUBSCRIPTION_UPDATED' }, '*');
    }

    // Clean URL params
    if (fromExtension || paymentSuccess) {
      urlParams.delete('from');
      urlParams.delete('payment');
      const newSearch = urlParams.toString();
      const newUrl = `${location.pathname}${newSearch ? '?' + newSearch : ''}`;
      navigate(newUrl, { replace: true });
    }
  }, [session, location.search, navigate, location.pathname]);

  // Broadcast session once on mount (for older extensions)
  useEffect(() => {
    if (!session || hasBroadcastOnMount.current) return;
    
    // Validate session
    if (!session.access_token || !session.refresh_token || !session.user?.email) {
      return;
    }
    
    hasBroadcastOnMount.current = true;
    console.log('[ExtensionBridge] Initial broadcast');

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
  }, [session]);

  return null;
};
