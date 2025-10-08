import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ShieldCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Pricing = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  const handleUpgrade = async (priceId: string) => {
    // For now, redirect to sign up - this could be enhanced to handle authenticated users
    window.location.href = '/auth';
  };

  const plans = [
    {
      name: "Free",
      monthlyPrice: "Free",
      annualPrice: "Free",
      period: "",
      description: "Perfect for trying out SapienWrite",
      features: [
        "1,500 words per month",
        "250 words per request",
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
      monthlyPrice: "$27.98",
      annualPrice: "$13.99",
      period: isAnnual ? "per month (billed annually)" : "per month",
      description: "Perfect for professionals and content creators",
      features: [
        "15,000 words per month",
        "1,500 words per request",
        "All 4 tone options",
        "My Writing Style",
        "Advanced Humanization Engine",
        "50+ languages supported",
        "Fast mode"
      ],
      buttonText: "Choose Pro",
      popular: true,
      isFree: false,
      monthlyPriceId: "price_1SCfkBH8HT0u8xpho4UsDBf8",
      annualPriceId: "price_1SCgBNH8HT0u8xphoiFMa331"
    },
    {
      name: "Ultra",
      monthlyPrice: "$57.98",
      annualPrice: "$28.99",
      period: isAnnual ? "per month (billed annually)" : "per month",
      description: "For teams and heavy users",
      features: [
        "30,000 words per month",
        "3,000 words per request",
        "All 4 tone options",
        "My Writing Style",
        "Advanced Humanization Engine",
        "Ultra-human writing output",
        "Priority support"
      ],
      buttonText: "Choose Ultra",
      popular: false,
      isFree: false,
      monthlyPriceId: "price_1SCfkUH8HT0u8xphj7aOiKux",
      annualPriceId: "price_1SCgCCH8HT0u8xphO8rBX20v"
    }
  ];

  const getPrice = (plan: typeof plans[0]) => {
    return isAnnual ? plan.annualPrice : plan.monthlyPrice;
  };

  const getSavingsText = (plan: typeof plans[0]) => {
    if (!isAnnual || plan.isFree) return null;
    const monthlyCost = parseFloat(plan.monthlyPrice.replace('$', '')) * 12;
    const annualCost = parseFloat(plan.annualPrice.replace('$', '')) * 12;
    const savings = Math.round(((monthlyCost - annualCost) / monthlyCost) * 100);
    return `Save ${savings}%`;
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
                Save 30%
              </Badge>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card key={index} className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}>
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
                  Most Popular
                </Badge>
              )}
              {getSavingsText(plan) && (
                <Badge className="absolute -top-3 right-4 bg-success text-success-foreground">
                  {getSavingsText(plan)}
                </Badge>
              )}
              {!plan.isFree && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className="absolute top-4 right-4 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-help">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        3-Day Guarantee
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        Try risk-free! Request a full refund within 3 days of purchase—no questions asked.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                <CardDescription className="text-sm">{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-foreground">{getPrice(plan)}</span>
                  {!plan.isFree && <span className="text-muted-foreground ml-1">/{plan.period}</span>}
                  {isAnnual && !plan.isFree && (
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
          ))}
        </div>
      </div>
    </section>
  );
};