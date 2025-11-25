import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { ToneSelector } from '@/components/ToneSelector';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { ExtraWordsPackages } from '@/components/ExtraWordsPackages';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AIDetectionResults } from '@/components/AIDetectionResults';
import { Loader2, Copy, Download, ExternalLink, Crown, Zap, Plus, Brain, Shield, Chrome, ChevronDown, Check, HelpCircle, Settings } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNavigate } from 'react-router-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

import { PLAN_LIMITS, PLAN_PRICES } from '@/lib/pricing';

const Dashboard = () => {
  const { user, session, signOut, subscriptionData, checkSubscription, loading: authLoading } = useAuth();
  const [inputText, setInputText] = useState('');
  const [humanizedText, setHumanizedText] = useState('');
  const [selectedTone, setSelectedTone] = useState('regular');
  const [isProcessing, setIsProcessing] = useState(false);
  const [usage, setUsage] = useState({ words_used: 0, extension_words_used: 0, requests_count: 0 });
  const [usageSummary, setUsageSummary] = useState<any>(null);
  const [extraWords, setExtraWords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showExtraWordsDialog, setShowExtraWordsDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('humanize');
  const [aiDetectionStatus, setAiDetectionStatus] = useState<'checking' | 'completed' | null>(null);
  const [isAnnualBilling, setIsAnnualBilling] = useState(false);
  const [aiDetectionResults, setAiDetectionResults] = useState<any>(null);
  const [isCheckingAI, setIsCheckingAI] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showExtensionSetup, setShowExtensionSetup] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [highlightedPlan, setHighlightedPlan] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  // Request tracking to ignore stale results
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentPlan = subscriptionData.plan;
  const isExtensionOnlyPlan = currentPlan === 'extension_only';
  const hasExtensionBonus = currentPlan === 'extension_only';
  
  // Use prorated limit from usage-summary if available, otherwise fallback to PLAN_LIMITS
  const webPlanLimit = usageSummary?.plan_limit || PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS];
  const extensionLimit = hasExtensionBonus ? 5000 : 0;
  
  const webWordsUsed = usage.words_used || 0;
  const extensionWordsUsed = usage.extension_words_used || 0;
  
  // For Ultra/Master: combine web + extension usage (shared pool)
  const isSharedPool = currentPlan === 'ultra' || currentPlan === 'master';
  const totalWordsUsed = isSharedPool 
    ? webWordsUsed + extensionWordsUsed 
    : webWordsUsed;
  
  // Use prorated values from usage-summary for accurate remaining words
  const remainingWords = usageSummary?.remaining_shared !== undefined 
    ? usageSummary.remaining_shared 
    : Math.max(0, webPlanLimit - totalWordsUsed);
  const extensionRemainingWords = hasExtensionBonus ? Math.max(0, extensionLimit - extensionWordsUsed) : 0;
  const totalAvailableWords = remainingWords + extraWords;
  const usagePercentage = Math.min((totalWordsUsed / webPlanLimit) * 100, 100);
  const extensionUsagePercentage = hasExtensionBonus ? Math.min((extensionWordsUsed / extensionLimit) * 100, 100) : 0;

  useEffect(() => {
    fetchUsage();
  }, []);

  // Realtime subscription for usage updates
  useEffect(() => {
    if (!user) return;

    const currentMonth = new Date().toISOString().slice(0, 7);
    
    console.log('[Dashboard] Setting up realtime subscription for usage_tracking');
    
    const channel = supabase
      .channel('usage-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'usage_tracking',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Dashboard] Realtime usage update received:', payload);
          // Refresh usage when extension or web updates usage
          fetchUsage();
        }
      )
      .subscribe();

    return () => {
      console.log('[Dashboard] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Debug: Monitor humanizedText state changes
  useEffect(() => {
    console.log('[DEBUG] humanizedText state changed:', {
      hasValue: !!humanizedText,
      length: humanizedText?.length,
      preview: humanizedText?.substring(0, 100)
    });
  }, [humanizedText]);

  // Scroll to result when it appears
  useEffect(() => {
    if (showResult && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showResult]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check for extension deep link parameters
    const fromExtension = urlParams.get('from') === 'extension';
    const planParam = urlParams.get('plan');
    
    if (fromExtension) {
      // Store extension connection flag
      localStorage.setItem('extensionConnected', 'true');
      
      // Show toast notification for extension users
      toast({
        title: "Welcome from Extension!",
        description: planParam === 'ultra' 
          ? "Choose Ultra plan to unlock both web and extension access" 
          : "Choose a plan to unlock extension access",
        variant: "default"
      });
      
      // Highlight the appropriate plan
      if (planParam === 'extension' || planParam === 'ultra') {
        setHighlightedPlan(planParam);
        
        // Scroll to upgrade section after a short delay
        setTimeout(() => {
          const upgradeSection = document.getElementById('upgrade-section');
          if (upgradeSection) {
            upgradeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 500);
      }
    }
    
    // Check for subscription success
    if (urlParams.get('success') === 'true') {
      // Immediately refresh subscription status
      checkSubscription();
      toast({
        title: "Subscription Activated!",
        description: "Your subscription has been successfully activated.",
        variant: "default"
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    // Check for word purchase success - Process the payment
    if (urlParams.get('word_purchase') === 'success') {
      const sessionId = urlParams.get('session_id');
      const words = urlParams.get('words');
      
      if (sessionId) {
        // Call process-word-purchase to actually add the words
        supabase.functions.invoke('process-word-purchase', {
          body: { sessionId }
        }).then(({ data, error }) => {
          if (error) {
            console.error('Error processing word purchase:', error);
            toast({
              title: "Processing Error",
              description: "Failed to add words to your account. Please contact support.",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Purchase Successful!",
              description: `${data?.words_added || words} extra words have been added to your account.`,
              variant: "default"
            });
            // Refresh usage to show updated extra words
            fetchUsage();
          }
        });
      } else {
        toast({
          title: "Payment Received",
          description: "Processing your purchase. It may take a moment to reflect in your account.",
          variant: "default"
        });
        setTimeout(() => fetchUsage(), 3000);
      }
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [checkSubscription]);

  const fetchUsage = async () => {
    if (!user) return;
    
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        console.error('[Dashboard] No session token available');
        return;
      }

      const { data, error } = await supabase.functions.invoke('usage-summary', {
        body: { source: 'web' },
      });

      if (error) {
        console.error('[Dashboard] Error fetching usage summary:', error);
        return;
      }

      console.log('[Dashboard] Usage summary received:', data);

      setUsage({
        words_used: data.web_used || 0,
        extension_words_used: data.extension_used || 0,
        requests_count: data.requests_count || 0
      });

      setExtraWords(data.extra_words || 0);
      setUsageSummary(data); // Store full summary for prorated info
    } catch (error) {
      console.error('[Dashboard] Error in fetchUsage:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to normalize edge function response (handles strings, nested data, etc.)
  const normalizeFnResponse = (raw: any) => {
    // If string, try JSON parse, otherwise treat as the text itself
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed;
      } catch {
        return { humanized_text: raw };
      }
    }
    // If wrapped in "data"
    if (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object') {
      return raw.data;
    }
    return raw;
  };

  // Extract humanized text from known fields only
  const pickHumanizedText = (obj: any): string => {
    if (!obj || typeof obj !== 'object') return '';
    
    // Only check explicit known fields - no deep scanning to avoid picking up unrelated strings
    const candidates = ['humanized_text', 'finalText', 'text', 'result', 'output'];
    
    for (const key of candidates) {
      const value = obj[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    
    return '';
  };

  const handleHumanize = async () => {
    if (!inputText.trim()) {
      toast({
        title: "Empty text",
        description: "Please enter some text to humanize.",
        variant: "destructive",
      });
      return;
    }

    const wordCount = inputText.trim().split(/\s+/).length;
    if (wordCount > totalAvailableWords) {
      toast({
        title: "Word limit exceeded",
        description: extraWords > 0 
          ? `You have ${totalAvailableWords} words remaining (${remainingWords} monthly + ${extraWords} extra words).`
          : `You have ${remainingWords} words remaining. Purchase extra words to continue.`,
        variant: "destructive",
      });
      return;
    }

    // Increment request ID to invalidate any previous requests
    const myRequestId = ++requestIdRef.current;
    
    setIsProcessing(true);
    setHumanizedText('');
    setShowResult(false);
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    // Set up 90s timeout
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, 90000);
    
    console.log('[DEBUG] Starting humanization:', { 
      textLength: inputText.length, 
      wordCount,
      tone: selectedTone,
      requestId: myRequestId
    });

    try {
      console.log('[DEBUG] Calling humanize-text-hybrid edge function...');
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }
      
      const SUPABASE_URL = 'https://nycrxoppbsakpkkeiqzb.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55Y3J4b3BwYnNha3Bra2VpcXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4Nzc2NDMsImV4cCI6MjA3NDQ1MzY0M30.On7TSxxCpJT868Kygk1PgfUACyPodjx78G5lKxejt74';
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/humanize-text-hybrid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ 
          text: inputText, 
          tone: selectedTone, 
          source: 'web' 
        }),
        signal
      });
      
      // Check if this request was superseded
      if (requestIdRef.current !== myRequestId) {
        console.log('[DEBUG] Request superseded, ignoring result');
        return;
      }

      console.log('[DEBUG] Raw response:', { 
        status: response.status,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DEBUG] Response error:', errorText);
        throw new Error(errorText || 'Failed to humanize text');
      }

      const data = await response.json();
      
      // Check again if this request was superseded
      if (requestIdRef.current !== myRequestId) {
        console.log('[DEBUG] Request superseded after response, ignoring');
        return;
      }

      console.log('[DEBUG] Response data:', {
        hasData: !!data,
        dataType: typeof data,
        dataKeys: data && typeof data === 'object' ? Object.keys(data) : []
      });

      if (!data) {
        throw new Error('No data returned from humanization');
      }

      // Normalize response
      const normalized = normalizeFnResponse(data);

      console.log('[DEBUG] Normalized response:', {
        type: typeof normalized,
        keys: normalized && typeof normalized === 'object' ? Object.keys(normalized) : [],
        hasErrorField: !!normalized?.error
      });

      if (normalized?.error) {
        throw new Error(normalized.error);
      }

      const humanizedResult = pickHumanizedText(normalized);

      if (humanizedResult.trim().length === 0) {
        console.warn('[DEBUG] No usable humanized text found');
        setHumanizedText('No output text was returned. Please try again.');
        setShowResult(true);
      } else {
        setHumanizedText(humanizedResult);
        setShowResult(true);
        console.log('[DEBUG] Humanized text set, length:', humanizedResult.length);
      }
      
      setActiveTab('humanize');
      
      setUsage(prev => ({
        words_used: prev.words_used + wordCount,
        extension_words_used: prev.extension_words_used || 0,
        requests_count: prev.requests_count + 1
      }));
      
      if (normalized.extra_words_remaining !== undefined) {
        setExtraWords(normalized.extra_words_remaining);
      }

      toast({
        title: "Text humanized successfully!",
        description: `Used ${wordCount} words. ${normalized.total_remaining || normalized.remaining_words || 'Unknown'} words remaining.`,
      });
      
    } catch (error: any) {
      // Check if this request was superseded
      if (requestIdRef.current !== myRequestId) {
        console.log('[DEBUG] Request superseded during error handling, ignoring');
        return;
      }
      
      console.error('[DEBUG] Error in handleHumanize:', error);
      
      if (error.name === 'AbortError') {
        toast({
          title: "Request canceled",
          description: "The humanization request was canceled or timed out.",
          variant: "destructive",
        });
      } else if (error.message?.includes('Word limit exceeded')) {
        toast({
          title: "Word limit exceeded",
          description: "Upgrade your plan to continue humanizing text.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to humanize text. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      clearTimeout(timeoutId);
      // Only update state if this is still the current request
      if (requestIdRef.current === myRequestId) {
        setIsProcessing(false);
      }
      console.log('[DEBUG] Processing complete');
    }
  };
  
  const handleCancelHumanize = () => {
    console.log('[DEBUG] User canceled humanization');
    requestIdRef.current++; // Invalidate current request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
    toast({
      title: "Canceled",
      description: "Humanization request canceled.",
    });
  };

  const handleUpgrade = async (priceId: string) => {
    try {
      // Check if user came from extension
      const extensionConnected = localStorage.getItem('extensionConnected') === 'true';
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          priceId,
          fromExtension: extensionConnected 
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session.",
        variant: "destructive",
      });
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to open customer portal.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(humanizedText);
    toast({
      title: "Copied!",
      description: "Humanized text copied to clipboard.",
    });
  };

  const downloadText = () => {
    const element = document.createElement('a');
    const file = new Blob([humanizedText], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'humanized-text.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleCheckAI = async () => {
    if (!inputText.trim()) {
      toast({
        title: "Empty text",
        description: "Please enter some text to check for AI detection.",
        variant: "destructive",
      });
      return;
    }

    const wordCount = inputText.trim().split(/\s+/).length;
    if (wordCount > 2500) {
      toast({
        title: "Word limit exceeded",
        description: "Please limit your text to 2,500 words for AI detection.",
        variant: "destructive",
      });
      return;
    }

    // Just set status to 'checking' - let AIDetectionResults handle the API call
    setAiDetectionStatus('checking');
  };

  const handleAIDetectionScore = (score: number) => {
    toast({
      title: "AI Detection Complete",
      description: `AI Detection Score: ${score}%`,
    });
  };

  const handleHumanizeFromDetection = () => {
    setActiveTab('humanize');
    handleHumanize();
  };

  const handleDeleteAccount = async () => {
    navigate('/settings');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">SapienWrite Dashboard</h1>
            <div className="flex items-center gap-2">
              <Badge variant={currentPlan === 'free' ? 'secondary' : 'default'} className="flex items-center gap-1">
                {(currentPlan === 'ultra' || currentPlan === 'extension_only') && (
                  <Chrome className="h-3 w-3" />
                )}
                {currentPlan.toUpperCase()}
              </Badge>
              {authLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Welcome, {user?.email}
            </span>
            <Button 
              onClick={async () => {
                setIsRefreshing(true);
                await checkSubscription();
                setIsRefreshing(false);
              }} 
              variant="outline" 
              size="sm"
              disabled={isRefreshing || authLoading}
            >
              {isRefreshing ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
              Refresh Status
            </Button>
            
            <Button 
              onClick={() => navigate('/settings')} 
              variant="outline" 
              size="sm"
            >
              <Settings className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
            
            <Button onClick={signOut} variant="outline" size="sm">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Usage Stats */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {isExtensionOnlyPlan ? 'Extension Usage' : 'Web Dashboard Usage'}
                </CardTitle>
                <CardDescription>
                  {isExtensionOnlyPlan 
                    ? 'Extension-Only plan - use the Chrome Extension to humanize text'
                    : (
                      <>
                         {usageSummary?.is_first_month ? (
                          <span className="block">
                            <span className="font-medium text-amber-600 dark:text-amber-400">
                              🎉 Prorated first month:
                            </span> {usageSummary.days_remaining_in_first_month} days remaining ({usageSummary.plan_limit?.toLocaleString()} words available)
                            <span className="block text-xs mt-1 text-muted-foreground">
                              Your full {PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS]?.toLocaleString()} word allowance starts December 1st
                            </span>
                          </span>
                        ) : (
                          <span className="block">
                            Monthly usage resets on the 1st of each month
                            {currentPlan === 'ultra' && (
                              <span className="block text-xs mt-1 text-muted-foreground">
                                Web-only usage shown. Extension shares the same monthly pool.
                              </span>
                            )}
                          </span>
                        )}
                      </>
                    )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isExtensionOnlyPlan ? (
                  // Extension-Only Plan Display
                  <div className="space-y-4">
                    {localStorage.getItem('extensionConnected') === 'true' ? (
                      // Extension Connected - Success State
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-2 border-green-200 dark:border-green-800 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <Check className="h-8 w-8 text-green-600 flex-shrink-0" />
                          <div>
                            <h3 className="font-semibold text-lg text-green-900 dark:text-green-100">Extension Connected & Ready</h3>
                            <p className="text-sm text-green-700 dark:text-green-300">
                              Right-click any text on the web to humanize it instantly
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-3xl font-bold text-primary mb-2">
                          {(5000 - extensionWordsUsed).toLocaleString()} words remaining
                        </div>
                        <Progress value={(extensionWordsUsed / 5000) * 100} className="mb-2" />
                        <p className="text-xs text-muted-foreground mb-4">
                          {extensionWordsUsed.toLocaleString()} of 5,000 words used
                        </p>
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            toast({
                              title: "How to Use",
                              description: "1. Select any text on any website\n2. Right-click the selection\n3. Choose 'Humanize with SapienWrite'",
                            });
                          }}
                        >
                          <HelpCircle className="w-4 h-4 mr-2" />
                          How to Use
                        </Button>
                      </div>
                    ) : (
                      // Extension Not Detected - Setup Needed
                      <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-6">
                        <Chrome className="w-12 h-12 mx-auto mb-3 text-blue-500" />
                        <h3 className="font-semibold text-lg mb-2 text-center">Chrome Extension Access Only</h3>
                        <p className="text-sm text-muted-foreground mb-4 text-center">
                          Your plan includes 5,000 words/month for the Chrome Extension
                        </p>
                        
                        <div className="text-3xl font-bold text-primary mb-2 text-center">
                          {(5000 - extensionWordsUsed).toLocaleString()} words remaining
                        </div>
                        <Progress value={(extensionWordsUsed / 5000) * 100} className="mb-2" />
                        <p className="text-xs text-muted-foreground mb-4 text-center">
                          {extensionWordsUsed.toLocaleString()} of 5,000 words used
                        </p>
                        
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                          <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                            Set up your extension to start using your word balance
                          </p>
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => setShowExtensionSetup(true)}
                            className="w-full"
                          >
                            <Chrome className="w-4 h-4 mr-2" />
                            View Setup Instructions
                          </Button>
                        </div>
                      </div>
                    )}
                    
                      <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 text-sm">
                      <p className="font-medium mb-2">Want web dashboard access?</p>
                      <p className="text-muted-foreground mb-3">
                        Upgrade to Ultra plan to unlock the web humanizer and AI detection tools with 40,000 words in a shared pool.
                      </p>
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => window.location.href = '#upgrade'}
                      >
                        View Upgrade Options
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Regular Plans Display
                  <>
                    <Progress value={usagePercentage} className="mb-2" />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <div>
                        <div>
                          {remainingWords.toLocaleString()} 
                          {usageSummary?.is_first_month ? ' prorated' : ' monthly'} words remaining
                        </div>
                        {extraWords > 0 && (
                          <div className="text-primary font-medium">
                            + {extraWords.toLocaleString()} extra words
                          </div>
                        )}
                      </div>
                      <span>{usage.requests_count} requests made</span>
                    </div>
                    
                    {/* Usage Breakdown for Ultra Shared Pool */}
                    {isSharedPool && (webWordsUsed > 0 || extensionWordsUsed > 0) && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-md text-sm space-y-1">
                        <div className="font-medium text-muted-foreground mb-2">Usage Breakdown:</div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">🌐 Web Dashboard:</span>
                          <span className="font-medium">{webWordsUsed.toLocaleString()} words</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">🧩 Chrome Extension:</span>
                          <span className="font-medium">{extensionWordsUsed.toLocaleString()} words</span>
                        </div>
                        <div className="border-t border-muted pt-1 mt-2 flex justify-between items-center font-semibold">
                          <span>Total Used:</span>
                          <span>{totalWordsUsed.toLocaleString()} words</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Extension Words for Extension-Only Plan */}
                     {hasExtensionBonus && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Chrome className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-medium">Extension Words</span>
                          </div>
                          <Badge variant="secondary">
                            {extensionRemainingWords.toLocaleString()} / 5,000
                          </Badge>
                        </div>
                        <Progress value={extensionUsagePercentage} className="mb-2" />
                        <p className="text-xs text-muted-foreground">
                          Chrome Extension access - 5,000 words/month
                        </p>
                        
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setShowExtensionSetup(true)}
                          >
                            <Chrome className="w-3 h-3 mr-1" />
                            View Setup
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              toast({
                                title: "Connecting Extension...",
                                description: "Syncing your account with extension",
                              });
                              
                              const authWindow = window.open(
                                '/extension-auth?from=extension',
                                'extensionAuth',
                                'width=500,height=600,noopener,noreferrer'
                              );
                              
                              // Show success toast after window closes or after delay
                              setTimeout(() => {
                                toast({
                                  title: "Connected!",
                                  description: "Extension is now synced with your account",
                                });
                              }, 3000);
                            }}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Connect Extension
                          </Button>
                        </div>
                        
                        {extensionRemainingWords === 0 && (
                          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-2">
                            <div className="flex items-start gap-2">
                              <div className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0">ℹ️</div>
                              <div className="text-xs text-blue-900 dark:text-blue-100">
                                <p className="font-medium">Extension bonus exhausted</p>
                                <p className="mt-1">
                                  Your extension now automatically uses your web dashboard pool 
                                  ({remainingWords.toLocaleString()} words remaining). No interruption!
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {!isExtensionOnlyPlan && currentPlan !== 'free' && (
                      <Dialog open={showExtraWordsDialog} onOpenChange={setShowExtraWordsDialog}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full mt-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Buy Extra Words
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Extra Words Packages</DialogTitle>
                          </DialogHeader>
                          <ExtraWordsPackages 
                            currentPlan={currentPlan} 
                            onClose={() => setShowExtraWordsDialog(false)} 
                          />
                        </DialogContent>
                      </Dialog>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* AI Tools - Hidden for Extension-Only Plan */}
            {!isExtensionOnlyPlan && (
              <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  AI Tools
                </CardTitle>
                <CardDescription>
                  Check for AI detection and humanize your text
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="humanize" className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Humanize Text
                    </TabsTrigger>
                    <TabsTrigger value="detect" className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Check AI Detection
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="humanize" className="space-y-6">
                    <ToneSelector 
                      selectedTone={selectedTone}
                      onToneChange={setSelectedTone}
                    />

                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Original Text
                        </label>
                        <Textarea
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          placeholder="Paste your AI-generated text here..."
                          className="min-h-[350px] resize-none text-base"
                        />
                        <div className="flex justify-between items-center mt-2 text-sm text-muted-foreground">
                          <span>
                            Words: {inputText.trim() ? inputText.trim().split(/\s+/).length : 0}
                          </span>
                          <span>
                            Available: {totalAvailableWords.toLocaleString()} 
                            {extraWords > 0 && <span className="text-primary"> (+{extraWords} extra)</span>}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          onClick={handleHumanize}
                          disabled={isProcessing || !inputText.trim() || totalAvailableWords <= 0}
                          className="flex-1"
                          size="lg"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Processing (may take up to 40s)...
                            </>
                          ) : (
                            <>
                              <Zap className="mr-2 h-4 w-4" />
                              Humanize Text
                            </>
                          )}
                        </Button>
                        
                        {isProcessing && (
                          <Button 
                            onClick={handleCancelHumanize}
                            variant="outline"
                            size="lg"
                            className="px-6"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>

                      {showResult && (
                        <div ref={resultRef}>
                          <label className="text-sm font-medium mb-2 block">
                            Humanized Text
                          </label>
                          <Textarea
                            key={`humanized-${humanizedText.length}`}
                            value={humanizedText}
                            readOnly
                            className="min-h-[350px] resize-none bg-muted text-base"
                          />
                          <div className="flex space-x-2 mt-2">
                            <Button onClick={copyToClipboard} variant="outline" size="sm">
                              <Copy className="mr-2 h-4 w-4" />
                              Copy
                            </Button>
                            <Button onClick={downloadText} variant="outline" size="sm">
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </Button>
                          </div>
                          
                          {/* Debug UI */}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="detect" className="space-y-6">
                    {/* Detection Usage Display */}
                    <div className="bg-muted/50 rounded-lg p-4 border">
                      <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                          <Shield className="h-5 w-5" />
                          Unlimited AI Detection
                        </h3>
                        <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                          Check up to 2,500 words per detection with our advanced multi-model AI detector
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Powered by Gemini + ChatGPT + Claude for accurate consensus results
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Text to Analyze
                        </label>
                        <Textarea
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          placeholder="Paste your text here to check for AI detection (max 2,500 words)..."
                          className="min-h-[200px] resize-none text-base"
                          maxLength={2500 * 6}
                        />
                        <div className="flex justify-between items-center mt-2 text-sm text-muted-foreground">
                          <span>
                            Words: {inputText.trim() ? inputText.trim().split(/\s+/).length : 0} / 2,500
                          </span>
                          <span>Unlimited detections</span>
                        </div>
                      </div>

                      <Button 
                        onClick={handleCheckAI}
                        disabled={isCheckingAI || !inputText.trim() || inputText.trim().split(/\s+/).length > 2500}
                        className="w-full"
                        size="lg"
                        variant="outline"
                      >
                        {isCheckingAI ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analyzing Text...
                          </>
                        ) : (
                          <>
                            <Shield className="mr-2 h-4 w-4" />
                            Check for AI Detection
                          </>
                        )}
                      </Button>

                      <AIDetectionResults
                        text={inputText}
                        onHumanize={handleHumanizeFromDetection}
                        status={aiDetectionStatus}
                        onStatusChange={setAiDetectionStatus}
                        onScoreReceived={handleAIDetectionScore}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Current Plan */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Crown className="mr-2 h-5 w-5" />
                  Current Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="font-semibold text-lg capitalize">{currentPlan}</div>
                    <div className="text-sm text-muted-foreground">
                      {webPlanLimit.toLocaleString()} words/month
                    </div>
                  </div>
                  
                  {subscriptionData.subscribed && (
                    <>
                      <Button 
                        onClick={handleManageSubscription}
                        variant="outline"
                        className="w-full"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Manage Subscription
                      </Button>
                      <div className="mt-3 p-3 bg-muted/50 rounded-md border">
                        <p className="text-xs text-muted-foreground">
                          <strong className="text-foreground">Cancellation:</strong> Cancel anytime and keep full access until your billing period ends. All subscriptions are non-refundable due to immediate AI processing costs.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Chrome Extension Access */}
            {(currentPlan === 'ultra' || currentPlan === 'extension_only') && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Chrome className="h-5 w-5" />
                    Chrome Extension Access
                  </CardTitle>
                  <Badge variant="secondary" className="w-fit">
                    Active - {currentPlan === 'ultra' ? '40,000 words/month (shared)' : '5,000 words/month'}
                  </Badge>
                </CardHeader>
              </Card>
            )}

            {/* Upgrade Options */}
            {currentPlan !== 'ultra' && (
              <Card id="upgrade-section">
                <CardHeader>
                  <CardTitle>Upgrade Your Plan</CardTitle>
                  <CardDescription>
                    Get more words and advanced features
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Billing Toggle */}
                  <div className="flex items-center justify-center space-x-4 mb-6">
                    <span className={`text-sm font-medium transition-colors ${!isAnnualBilling ? 'text-foreground' : 'text-muted-foreground'}`}>
                      Monthly
                    </span>
                    <button
                      onClick={() => setIsAnnualBilling(!isAnnualBilling)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                        isAnnualBilling ? 'bg-primary border-primary' : 'bg-background border-border'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                          isAnnualBilling 
                            ? 'translate-x-5 bg-primary-foreground' 
                            : 'translate-x-0.5 bg-foreground'
                        }`}
                      />
                    </button>
                    <span className={`text-sm font-medium transition-colors ${isAnnualBilling ? 'text-foreground' : 'text-muted-foreground'}`}>
                      Annual
                    </span>
                    {isAnnualBilling && (
                      <Badge className="bg-success text-success-foreground ml-2 text-xs">
                        Save 40%
                      </Badge>
                    )}
                  </div>

                  {currentPlan === 'free' && (
                    <>
                      {/* Extension-Only Plan */}
                      <div className={`border rounded-lg p-4 transition-all ${
                        highlightedPlan === 'extension' ? 'border-2 border-primary shadow-lg' : ''
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-semibold flex items-center gap-2">
                            <Chrome className="h-4 w-4" />
                            Extension-Only
                          </div>
                          {highlightedPlan === 'extension' && (
                            <Badge className="bg-primary text-primary-foreground text-xs">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        <div className="text-2xl font-bold">
                          {PLAN_PRICES.extension_only.monthly.display}/mo
                        </div>
                        <div className="text-sm text-muted-foreground mb-3">
                          5,000 extension words/month
                        </div>
                        <div className="text-xs text-muted-foreground mb-3">
                          Chrome Extension access only • No web dashboard
                        </div>
                        <Button 
                          onClick={() => handleUpgrade(PLAN_PRICES.extension_only.monthly.priceId)}
                          className="w-full"
                          variant="outline"
                        >
                          Get Extension-Only
                        </Button>
                      </div>
                    </>
                  )}
                  
                  {/* Ultra Plan */}
                  <div className={`border rounded-lg p-4 transition-all ${
                    highlightedPlan === 'ultra' ? 'border-2 border-primary shadow-lg' : ''
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold flex items-center gap-2">
                        <Crown className="h-4 w-4" />
                        Ultra Plan
                      </div>
                      {highlightedPlan === 'ultra' && (
                        <Badge className="bg-primary text-primary-foreground text-xs">
                          Recommended
                        </Badge>
                      )}
                    </div>
                    <div className="text-2xl font-bold">
                      {isAnnualBilling ? PLAN_PRICES.ultra.annual.display : PLAN_PRICES.ultra.monthly.display}/mo
                    </div>
                    {isAnnualBilling && (
                      <div className="text-sm text-muted-foreground">
                        ${PLAN_PRICES.ultra.annual.yearlyTotal}/year (billed annually)
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground mb-1">
                      40,000 words/month
                    </div>
                    <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                      <Chrome className="h-3 w-3" />
                      Web + Extension shared pool
                    </div>
                    <Button 
                      onClick={() => handleUpgrade(isAnnualBilling ? PLAN_PRICES.ultra.annual.priceId : PLAN_PRICES.ultra.monthly.priceId)}
                      className="w-full"
                    >
                      Get Ultra
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Extension Setup Dialog */}
      <Dialog open={showExtensionSetup} onOpenChange={setShowExtensionSetup}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Chrome className="h-6 w-6 text-primary" />
              Chrome Extension Setup
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Step 1: Install Extension */}
            <div className="flex items-start gap-4 p-4 bg-card rounded-lg border">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Install the Chrome Extension</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Get the SapienWrite extension from the Chrome Web Store
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open('https://chromewebstore.google.com/detail/sapienwrite-ai-humanizer/khkhchbmepbipcdlbgdkjdpfjbkcpbij', '_blank')}
                >
                  <Chrome className="w-4 h-4 mr-2" />
                  Open Chrome Web Store
                </Button>
              </div>
            </div>

            {/* Step 2: Login */}
            <div className="flex items-start gap-4 p-4 bg-card rounded-lg border">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-1">Login to Extension</h3>
                <p className="text-sm text-muted-foreground">
                  Click the extension icon in your browser toolbar and log in with your SapienWrite account
                </p>
              </div>
            </div>

            {/* Step 3: Start Using */}
            <div className="flex items-start gap-4 p-4 bg-card rounded-lg border">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-1">Start Humanizing Text</h3>
                <p className="text-sm text-muted-foreground">
                  Right-click any selected text on any website and choose "Humanize with SapienWrite"
                </p>
              </div>
            </div>

            {/* Success note */}
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✓ Your Extension-Only plan is active with <strong>5,000 words/month</strong>. 
                Your word balance syncs in real-time!
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;