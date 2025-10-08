import { Target, Sparkles, Users, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const SapienWriteDifference = () => {
  const differences = [
    {
      icon: <Target className="w-16 h-16 text-primary mb-6" />,
      title: "Purpose-Built for Detection Avoidance",
      description: "While others rewrite randomly, we specifically target the linguistic patterns that AI detectors flag. Every change serves a purpose.",
      highlight: "99.7% bypass rate across all major detectors"
    },
    {
      icon: <Sparkles className="w-16 h-16 text-primary mb-6" />,
      title: "Tone Intelligence That Actually Works", 
      description: "Four distinct writing personalities that adapt vocabulary, sentence structure, and style - not just word swapping.",
      highlight: "Professional, Casual, Academic, Conversational modes"
    },
    {
      icon: <Users className="w-16 h-16 text-primary mb-6" />,
      title: "Built by Writers, for Writers",
      description: "Created by people who understand that great writing isn't just about avoiding detection - it's about connecting with your audience.",
      highlight: "1,000+ satisfied writers worldwide"
    },
    {
      icon: <Zap className="w-16 h-16 text-primary mb-6" />,
      title: "Lightning-Fast Processing",
      description: "Get humanized text in seconds, not minutes. Our optimized engine processes up to 3,000 words per request without quality loss.",
      highlight: "Average processing time: 3-5 seconds"
    }
  ];

  const comparisons = [
    {
      feature: "AI Detection Bypass",
      sapienwrite: "99.7% success rate",
      others: "Hit or miss results",
      advantage: true
    },
    {
      feature: "Tone Options",
      sapienwrite: "4 distinct personalities",
      others: "Basic paraphrasing",
      advantage: true
    },
    {
      feature: "Processing Speed",
      sapienwrite: "3-5 seconds",
      others: "30+ seconds",
      advantage: true
    },
    {
      feature: "Text Quality",
      sapienwrite: "Maintains meaning & flow",
      others: "Often awkward phrasing",
      advantage: true
    },
    {
      feature: "Word Limits",
      sapienwrite: "Up to 3,000 words",
      others: "500-1,000 words",
      advantage: true
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            What Makes SapienWrite Different
          </h2>
        </div>

        {/* Key Differences */}
        <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto mb-20">
          {differences.map((item, index) => (
            <Card key={index} className="border-none shadow-lg bg-gradient-to-br from-card to-card/70 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-8">
                <div className="flex justify-center">
                  {item.icon}
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4 text-center">
                  {item.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-6 text-center">
                  {item.description}
                </p>
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 text-center">
                  <div className="text-primary font-semibold text-sm uppercase tracking-wide mb-1">
                    Key Advantage
                  </div>
                  <div className="text-foreground font-medium">
                    {item.highlight}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-16 bg-gradient-to-r from-amber-50/80 to-orange-50/80 dark:from-amber-950/20 dark:to-orange-950/20 rounded-2xl p-8 border border-amber-200/30 dark:border-amber-800/30">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            The SapienWrite Promise
          </h3>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your content will sound authentically human, bypass all AI detectors, and preserve your original meaning. 
            <strong className="text-foreground"> Not satisfied within 3 days? Request a full refund—no questions asked.</strong>
          </p>
        </div>
      </div>
    </section>
  );
};