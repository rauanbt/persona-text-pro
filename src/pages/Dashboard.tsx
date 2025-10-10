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
import { Loader2, Copy, Download, ExternalLink, Crown, Zap, Plus, Brain, Shield, Chrome } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PLAN_LIMITS = {
  free: 750,
  pro: 15000,
  ultra: 30000,
  extension_only: 5000
};

const PLAN_PRICES = {
  pro: {
    monthly: { price: 24.95, priceId: 'price_1SD818H8HT0u8xph48V9GxXG' },
    annual: { price: 17.47, priceId: 'price_1SD81lH8HT0u8xph8dYBxkqi', yearlyPrice: 209.64 }
  },
  ultra: { 
    monthly: { price: 54.95, priceId: 'price_1SD81xH8HT0u8xphuqiq8xet' },
    annual: { price: 38.47, priceId: 'price_1SD828H8HT0u8xphUaDaMTDV', yearlyPrice: 461.64 }
  },
  extension_only: {
    monthly: { price: 12.95, priceId: 'price_1SGNtsH8HT0u8xphEd7pG9Po' }
  }
};

const Dashboard = () => {
  const { user, session, signOut, subscriptionData, checkSubscription, loading: authLoading } = useAuth();
  const [inputText, setInputText] = useState('');
  const [humanizedText, setHumanizedText] = useState('');
  const [selectedTone, setSelectedTone] = useState('regular');
  const [isProcessing, setIsProcessing] = useState(false);
  const [usage, setUsage] = useState({ words_used: 0, extension_words_used: 0, requests_count: 0 });
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
  const resultRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const currentPlan = subscriptionData.plan;
  const isExtensionOnlyPlan = currentPlan === 'extension_only';
  const hasExtensionBonus = currentPlan === 'ultra' || currentPlan === 'master';
  const webPlanLimit = PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS];
  const extensionLimit = hasExtensionBonus ? 5000 : 0;
  
  const webWordsUsed = usage.words_used || 0;
  const extensionWordsUsed = usage.extension_words_used || 0;
  
  const remainingWords = Math.max(0, webPlanLimit - webWordsUsed);
  const extensionRemainingWords = hasExtensionBonus ? Math.max(0, extensionLimit - extensionWordsUsed) : 0;
  const totalAvailableWords = remainingWords + extraWords;
  const usagePercentage = Math.min((webWordsUsed / webPlanLimit) * 100, 100);
  const extensionUsagePercentage = hasExtensionBonus ? Math.min((extensionWordsUsed / extensionLimit) * 100, 100) : 0;

  useEffect(() => {
    fetchUsage();
  }, []);

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
    
    // Check for word purchase success
    if (urlParams.get('word_purchase') === 'success') {
      const words = urlParams.get('words');
      toast({
        title: "Purchase Successful!",
        description: `${words} extra words have been added to your account.`,
        variant: "default"
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh usage to show updated extra words
      setTimeout(() => fetchUsage(), 2000);
    }
  }, [checkSubscription]);

  const fetchUsage = async () => {
    if (!user) return;

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Fetch usage, extra words balance, and detection limit in parallel
      const [usageResult, profileResult] = await Promise.all([
        supabase
          .from('usage_tracking')
          .select('words_used, extension_words_used, requests_count')
          .eq('user_id', user.id)
          .eq('month_year', currentMonth)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('extra_words_balance, current_plan')
          .eq('user_id', user.id)
          .single()
      ]);

      if (usageResult.error && usageResult.error.code !== 'PGRST116') {
        throw usageResult.error;
      }

      if (profileResult.error) {
        throw profileResult.error;
      }

      setUsage(usageResult.data || { words_used: 0, extension_words_used: 0, requests_count: 0 });
      setExtraWords(profileResult.data?.extra_words_balance || 0);
    } catch (error) {
      console.error('Error fetching usage:', error);
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

    setIsProcessing(true);
    console.log('[DEBUG] Starting humanization:', { 
      textLength: inputText.length, 
      wordCount,
      tone: selectedTone 
    });

    try {
      console.log('[DEBUG] Calling humanize-text-hybrid edge function...');
      
      const { data, error } = await supabase.functions.invoke('humanize-text-hybrid', {
        body: { text: inputText, tone: selectedTone, source: 'web' },
      });

      console.log('[DEBUG] Raw edge function response:', { 
        hasError: !!error, 
        hasData: !!data,
        dataType: typeof data,
        dataKeys: data && typeof data === 'object' ? Object.keys(data) : []
      });

      if (error) {
        console.error('[DEBUG] Supabase error:', error);
        throw error;
      }

      if (!data) {
        console.error('[DEBUG] No data returned from edge function');
        throw new Error('No data returned from humanization');
      }

      // Normalize any shape (string, nested, etc.)
      const normalized = normalizeFnResponse(data);

      console.log('[DEBUG] Normalized response:', {
        type: typeof normalized,
        keys: normalized && typeof normalized === 'object' ? Object.keys(normalized) : [],
        sample: typeof normalized === 'string' ? normalized.substring(0, 100) : null,
        hasErrorField: !!normalized?.error,
        statusHints: { total_remaining: normalized?.total_remaining, remaining_words: normalized?.remaining_words }
      });

      // If the function returned an error in-body (status 200 with {error})
      if (normalized?.error) {
        throw new Error(normalized.error);
      }

      const humanizedResult = pickHumanizedText(normalized);

      if (humanizedResult.trim().length === 0) {
        console.warn('[DEBUG] No usable humanized text found. Raw object:', normalized);
        setHumanizedText('No output text was returned. Please try again.');
        setShowResult(true);
        console.log('[DEBUG] Showing result panel with fallback message');
      } else {
        setHumanizedText(humanizedResult);
        setShowResult(true);
        console.log('[DEBUG] Showing result panel with humanized text, length:', humanizedResult.length);
        console.log('[DEBUG] First 100 chars:', humanizedResult.substring(0, 100));
      }
      
      setActiveTab('humanize');
      
      setUsage(prev => ({
        words_used: prev.words_used + wordCount,
        extension_words_used: prev.extension_words_used || 0,
        requests_count: prev.requests_count + 1
      }));
      
      // Update extra words if they were used
      if (normalized.extra_words_remaining !== undefined) {
        setExtraWords(normalized.extra_words_remaining);
      }

      toast({
        title: "Text humanized successfully!",
        description: `Used ${wordCount} words. ${normalized.total_remaining || normalized.remaining_words || 'Unknown'} words remaining.`,
      });
      
      console.log('[DEBUG] Humanization complete - toast shown');
    } catch (error: any) {
      console.error('[DEBUG] Error in handleHumanize:', error);
      
      if (error.message?.includes('Word limit exceeded')) {
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
      setIsProcessing(false);
      console.log('[DEBUG] Processing complete, isProcessing set to false');
    }
  };

  const handleUpgrade = async (priceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
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
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
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
            <Button onClick={signOut} variant="outline">
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
                <CardTitle className="flex items-center justify-between">
                  {isExtensionOnlyPlan ? 'Extension Usage' : 'Web Dashboard Usage'}
                  {!isExtensionOnlyPlan && (
                    <Badge variant={usagePercentage > 80 ? 'destructive' : 'default'}>
                      {usage.words_used.toLocaleString()} / {webPlanLimit.toLocaleString()} words
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isExtensionOnlyPlan 
                    ? 'Extension-Only plan - use the Chrome Extension to humanize text'
                    : 'Monthly usage resets on the 1st of each month'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isExtensionOnlyPlan ? (
                  // Extension-Only Plan Display
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-6 text-center">
                      <Chrome className="w-12 h-12 mx-auto mb-3 text-blue-500" />
                      <h3 className="font-semibold text-lg mb-2">Chrome Extension Access Only</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Your plan includes 5,000 words/month for the Chrome Extension
                      </p>
                      <div className="text-3xl font-bold text-primary mb-2">
                        {(5000 - extensionWordsUsed).toLocaleString()} words remaining
                      </div>
                      <Progress value={(extensionWordsUsed / 5000) * 100} className="mb-2" />
                      <p className="text-xs text-muted-foreground">
                        {extensionWordsUsed.toLocaleString()} of 5,000 words used
                      </p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => navigate('/chrome-extension')}
                      >
                        View Extension Setup Instructions
                      </Button>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 text-sm">
                      <p className="font-medium mb-2">Want web dashboard access?</p>
                      <p className="text-muted-foreground mb-3">
                        Upgrade to Pro or Ultra plan to unlock the web humanizer and AI detection tools.
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
                        <div>{remainingWords.toLocaleString()} monthly words remaining</div>
                        {extraWords > 0 && (
                          <div className="text-primary font-medium">
                            + {extraWords.toLocaleString()} extra words
                          </div>
                        )}
                      </div>
                      <span>{usage.requests_count} requests made</span>
                    </div>
                    <div className="mt-2 pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Total Available:</span>
                        <span className="font-bold text-primary">{totalAvailableWords.toLocaleString()} words</span>
                      </div>
                    </div>
                    
                    {/* Extension Bonus Words for Ultra Plan */}
                    {hasExtensionBonus && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Chrome className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-medium">Extension Bonus Words</span>
                          </div>
                          <Badge variant="secondary">
                            {extensionRemainingWords.toLocaleString()} / 5,000
                          </Badge>
                        </div>
                        <Progress value={extensionUsagePercentage} className="mb-2" />
                        <p className="text-xs text-muted-foreground">
                          Separate 5,000-word pool for Chrome Extension use only
                        </p>
                        
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
                    
                    {!isExtensionOnlyPlan && (
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
                          <ExtraWordsPackages onClose={() => setShowExtraWordsDialog(false)} />
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

                      <Button 
                        onClick={handleHumanize}
                        disabled={isProcessing || !inputText.trim() || totalAvailableWords <= 0}
                        className="w-full"
                        size="lg"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Humanizing Text...
                          </>
                        ) : (
                          <>
                            <Zap className="mr-2 h-4 w-4" />
                            Humanize Text
                          </>
                        )}
                      </Button>

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
                          <div className="mt-4">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setShowRawResponse(v => !v)}
                            >
                              {showRawResponse ? 'Hide' : 'Show'} raw response (debug)
                            </Button>
                            {showRawResponse && lastRawResponse && (
                              <pre className="mt-2 p-3 bg-muted text-xs rounded overflow-auto max-h-64 border">
                                {JSON.stringify(lastRawResponse, null, 2)}
                              </pre>
                            )}
                          </div>
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
                    {currentPlan === 'ultra' ? 'Included in your plan' : 'Active'}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Access SapienWrite directly in Chrome on any website.
                  </p>
                  
                  <Button 
                    onClick={() => navigate('/chrome-extension')}
                    variant="default"
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Extension
                  </Button>

                  <Collapsible open={showExtensionSetup} onOpenChange={setShowExtensionSetup}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between">
                        Setup Instructions
                        <ChevronDown className={`h-4 w-4 transition-transform ${showExtensionSetup ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 pt-3">
                      <div className="text-sm space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-primary">1.</span>
                          <span>Download and install the extension from Chrome Web Store</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-primary">2.</span>
                          <span>Click the SapienWrite icon in your browser toolbar</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-primary">3.</span>
                          <span>You're automatically logged in - start humanizing text!</span>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            )}

            {/* Upgrade Options */}
            {currentPlan !== 'ultra' && (
              <Card>
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
                        Save 30%
                      </Badge>
                    )}
                  </div>

                  {currentPlan === 'free' && (
                    <div className="border rounded-lg p-4">
                      <div className="font-semibold">Pro Plan</div>
                      <div className="text-2xl font-bold">
                        ${isAnnualBilling ? PLAN_PRICES.pro.annual.price : PLAN_PRICES.pro.monthly.price}/mo
                      </div>
                      {isAnnualBilling && (
                        <div className="text-sm text-muted-foreground">
                          ${PLAN_PRICES.pro.annual.yearlyPrice}/year (billed annually)
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground mb-3">
                        15,000 words/month
                      </div>
                      <Button 
                        onClick={() => handleUpgrade(isAnnualBilling ? PLAN_PRICES.pro.annual.priceId : PLAN_PRICES.pro.monthly.priceId)}
                        className="w-full"
                      >
                        Upgrade to Pro
                      </Button>
                    </div>
                  )}
                  
                  <div className="border rounded-lg p-4">
                    <div className="font-semibold">Ultra Plan</div>
                    <div className="text-2xl font-bold">
                      ${isAnnualBilling ? PLAN_PRICES.ultra.annual.price : PLAN_PRICES.ultra.monthly.price}/mo
                    </div>
                    {isAnnualBilling && (
                      <div className="text-sm text-muted-foreground">
                        ${PLAN_PRICES.ultra.annual.yearlyPrice}/year (billed annually)
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground mb-3">
                      30,000 words/month
                    </div>
                    <Button 
                      onClick={() => handleUpgrade(isAnnualBilling ? PLAN_PRICES.ultra.annual.priceId : PLAN_PRICES.ultra.monthly.priceId)}
                      className="w-full"
                      variant={currentPlan === 'pro' ? 'default' : 'secondary'}
                    >
                      {currentPlan === 'pro' ? 'Upgrade to Ultra' : 'Get Ultra'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;