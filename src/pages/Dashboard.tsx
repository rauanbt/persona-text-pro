import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { ExtraWordsPackages } from '@/components/ExtraWordsPackages';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, ExternalLink, Crown, Plus, Chrome, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PLAN_LIMITS, PLAN_PRICES } from '@/lib/pricing';

const Dashboard = () => {
  const { user, session, signOut, subscriptionData, checkSubscription, loading: authLoading } = useAuth();
  const [usage, setUsage] = useState({ words_used: 0, extension_words_used: 0, requests_count: 0 });
  const [usageSummary, setUsageSummary] = useState<any>(null);
  const [extraWords, setExtraWords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showExtraWordsDialog, setShowExtraWordsDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showExtensionSetup, setShowExtensionSetup] = useState(false);
  const [highlightedPlan, setHighlightedPlan] = useState<string | null>(null);
  const navigate = useNavigate();

  const currentPlan = subscriptionData.plan;
  
  const webPlanLimit = usageSummary?.plan_limit || PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS] || 500;
  
  const webWordsUsed = usage.words_used || 0;
  const extensionWordsUsed = usage.extension_words_used || 0;
  
  const totalWordsUsed = webWordsUsed + extensionWordsUsed;
  
  const remainingWords = usageSummary?.remaining_shared !== undefined 
    ? usageSummary.remaining_shared 
    : Math.max(0, webPlanLimit - totalWordsUsed);
  const totalAvailableWords = remainingWords + extraWords;
  const usagePercentage = Math.min((totalWordsUsed / webPlanLimit) * 100, 100);

  useEffect(() => {
    fetchUsage();
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('usage-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usage_tracking', filter: `user_id=eq.${user.id}` }, () => fetchUsage())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromExtension = urlParams.get('from') === 'extension';
    const planParam = urlParams.get('plan');
    
    if (fromExtension) {
      localStorage.setItem('extensionConnected', 'true');
      toast({ title: "Welcome from Extension!", description: planParam === 'ultra' ? "Choose Ultra plan to unlock extension access" : "Choose a plan to unlock extension access" });
      if (planParam === 'extension' || planParam === 'ultra') {
        setHighlightedPlan(planParam);
        setTimeout(() => { document.getElementById('upgrade-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 500);
      }
    }
    
    if (urlParams.get('success') === 'true') {
      checkSubscription();
      toast({ title: "Subscription Activated!", description: "Your subscription has been successfully activated." });
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    if (urlParams.get('word_purchase') === 'success') {
      const sessionId = urlParams.get('session_id');
      const words = urlParams.get('words');
      if (sessionId) {
        supabase.functions.invoke('process-word-purchase', { body: { sessionId } }).then(({ data, error }) => {
          if (error) {
            toast({ title: "Processing Error", description: "Failed to add words. Please contact support.", variant: "destructive" });
          } else {
            toast({ title: "Purchase Successful!", description: `${data?.words_added || words} extra words added.` });
            fetchUsage();
          }
        });
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [checkSubscription]);

  const fetchUsage = async () => {
    if (!user) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) return;
      const { data, error } = await supabase.functions.invoke('usage-summary', { body: { source: 'web' } });
      if (error) return;
      setUsage({ words_used: data.web_used || 0, extension_words_used: data.extension_used || 0, requests_count: data.requests_count || 0 });
      setExtraWords(data.extra_words || 0);
      setUsageSummary(data);
    } catch (error) {
      console.error('[Dashboard] Error in fetchUsage:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (priceId: string) => {
    try {
      const extensionConnected = localStorage.getItem('extensionConnected') === 'true';
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId, fromExtension: extensionConnected },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data.url) window.open(data.url, '_blank');
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create checkout session.", variant: "destructive" });
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data.url) window.open(data.url, '_blank');
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to open customer portal.", variant: "destructive" });
    }
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
            <h1 className="text-xl font-bold cursor-pointer" onClick={() => navigate('/')}>SapienWrite</h1>
            <Badge variant={currentPlan === 'free' ? 'secondary' : 'default'} className="flex items-center gap-1">
              {currentPlan === 'ultra' && <Chrome className="h-3 w-3" />}
              {currentPlan.toUpperCase()}
            </Badge>
            {authLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button onClick={async () => { setIsRefreshing(true); await checkSubscription(); setIsRefreshing(false); }} variant="outline" size="sm" disabled={isRefreshing || authLoading}>
              {isRefreshing ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
              Refresh
            </Button>
            <Button onClick={() => navigate('/settings')} variant="outline" size="sm">
              <Settings className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
            <Button onClick={signOut} variant="outline" size="sm">Sign Out</Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Usage Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
              <CardDescription>
                {usageSummary?.is_first_month ? (
                  <span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">🎉 Prorated first month:</span>{' '}
                    {usageSummary.days_remaining_in_first_month} days remaining ({usageSummary.plan_limit?.toLocaleString()} words)
                  </span>
                ) : (
                  <span>Monthly usage resets on the 1st of each month</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={usagePercentage} className="mb-2" />
              <div className="flex justify-between text-sm text-muted-foreground mb-4">
                <div>
                  {remainingWords.toLocaleString()} words remaining
                  {extraWords > 0 && <span className="text-primary font-medium"> + {extraWords.toLocaleString()} extra</span>}
                </div>
                <span>{usage.requests_count} requests</span>
              </div>

              {(webWordsUsed > 0 || extensionWordsUsed > 0) && (
                <div className="p-3 bg-muted/50 rounded-md text-sm space-y-1 mb-4">
                  <div className="font-medium text-muted-foreground mb-2">Usage Breakdown:</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">🌐 Web:</span><span className="font-medium">{webWordsUsed.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">🧩 Extension:</span><span className="font-medium">{extensionWordsUsed.toLocaleString()}</span></div>
                  <div className="border-t border-muted pt-1 mt-2 flex justify-between font-semibold"><span>Total:</span><span>{totalWordsUsed.toLocaleString()}</span></div>
                </div>
              )}

              {currentPlan !== 'free' && (
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="flex-1" onClick={handleManageSubscription}>
                    <ExternalLink className="w-3 h-3 mr-1" /> Manage Subscription
                  </Button>
                  <Dialog open={showExtraWordsDialog} onOpenChange={setShowExtraWordsDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                        <Plus className="w-3 h-3 mr-1" /> Buy Extra Words
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader><DialogTitle>Extra Words Packages</DialogTitle></DialogHeader>
                      <ExtraWordsPackages currentPlan={currentPlan} onClose={() => setShowExtraWordsDialog(false)} />
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extension Setup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Chrome className="w-5 h-5 text-primary" />
                Chrome Extension
              </CardTitle>
              <CardDescription>Humanize text anywhere on the web with a right-click</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">1</div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">Install the Extension</h3>
                  <Button variant="outline" size="sm" onClick={() => window.open('https://chromewebstore.google.com/detail/sapienwrite-ai-humanizer/khkhchbmepbipcdlbgdkjdpfjbkcpbij', '_blank')}>
                    <Chrome className="w-3 h-3 mr-1" /> Open Chrome Web Store
                  </Button>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">2</div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">Log in with your account</h3>
                  <p className="text-xs text-muted-foreground">Click the extension icon and sign in</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">3</div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">Right-click to humanize</h3>
                  <p className="text-xs text-muted-foreground">Select text → Right-click → "Humanize with SapienWrite"</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upgrade CTA for free users */}
          {currentPlan === 'free' && (
            <Card id="upgrade-section" className="border-2 border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-primary" />
                  Upgrade Your Plan
                </CardTitle>
                <CardDescription>Get more words and premium features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" onClick={() => handleUpgrade(PLAN_PRICES.ultra.monthly.priceId)}>
                  Ultra — {PLAN_PRICES.ultra.monthly.display}/mo (20,000 words)
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
