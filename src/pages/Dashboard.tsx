import React, { useState, useEffect } from 'react';
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
import { Loader2, Copy, Download, ExternalLink, Crown, Zap, Plus, Brain, Shield } from 'lucide-react';

const PLAN_LIMITS = {
  free: 1500,
  pro: 15000,
  ultra: 30000
};

const PLAN_PRICES = {
  pro: { 
    monthly: { price: 27.98, priceId: 'price_1SCfkBH8HT0u8xpho4UsDBf8' },
    annual: { price: 13.99, priceId: 'price_1SCfkLH8HT0u8xphWTJgQMyM', yearlyPrice: 167.88 }
  },
  ultra: { 
    monthly: { price: 57.98, priceId: 'price_1SCfkUH8HT0u8xphj7aOiKux' },
    annual: { price: 28.99, priceId: 'price_1SCfkcH8HT0u8xphBCYgOSeE', yearlyPrice: 347.88 }
  }
};

const Dashboard = () => {
  const { user, session, signOut, subscriptionData, checkSubscription } = useAuth();
  const [inputText, setInputText] = useState('');
  const [humanizedText, setHumanizedText] = useState('');
  const [selectedTone, setSelectedTone] = useState('regular');
  const [isProcessing, setIsProcessing] = useState(false);
  const [usage, setUsage] = useState({ words_used: 0, requests_count: 0 });
  const [extraWords, setExtraWords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showExtraWordsDialog, setShowExtraWordsDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('humanize');
  const [aiDetectionStatus, setAiDetectionStatus] = useState<'checking' | 'completed' | null>(null);
  const [isAnnualBilling, setIsAnnualBilling] = useState(false);
  const [aiDetectionResults, setAiDetectionResults] = useState<any>(null);
  const [isCheckingAI, setIsCheckingAI] = useState(false);

  const currentPlan = subscriptionData.plan;
  const planLimit = PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS];
  const remainingWords = Math.max(0, planLimit - usage.words_used);
  const totalAvailableWords = remainingWords + extraWords;
  const usagePercentage = Math.min((usage.words_used / planLimit) * 100, 100);

  useEffect(() => {
    fetchUsage();
  }, []);

  useEffect(() => {
    // Check for purchase success in URL params
    const urlParams = new URLSearchParams(window.location.search);
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
  }, []);

  const fetchUsage = async () => {
    if (!user) return;

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Fetch both usage and extra words balance in parallel
      const [usageResult, profileResult] = await Promise.all([
        supabase
          .from('usage_tracking')
          .select('words_used, requests_count')
          .eq('user_id', user.id)
          .eq('month_year', currentMonth)
          .single(),
        supabase
          .from('profiles')
          .select('extra_words_balance')
          .eq('user_id', user.id)
          .single()
      ]);

      if (usageResult.error && usageResult.error.code !== 'PGRST116') {
        throw usageResult.error;
      }

      if (profileResult.error) {
        throw profileResult.error;
      }

      setUsage(usageResult.data || { words_used: 0, requests_count: 0 });
      setExtraWords(profileResult.data?.extra_words_balance || 0);
    } catch (error) {
      console.error('Error fetching usage:', error);
    } finally {
      setLoading(false);
    }
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

    try {
      const { data, error } = await supabase.functions.invoke('humanize-text', {
        body: { text: inputText, tone: selectedTone },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      setHumanizedText(data.humanized_text);
      setUsage(prev => ({
        words_used: prev.words_used + wordCount,
        requests_count: prev.requests_count + 1
      }));
      
      // Update extra words if they were used
      if (data.extra_words_remaining !== undefined) {
        setExtraWords(data.extra_words_remaining);
      }

      toast({
        title: "Text humanized successfully!",
        description: `Used ${wordCount} words. ${data.total_remaining || data.remaining_words} words remaining.`,
      });
    } catch (error: any) {
      console.error('Error humanizing text:', error);
      
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

    setIsCheckingAI(true);
    setAiDetectionStatus('checking');

    try {
      const { data, error } = await supabase.functions.invoke('ai-detection-hybrid', {
        body: { text: inputText },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      setAiDetectionResults(data);
      setAiDetectionStatus('completed');
      
      toast({
        title: "AI Detection Complete",
        description: `Overall AI score: ${data.overallScore}%. ${data.summary.successfulDetectors} detectors analyzed your text.`,
      });
    } catch (error: any) {
      console.error('Error checking AI:', error);
      
      toast({
        title: "AI Detection Error",
        description: error.message || "Failed to analyze text. Please try again.",
        variant: "destructive",
      });
      
      setAiDetectionStatus(null);
    } finally {
      setIsCheckingAI(false);
    }
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
            <Badge variant={currentPlan === 'free' ? 'secondary' : 'default'}>
              {currentPlan.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user?.email}
            </span>
            <Button onClick={() => checkSubscription()} variant="outline" size="sm">
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
                  Usage Statistics
                  <Badge variant={usagePercentage > 80 ? 'destructive' : 'default'}>
                    {usage.words_used.toLocaleString()} / {planLimit.toLocaleString()} words
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Monthly usage resets on the 1st of each month
                </CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            {/* Tabbed Interface */}
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

                      {humanizedText && (
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Humanized Text
                          </label>
                          <Textarea
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
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="detect" className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Text to Analyze
                        </label>
                        <Textarea
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          placeholder="Paste your text here to check for AI detection..."
                          className="min-h-[200px] resize-none text-base"
                        />
                        <div className="flex justify-between items-center mt-2 text-sm text-muted-foreground">
                          <span>
                            Words: {inputText.trim() ? inputText.trim().split(/\s+/).length : 0}
                          </span>
                          <span>Free for all users</span>
                        </div>
                      </div>

                      <Button 
                        onClick={handleCheckAI}
                        disabled={isCheckingAI || !inputText.trim()}
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

                      {aiDetectionResults && (
                        <AIDetectionResults
                          text={inputText}
                          onHumanize={handleHumanizeFromDetection}
                          status={aiDetectionStatus}
                          onStatusChange={setAiDetectionStatus}
                        />
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
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
                      {planLimit.toLocaleString()} words/month
                    </div>
                  </div>
                  
                  {subscriptionData.subscribed && (
                    <Button 
                      onClick={handleManageSubscription}
                      variant="outline"
                      className="w-full"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Manage Subscription
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

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
                        Save 50%
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