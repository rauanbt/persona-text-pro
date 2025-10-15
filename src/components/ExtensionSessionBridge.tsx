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

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const fromExtension = urlParams.get('from') === 'extension';
    const paymentSuccess = urlParams.get('payment') === 'success';

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

      // Mark that extension has been connected
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

  return null;
};
