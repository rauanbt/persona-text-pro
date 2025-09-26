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
import { Loader2, Copy, Download, ExternalLink, Crown, Zap } from 'lucide-react';

const PLAN_LIMITS = {
  free: 1500,
  pro: 15000,
  ultra: 30000
};

const PLAN_PRICES = {
  pro: { monthly: 13.99, priceId: 'price_1SBYHPH8HT0u8xph5bQtZIqD' },
  ultra: { monthly: 28.99, priceId: 'price_1SBYHfH8HT0u8xph7eYxypra' }
};

const Dashboard = () => {
  const { user, session, signOut, subscriptionData, checkSubscription } = useAuth();
  const [inputText, setInputText] = useState('');
  const [humanizedText, setHumanizedText] = useState('');
  const [selectedTone, setSelectedTone] = useState('regular');
  const [isProcessing, setIsProcessing] = useState(false);
  const [usage, setUsage] = useState({ words_used: 0, requests_count: 0 });
  const [loading, setLoading] = useState(true);

  const currentPlan = subscriptionData.plan;
  const planLimit = PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS];
  const remainingWords = planLimit - usage.words_used;
  const usagePercentage = (usage.words_used / planLimit) * 100;

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    if (!user) return;

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data, error } = await supabase
        .from('usage_tracking')
        .select('words_used, requests_count')
        .eq('user_id', user.id)
        .eq('month_year', currentMonth)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setUsage(data || { words_used: 0, requests_count: 0 });
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
    if (wordCount > remainingWords) {
      toast({
        title: "Word limit exceeded",
        description: `You have ${remainingWords} words remaining. Upgrade your plan for more words.`,
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

      toast({
        title: "Text humanized successfully!",
        description: `Used ${wordCount} words. ${data.remaining_words} words remaining.`,
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
                  <span>{remainingWords.toLocaleString()} words remaining</span>
                  <span>{usage.requests_count} requests made</span>
                </div>
              </CardContent>
            </Card>

            {/* AI Humanizer Tool */}
            <Card>
              <CardHeader>
                <CardTitle>AI Text Humanizer</CardTitle>
                <CardDescription>
                  Transform AI-generated text into natural, human-like content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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
                      className="min-h-[200px] resize-none"
                    />
                    <div className="flex justify-between items-center mt-2 text-sm text-muted-foreground">
                      <span>
                        Words: {inputText.trim() ? inputText.trim().split(/\s+/).length : 0}
                      </span>
                      <span>Remaining: {remainingWords.toLocaleString()}</span>
                    </div>
                  </div>

                  <Button 
                    onClick={handleHumanize}
                    disabled={isProcessing || !inputText.trim() || remainingWords <= 0}
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
                        className="min-h-[200px] resize-none bg-muted"
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
                  {currentPlan === 'free' && (
                    <div className="border rounded-lg p-4">
                      <div className="font-semibold">Pro Plan</div>
                      <div className="text-2xl font-bold">${PLAN_PRICES.pro.monthly}/mo</div>
                      <div className="text-sm text-muted-foreground mb-3">
                        15,000 words/month
                      </div>
                      <Button 
                        onClick={() => handleUpgrade(PLAN_PRICES.pro.priceId)}
                        className="w-full"
                      >
                        Upgrade to Pro
                      </Button>
                    </div>
                  )}
                  
                  <div className="border rounded-lg p-4">
                    <div className="font-semibold">Ultra Plan</div>
                    <div className="text-2xl font-bold">${PLAN_PRICES.ultra.monthly}/mo</div>
                    <div className="text-sm text-muted-foreground mb-3">
                      30,000 words/month
                    </div>
                    <Button 
                      onClick={() => handleUpgrade(PLAN_PRICES.ultra.priceId)}
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