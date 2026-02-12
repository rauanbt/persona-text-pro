import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Crown } from "lucide-react";
import { PLAN_PRICES, getSavingsText } from "@/lib/pricing";

export const WritingJourneyPricing = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  const handleUpgrade = async (priceId: string) => {
    window.location.href = '/auth';
  };

  const plans = [
    {
      name: "Free",
      subtitle: "Get started for free",
      monthlyPrice: "Free",
      annualPrice: "Free",
      period: "",
      description: "Try SapienWrite with no commitment",
      icon: <Star className="w-8 h-8 text-amber-500" />,
      features: [
        "500 words per month",
        "250 words per request",
        "All 6 tone personalities",
        "Basic AI humanization",
        "Right-click humanize on any website"
      ],
      buttonText: "Get Started Free",
      popular: false,
      isFree: true,
      bgGradient: "from-amber-50/50 to-yellow-50/50 dark:from-amber-950/20 dark:to-yellow-950/20",
      borderColor: "border-amber-200 dark:border-amber-800"
    },
    {
      name: "Ultra",
      subtitle: "For power users",
      monthlyPrice: PLAN_PRICES.ultra.monthly.display,
      annualPrice: PLAN_PRICES.ultra.annual.display,
      period: isAnnual ? "per month (billed annually)" : "per month",
      description: "Maximum humanization power",
      icon: <Crown className="w-8 h-8 text-purple-500" />,
      features: [
        "5,000 words per month",
        "All 6 tone personalities",
        "Premium dual-engine humanization (Gemini + ChatGPT)",
        "Right-click humanize on any website",
        "Works on Gmail, LinkedIn, Docs, and more"
      ],
      buttonText: "Upgrade to Ultra",
      popular: true,
      isFree: false,
      monthlyPriceId: PLAN_PRICES.ultra.monthly.priceId,
      annualPriceId: PLAN_PRICES.ultra.annual.priceId,
      bgGradient: "from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20",
      borderColor: "border-purple-200 dark:border-purple-800"
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
    <section id="pricing" className="py-20 bg-gradient-to-br from-amber-50/30 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6" style={{ color: '#8B4513' }}>
            Simple Pricing
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Free to start. Upgrade when you need more words.
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            <span className={`text-sm font-medium transition-colors ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                isAnnual ? 'bg-primary border-primary' : 'bg-background border-border'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full transition-transform ${
                  isAnnual 
                    ? 'translate-x-6 bg-primary-foreground' 
                    : 'translate-x-1 bg-foreground'
                }`}
              />
            </button>
            <span className={`text-sm font-medium transition-colors ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
              Annual
            </span>
            {isAnnual && (
              <Badge className="bg-green-500 text-white ml-2">
                Save 40%
              </Badge>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <Card key={index} className={`relative overflow-hidden transition-all duration-300 hover:shadow-2xl ${plan.popular ? 'scale-105 shadow-xl' : 'hover:scale-102'} bg-gradient-to-br ${plan.bgGradient} border-2 ${plan.borderColor} flex flex-col h-full`}>
              {plan.popular && (
                <Badge className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 z-10">
                  Most Popular ⭐
                </Badge>
              )}
              {getPlanSavingsText(plan) && (
                <Badge className="absolute top-4 right-4 bg-green-500 text-white z-10">
                  {getPlanSavingsText(plan)}
                </Badge>
              )}
              
              <CardHeader className="text-center pb-4 pt-12">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-full bg-background/80 backdrop-blur-sm">
                    {plan.icon}
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-foreground">
                  {plan.name}
                </CardTitle>
                <CardDescription className="text-sm font-medium text-muted-foreground">
                  {plan.subtitle}
                </CardDescription>
                
                <div className="mt-6">
                  <span className="text-4xl font-bold text-foreground">{getPrice(plan)}</span>
                  {!plan.isFree && <span className="text-muted-foreground ml-1 text-sm">/{plan.period}</span>}
                  {isAnnual && !plan.isFree && plan.monthlyPrice !== plan.annualPrice && (
                    <div className="text-sm text-muted-foreground line-through mt-1">
                      {plan.monthlyPrice}/month
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="px-6 flex-grow">
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => {
                    const isDualEngine = feature.includes('dual-engine');
                    return (
                      <li key={featureIndex} className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className={`text-foreground ${isDualEngine ? 'font-bold text-purple-700 dark:text-purple-400' : ''}`}>
                          {feature}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
              
              <CardFooter className="p-6 pt-4 mt-auto">
                <Button 
                  className={`w-full py-3 font-semibold transition-all duration-300 ${
                    plan.popular 
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl' 
                      : 'border-2 border-current hover:bg-current hover:text-background'
                  }`}
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
