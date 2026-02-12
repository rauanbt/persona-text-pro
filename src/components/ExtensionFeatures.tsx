import { Card, CardContent } from "@/components/ui/card";
import { MousePointerClick, Languages, Globe } from "lucide-react";

export const ExtensionFeatures = () => {
  const features = [
    {
      icon: <MousePointerClick className="w-8 h-8 text-primary" />,
      title: "Right-Click Humanize",
      description: "Select any AI-generated text, right-click, and instantly humanize it without leaving the page.",
    },
    {
      icon: <Languages className="w-8 h-8 text-primary" />,
      title: "Multiple Tones",
      description: "Choose from 6 tone personalities — Regular, Casual, Formal, Funny, Sarcastic, or Smart.",
    },
    {
      icon: <Globe className="w-8 h-8 text-primary" />,
      title: "Works Everywhere",
      description: "Gmail, LinkedIn, Google Docs, ChatGPT, and any website where you write or paste text.",
    },
  ];

  return (
    <section className="py-20 bg-feature-bg">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-12">
          How It Works
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <Card key={i} className="text-center border-2 hover:shadow-lg transition-shadow">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="flex justify-center mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
