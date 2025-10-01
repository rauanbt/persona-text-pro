import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Crown, Zap } from "lucide-react";

export const WritingJourneyPricing = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  const handleUpgrade = async (priceId: string) => {
    window.location.href = '/auth';
  };

  const journeys = [
    {
      name: "Explorer",
      subtitle: "Perfect for curious writers",
      monthlyPrice: "Free",
      annualPrice: "Free",
      period: "",
      description: "Discover the power of human-like AI writing",
      icon: <Star className="w-8 h-8 text-amber-500" />,
      features: [
        "1,500 words per month",
        "250 words per request",
        "All 6 tone personalities",
        "Basic AI humanization (Gemini engine)",
        "English language only"
      ],
      buttonText: "Begin Your Journey",
      popular: false,
      isFree: true,
      bgGradient: "from-amber-50/50 to-yellow-50/50 dark:from-amber-950/20 dark:to-yellow-950/20",
      borderColor: "border-amber-200 dark:border-amber-800"
    },
    {
      name: "Wordsmith",
      subtitle: "For professional creators",
      monthlyPrice: "$24.95",
      annualPrice: "$17.47",
      period: isAnnual ? "per month (billed annually)" : "per month",
      description: "Elevate your content with advanced writing intelligence",
      icon: <Zap className="w-8 h-8 text-blue-500" />,
      features: [
        "15,000 words per month",
        "1,500 words per request",
        "All 6 tone personalities",
        "Advanced dual-engine humanization (Gemini + OpenAI)",
        "50+ languages supported"
      ],
      buttonText: "Choose Wordsmith",
      popular: true,
      isFree: false,
      monthlyPriceId: "price_1SD818H8HT0u8xph48V9GxXG",
      annualPriceId: "price_1SD81lH8HT0u8xph8dYBxkqi",
      bgGradient: "from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20",
      borderColor: "border-blue-200 dark:border-blue-800"
    },
    {
      name: "Master",
      subtitle: "For content powerhouses",
      monthlyPrice: "$54.95",
      annualPrice: "$38.47",
      period: isAnnual ? "per month (billed annually)" : "per month",
      description: "Unlimited creativity with our most advanced tools",
      icon: <Crown className="w-8 h-8 text-purple-500" />,
      features: [
        "30,000 words per month",
        "3,000 words per request",
        "All 6 tone personalities",
        "Premium triple-engine humanization (Gemini + OpenAI + Claude)",
        "50+ languages supported"
      ],
      buttonText: "Become a Master",
      popular: false,
      isFree: false,
      monthlyPriceId: "price_1SD81xH8HT0u8xphuqiq8xet",
      annualPriceId: "price_1SD828H8HT0u8xphUaDaMTDV",
      bgGradient: "from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20",
      borderColor: "border-purple-200 dark:border-purple-800"
    }
  ];

  const getPrice = (journey: typeof journeys[0]) => {
    return isAnnual ? journey.annualPrice : journey.monthlyPrice;
  };

  const getSavingsText = (journey: typeof journeys[0]) => {
    if (!isAnnual || journey.isFree) return null;
    const monthlyCost = parseFloat(journey.monthlyPrice.replace('$', '')) * 12;
    const annualCost = parseFloat(journey.annualPrice.replace('$', '')) * 12;
    const savings = Math.round(((monthlyCost - annualCost) / monthlyCost) * 100);
    return `Save ${savings}%`;
  };

  return (
    <section id="pricing" className="py-20 bg-gradient-to-br from-amber-50/30 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6" style={{ color: '#8B4513' }}>
            Choose Your Writing Journey
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Every great writer has a unique path. Whether you're exploring the craft or mastering your voice, 
            we have the perfect journey for your creative adventure.
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            <span className={`text-sm font-medium transition-colors ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
              Monthly Adventure
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
              Annual Journey
            </span>
            {isAnnual && (
              <Badge className="bg-green-500 text-white ml-2">
                Save 30% ✨
              </Badge>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {journeys.map((journey, index) => (
            <Card key={index} className={`relative overflow-hidden transition-all duration-300 hover:shadow-2xl ${journey.popular ? 'scale-105 shadow-xl' : 'hover:scale-102'} bg-gradient-to-br ${journey.bgGradient} border-2 ${journey.borderColor} flex flex-col h-full`}>
              {journey.popular && (
                <Badge className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 z-10">
                  Most Popular Journey ⭐
                </Badge>
              )}
              {getSavingsText(journey) && (
                <Badge className="absolute top-4 right-4 bg-green-500 text-white z-10">
                  {getSavingsText(journey)}
                </Badge>
              )}
              
              <CardHeader className="text-center pb-4 pt-12">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-full bg-background/80 backdrop-blur-sm">
                    {journey.icon}
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-foreground">
                  {journey.name}
                </CardTitle>
                <CardDescription className="text-sm font-medium text-muted-foreground">
                  {journey.subtitle}
                </CardDescription>
                <p className="text-xs text-muted-foreground mt-2">
                  {journey.description}
                </p>
                
                <div className="mt-6">
                  <span className="text-4xl font-bold text-foreground">{getPrice(journey)}</span>
                  {!journey.isFree && <span className="text-muted-foreground ml-1 text-sm">/{journey.period}</span>}
                  {isAnnual && !journey.isFree && (
                    <div className="text-sm text-muted-foreground line-through mt-1">
                      {journey.monthlyPrice}/month
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="px-6 flex-grow">
                <ul className="space-y-3">
                  {journey.features.map((feature, featureIndex) => {
                    // Check if this is an engine feature that should be highlighted
                    const isDualEngine = feature.includes('dual-engine');
                    const isTripleEngine = feature.includes('triple-engine');
                    const shouldHighlight = isDualEngine || isTripleEngine;
                    
                    return (
                      <li key={featureIndex} className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className={`text-foreground ${shouldHighlight ? 'font-bold' : ''} ${isDualEngine ? 'text-blue-700 dark:text-blue-400' : ''} ${isTripleEngine ? 'text-purple-700 dark:text-purple-400' : ''}`}>
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
                    journey.popular 
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl' 
                      : 'border-2 border-current hover:bg-current hover:text-background'
                  }`}
                  variant={journey.popular ? "default" : "outline"}
                  onClick={() => {
                    if (journey.isFree) {
                      window.location.href = '/auth';
                    } else {
                      const priceId = isAnnual ? journey.annualPriceId : journey.monthlyPriceId;
                      handleUpgrade(priceId!);
                    }
                  }}
                >
                  {journey.buttonText}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="text-center mt-16 bg-background/80 backdrop-blur-sm rounded-2xl p-8 border border-amber-200/30 dark:border-amber-800/30 shadow-lg">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            Every Journey Includes Our Full Toolkit
          </h3>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-muted-foreground max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              <span>Bypass all AI detectors</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              <span>6 distinct tone personalities</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              <span>Lightning-fast processing</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};