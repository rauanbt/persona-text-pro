import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

export const Pricing = () => {
  const plans = [
    {
      name: "Basic",
      price: "$5.99",
      period: "per month",
      description: "Great for students and casual writers",
      features: [
        "5,000 words per month",
        "500 words per request",
        "All 4 tone options", 
        "Bypass all AI detectors (incl. Turnitin & GPTZero)",
        "Basic Humanization Engine",
        "Plagiarism-free",
        "Error-free rewriting",
        "Undetectable results",
        "Unlimited AI detection",
        "20 languages supported"
      ],
      buttonText: "Choose Basic",
      popular: false
    },
    {
      name: "Pro",
      price: "$18.99",
      period: "per month",
      description: "Perfect for professionals and content creators",
      features: [
        "15,000 words per month",
        "1,500 words per request",
        "All 4 tone options",
        "My Writing Style",
        "Bypass all AI detectors (incl. Turnitin & GPTZero)",
        "Advanced Humanization Engine",
        "Plagiarism-free",
        "Error-free rewriting",
        "Undetectable results", 
        "Unlimited AI detection",
        "50+ languages supported",
        "Advanced Turnitin Bypass Engine",
        "Human-like results",
        "Unlimited grammar checks",
        "Fast mode",
        "Chrome Extension"
      ],
      buttonText: "Choose Pro",
      popular: true
    },
    {
      name: "Ultra",
      price: "$38.99",
      period: "per month",
      description: "For teams and heavy users",
      features: [
        "30,000 words per month",
        "3,000 words per request",
        "All 4 tone options",
        "My Writing Style", 
        "Bypass all AI detectors (incl. Turnitin & GPTZero)",
        "Advanced Humanization Engine",
        "Plagiarism-free",
        "Error-free rewriting",
        "Undetectable results",
        "Unlimited AI detection",
        "50+ languages supported",
        "Advanced Turnitin Bypass Engine",
        "Human-like results",
        "Unlimited grammar checks",
        "Fast mode",
        "Ultra-human writing output",
        "Priority support",
        "Chrome Extension"
      ],
      buttonText: "Choose Ultra",
      popular: false
    }
  ];

  return (
    <section id="pricing" className="py-16 bg-feature-bg">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Choose the plan that works best for you
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <Card key={index} className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}>
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                <CardDescription className="text-sm">{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground ml-1">/{plan.period}</span>
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