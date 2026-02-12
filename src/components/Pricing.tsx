import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { PLAN_PRICES, getSavingsText } from "@/lib/pricing";

export const Pricing = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const from = urlParams.get('from');
    const plan = urlParams.get('plan');

    if (from === 'extension' && plan) {
      toast({
        title: "Choose Your Plan",
        description: "Ultra plan gives you premium humanization with more words",
        variant: "default"
      });

      setTimeout(() => {
        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    }
  }, []);

  const handleUpgrade = async (priceId: string) => {
    const extensionConnected = localStorage.getItem('extensionConnected') === 'true';
    const url = new URL('/auth', window.location.origin);
    if (extensionConnected) {
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
      description: "Free forever",
      features: [
        "1,000 words per month",
        "All 6 tone personalities",
        "Basic AI humanization",
        "Right-click rewrite on any website",
        "Works on Gmail, LinkedIn, Docs & more"
      ],
      buttonText: "Start Free",
      popular: false,
      isFree: true
    },
    {
      name: "Ultra",
      monthlyPrice: PLAN_PRICES.ultra.monthly.display,
      annualPrice: PLAN_PRICES.ultra.annual.display,
      period: isAnnual ? "per month (billed annually)" : "per month",
      description: "For creators & professionals",
      features: [
        "15,000 words per month",
        "All 6 tone personalities",
        "Premium dual-engine humanization (Gemini + GPT)",
        "Stronger rewrite refinement",
        "Priority processing",
        "Works everywhere"
      ],
      buttonText: "Upgrade to Ultra",
      popular: true,
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
            Free to start. Upgrade when you need more words.
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

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <Card key={index} className={`relative transition-all ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}>
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
                  Most Popular
                </Badge>
              )}
              {getPlanSavingsText(plan) && (
                <Badge className="absolute -top-3 right-4 bg-success text-success-foreground">
                  {getPlanSavingsText(plan)}
                </Badge>
              )}
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                <CardDescription className="text-sm">{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-foreground">{getPrice(plan)}</span>
                  {!plan.isFree && <span className="text-muted-foreground ml-1">/{plan.period}</span>}
                  {isAnnual && !plan.isFree && plan.monthlyPrice !== plan.annualPrice && (
                    <div className="text-sm text-muted-foreground line-through mt-1">
                      {plan.monthlyPrice}/month
                    </div>
                  )}
                  {!plan.isFree && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Perfect for LinkedIn creators, founders, recruiters, and daily email pros.
                    </p>
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
          ))}
        </div>
        
      </div>
    </section>
  );
};
