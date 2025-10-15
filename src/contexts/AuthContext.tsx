import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  subscriptionData: {
    subscribed: boolean;
    plan: string;
    product_id: string | null;
    subscription_end: string | null;
  };
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  checkSubscription: (overrideSession?: Session | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [subscriptionData, setSubscriptionData] = useState(() => {
    // Try to load cached subscription data from localStorage
    const cachedData = localStorage.getItem('subscription_data');
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        console.log('[AuthContext] Loaded cached subscription:', parsed);
        return parsed;
      } catch (e) {
        console.warn('[AuthContext] Failed to parse cached subscription');
      }
    }
    
    // Fallback to free plan
    return {
      subscribed: false,
      plan: 'free',
      product_id: null,
      subscription_end: null
    };
  });
  const [loading, setLoading] = useState(true);

  // Helper to update subscription data and save to cache
  const updateSubscriptionData = (newData: typeof subscriptionData) => {
    setSubscriptionData(newData);
    localStorage.setItem('subscription_data', JSON.stringify(newData));
    console.log('[AuthContext] Saved subscription to cache:', newData);
  };

  const checkSubscription = async (overrideSession?: Session | null) => {
    // Resolve the active session: use override or fetch fresh
    let activeSession = overrideSession !== undefined ? overrideSession : session;
    
    if (!activeSession) {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      activeSession = freshSession;
    }

    if (!activeSession?.user) {
      console.log('[AuthContext] No active session, skipping subscription check');
      return;
    }

    try {
      console.log('[AuthContext] Checking subscription for user:', activeSession.user.id);
      console.log('[AuthContext] Using session token:', activeSession.access_token ? 'Present' : 'Missing');

      // 1) Prime from DB so UI shows the best-known plan immediately
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('current_plan')
        .eq('user_id', activeSession.user.id)
        .maybeSingle();

      if (profileError) {
        console.warn('[AuthContext] profiles query error:', profileError.message);
      }

      if (profileData?.current_plan) {
        console.log('[AuthContext] Primed plan from DB:', profileData.current_plan);
        updateSubscriptionData((prev) => ({
          ...prev,
          plan: profileData.current_plan || 'free',
        }));
      }

      // 2) Then sync with Stripe via Edge Function
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${activeSession.access_token}`,
        },
      });

      if (error) throw error;

      console.log('[AuthContext] Subscription check result:', data);
      console.log('[AuthContext] Final plan set to:', data?.plan || profileData?.current_plan || 'free');

      updateSubscriptionData({
        subscribed: Boolean(data?.subscribed),
        plan: data?.plan || profileData?.current_plan || 'free',
        product_id: data?.product_id || null,
        subscription_end: data?.subscription_end || null,
      });
    } catch (error) {
      console.error('[AuthContext] Error checking subscription:', error);
      // Fallback to DB value if Edge Function fails
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('current_plan')
          .eq('user_id', activeSession.user.id)
          .maybeSingle();

        if (profileData?.current_plan) {
          updateSubscriptionData((prev) => ({
            ...prev,
            plan: profileData.current_plan || 'free',
          }));
        }
      } catch (fallbackErr) {
        console.error('[AuthContext] Fallback profiles fetch failed:', fallbackErr);
      }
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);

      // After auth changes, check subscription immediately with the session
      if (sess?.user) {
        checkSubscription(sess).finally(() => setLoading(false));
      } else {
        setSubscriptionData({
          subscribed: false,
          plan: 'free',
          product_id: null,
          subscription_end: null,
        });
        setLoading(false);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        checkSubscription(currentSession).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-refresh subscription status every 30 seconds when user is logged in
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      checkSubscription(session);
    }, 30000);

    return () => clearInterval(interval);
  }, [session]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
      
      // Check if opened from extension
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('from') === 'extension') {
        // Redirect to extension auth page
        window.location.href = '/extension-auth?from=extension';
      }
    }

    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        }
      }
    });

    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });
    }

    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`
      }
    });

    if (error) {
      toast({
        title: "Google sign in failed",
        description: error.message,
        variant: "destructive",
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('subscription_data');
    updateSubscriptionData({
      subscribed: false,
      plan: 'free',
      product_id: null,
      subscription_end: null
    });
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
  };

  const value = {
    user,
    session,
    subscriptionData,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    checkSubscription,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};