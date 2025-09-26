import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

export const Pricing = () => {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Perfect for trying out our service",
      features: [
        "500 words per month",
        "All 4 tone options",
        "Basic AI detection bypass",
        "Email support"
      ],
      buttonText: "Start Free",
      popular: false
    },
    {
      name: "Basic",
      price: "$8",
      period: "per month", 
      description: "Great for students and casual writers",
      features: [
        "10,000 words per month",
        "All 4 tone options",
        "Advanced AI detection bypass",
        "Priority email support",
        "Export to multiple formats"
      ],
      buttonText: "Choose Basic",
      popular: false
    },
    {
      name: "Pro",
      price: "$19",
      period: "per month",
      description: "Perfect for professionals and content creators",
      features: [
        "50,000 words per month",
        "All 4 tone options",
        "Premium AI detection bypass",
        "24/7 chat support",
        "Export to multiple formats",
        "API access",
        "Bulk processing"
      ],
      buttonText: "Choose Pro",
      popular: true
    },
    {
      name: "Enterprise",
      price: "$49",
      period: "per month",
      description: "For teams and heavy users",
      features: [
        "200,000 words per month",
        "All 4 tone options", 
        "Enterprise AI detection bypass",
        "Dedicated account manager",
        "Custom integrations",
        "Advanced API access",
        "Team management",
        "Custom tone training"
      ],
      buttonText: "Choose Enterprise",
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