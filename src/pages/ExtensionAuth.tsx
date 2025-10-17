import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const ExtensionAuth = () => {
  const { session } = useAuth();
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');

  useEffect(() => {
    const sendSessionToExtension = async () => {
      if (!session) {
        setStatus('error');
        return;
      }

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentSuccess = urlParams.get('payment') === 'success';

        console.log('[ExtensionAuth] Broadcasting session (3 times)');
        
        // Simple, reliable broadcast - 3 times, 1 second apart
        const broadcast = () => {
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

          if (paymentSuccess) {
            window.postMessage({ type: 'SUBSCRIPTION_UPDATED' }, '*');
          }
        };
        
        // Broadcast 3 times
        broadcast();
        setTimeout(broadcast, 1000);
        setTimeout(broadcast, 2000);

        setStatus('success');
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          window.close();
        }, 3000);
      } catch (error) {
        console.error('[ExtensionAuth] Error:', error);
        setStatus('error');
      }
    };

    if (session) {
      sendSessionToExtension();
    } else if (session === null) {
      setStatus('error');
    }
  }, [session]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-secondary/20">
      <Header />
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-card rounded-2xl shadow-xl p-8 text-center">
          {status === 'checking' && (
            <>
              <Loader2 className="w-16 h-16 mx-auto mb-4 text-primary animate-spin" />
              <h1 className="text-2xl font-bold mb-2">Connecting Extension</h1>
              <p className="text-muted-foreground">
                Syncing your account with Chrome Extension...
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h1 className="text-2xl font-bold mb-2 text-green-600">
                {new URLSearchParams(window.location.search).get('payment') === 'success' 
                  ? 'Payment Successful!' 
                  : 'Extension Connected!'}
              </h1>
              <p className="text-muted-foreground mb-4">
                {new URLSearchParams(window.location.search).get('payment') === 'success'
                  ? 'Your subscription is active. Extension is ready!'
                  : 'Your Chrome Extension is now connected.'}
              </p>
              <p className="text-sm text-muted-foreground">
                This window will close automatically...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                <span className="text-3xl">⚠️</span>
              </div>
              <h1 className="text-2xl font-bold mb-2 text-destructive">Connection Failed</h1>
              <p className="text-muted-foreground mb-4">
                Unable to connect. Please try again from the extension.
              </p>
              <button
                onClick={() => window.close()}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Close Window
              </button>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ExtensionAuth;
