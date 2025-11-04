import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Chrome } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { PLAN_PRICES, getSavingsText } from "@/lib/pricing";

export const Pricing = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [highlightedPlan, setHighlightedPlan] = useState<string | null>(null);
  const [fromExtension, setFromExtension] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const from = urlParams.get('from');
    const plan = urlParams.get('plan');

    if (from === 'extension') {
      setFromExtension(true);
      
      if (plan) {
        setHighlightedPlan(plan);
        
        // Show welcome toast
        toast({
          title: "Choose Your Plan",
          description: plan === 'ultra' 
            ? "Ultra plan includes both web dashboard and Chrome extension access"
            : "Extension-Only plan gives you Chrome extension access",
          variant: "default"
        });

        // Scroll to pricing section
        setTimeout(() => {
          const pricingSection = document.getElementById('pricing');
          if (pricingSection) {
            pricingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 500);
      }
    }
  }, []);

  const handleUpgrade = async (priceId: string) => {
    // Check if user came from extension
    const extensionConnected = localStorage.getItem('extensionConnected') === 'true';
    
    // For now, redirect to sign up with extension flag
    const url = new URL('/auth', window.location.origin);
    if (extensionConnected || fromExtension) {
      url.searchParams.set('from', 'extension');
    }
    window.location.href = url.toString();
  };

  const plans = [
    {
      name: "Free",
      monthlyPrice: "Free",
      annualPrice: "Free",
      period: "",
      description: "Perfect for trying out SapienWrite",
      features: [
        "500 words per month",
        "250 words per request",
        "Unlimited AI detection (500 words per check)",
        "All 4 tone options",
        "Basic humanization",
        "AI detection bypass"
      ],
      buttonText: "Get Started Free",
      popular: false,
      isFree: true
    },
    {
      name: "Pro",
      monthlyPrice: PLAN_PRICES.pro.monthly.display,
      annualPrice: PLAN_PRICES.pro.annual.display,
      period: isAnnual ? "per month (billed annually)" : "per month",
      description: "Perfect for professionals and content creators",
      features: [
        "15,000 words per month",
        "1,500 words per request",
        "Unlimited AI detection (2,500 words per check)",
        "All 6 tone personalities",
        "Dual-engine humanization (Gemini + ChatGPT) + Tone Generator",
        "50+ languages supported"
      ],
      buttonText: "Choose Pro",
      popular: true,
      isFree: false,
      monthlyPriceId: PLAN_PRICES.pro.monthly.priceId,
      annualPriceId: PLAN_PRICES.pro.annual.priceId
    },
    {
      name: "Extension-Only",
      monthlyPrice: PLAN_PRICES.extension_only.monthly.display,
      annualPrice: PLAN_PRICES.extension_only.annual.display,
      period: "per month",
      description: "Chrome Extension access only",
      features: [
        "5,000 extension words per month",
        "Chrome Extension access only",
        "All 6 tone personalities",
        "Triple-engine humanization (Gemini + ChatGPT + Claude) + Tone Generator",
        "No web dashboard access"
      ],
      buttonText: "Get Extension-Only",
      popular: false,
      isFree: false,
      monthlyPriceId: PLAN_PRICES.extension_only.monthly.priceId,
      annualPriceId: PLAN_PRICES.extension_only.annual.priceId
    },
    {
      name: "Ultra",
      monthlyPrice: PLAN_PRICES.ultra.monthly.display,
      annualPrice: PLAN_PRICES.ultra.annual.display,
      period: isAnnual ? "per month (billed annually)" : "per month",
      description: "For teams and heavy users",
      features: [
        "40,000 words per month",
        "3,000 words per request",
        "Unlimited AI detection (2,500 words per check)",
        "All 6 tone personalities",
        "Triple-engine humanization (Gemini + ChatGPT + Claude) + Tone Generator",
        "50+ languages supported",
        "✅ Chrome Extension Included (40k shared pool)",
        "Priority support"
      ],
      buttonText: "Choose Ultra",
      popular: false,
      isFree: false,
      monthlyPriceId: PLAN_PRICES.ultra.monthly.priceId,
      annualPriceId: PLAN_PRICES.ultra.annual.priceId
    }
  ];

  const getPrice = (plan: typeof plans[0]) => {
    return isAnnual ? plan.annualPrice : plan.monthlyPrice;
  };

  const getPlanSavingsText = (plan: typeof plans[0]) => {
    if (!isAnnual || plan.isFree || plan.monthlyPrice === plan.annualPrice) return null;
    const monthlyVal = parseFloat(plan.monthlyPrice.replace('$', ''));
    const annualVal = parseFloat(plan.annualPrice.replace('$', ''));
    return getSavingsText(monthlyVal, annualVal);
  };

  return (
    <section id="pricing" className="py-16 bg-feature-bg">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Choose the plan that works best for you
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            <span className={`text-sm font-medium transition-colors ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                isAnnual ? 'bg-primary border-primary' : 'bg-background border-border'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full transition-transform ${
                  isAnnual 
                    ? 'translate-x-5 bg-primary-foreground' 
                    : 'translate-x-0.5 bg-foreground'
                }`}
              />
            </button>
            <span className={`text-sm font-medium transition-colors ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
              Annual
            </span>
            {isAnnual && (
              <Badge className="bg-success text-success-foreground ml-2">
                Save 40%
              </Badge>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan, index) => {
            const isHighlighted = highlightedPlan === plan.name.toLowerCase().replace('-only', '_only');
            const showExtensionBadge = fromExtension && (plan.name === 'Extension-Only' || plan.name === 'Ultra');
            
            return (
              <Card 
                key={index} 
                className={`relative transition-all ${
                  isHighlighted 
                    ? 'border-2 border-primary shadow-lg scale-105' 
                    : plan.popular 
                    ? 'border-primary shadow-lg scale-105' 
                    : ''
                }`}
              >
                {(plan.popular || isHighlighted) && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
                    {isHighlighted && fromExtension ? 'Perfect for Extension' : 'Most Popular'}
                  </Badge>
                )}
                {getPlanSavingsText(plan) && (
                  <Badge className="absolute -top-3 right-4 bg-success text-success-foreground">
                    {getPlanSavingsText(plan)}
                  </Badge>
                )}
                {!plan.isFree && (
                  <div className="absolute top-4 right-4">
                    <p className="text-xs text-muted-foreground">
                      All sales final
                    </p>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl font-bold flex items-center justify-center gap-2">
                    {plan.name}
                    {showExtensionBadge && <Chrome className="h-4 w-4 text-primary" />}
                  </CardTitle>
                  <CardDescription className="text-sm">{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-foreground">{getPrice(plan)}</span>
                  {!plan.isFree && <span className="text-muted-foreground ml-1">/{plan.period}</span>}
                  {isAnnual && !plan.isFree && plan.monthlyPrice !== plan.annualPrice && (
                    <div className="text-sm text-muted-foreground line-through mt-1">
                      {plan.monthlyPrice}/month
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-sm">
                      <Check className="w-4 h-4 text-primary mr-2 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className={`w-full ${plan.popular ? 'bg-primary hover:bg-primary/90' : ''}`}
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => {
                    if (plan.isFree) {
                      window.location.href = '/auth';
                    } else {
                      const priceId = isAnnual ? plan.annualPriceId : plan.monthlyPriceId;
                      handleUpgrade(priceId!);
                    }
                  }}
                >
                  {plan.buttonText}
                </Button>
              </CardFooter>
            </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};