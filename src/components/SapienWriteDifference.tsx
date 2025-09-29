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
      highlight: "350,000+ satisfied writers worldwide"
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
            Why 350,000+ Writers Choose SapienWrite
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            It's not just about bypassing AI detection. It's about creating content that truly sounds human, 
            resonates with your audience, and achieves your goals.
          </p>
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

        {/* Comparison Table */}
        <div className="max-w-4xl mx-auto">
          <h3 className="text-3xl font-bold text-foreground text-center mb-12">
            How We Compare to Alternatives
          </h3>
          
          <div className="bg-card rounded-2xl shadow-lg border overflow-hidden">
            <div className="grid grid-cols-3 bg-primary text-primary-foreground p-4 font-semibold">
              <div>Feature</div>
              <div className="text-center">SapienWrite</div>
              <div className="text-center">Other Tools</div>
            </div>
            
            {comparisons.map((row, index) => (
              <div key={index} className={`grid grid-cols-3 p-4 border-b border-border last:border-b-0 ${index % 2 === 0 ? 'bg-muted/20' : 'bg-background'}`}>
                <div className="font-medium text-foreground">{row.feature}</div>
                <div className="text-center">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {row.sapienwrite}
                  </span>
                </div>
                <div className="text-center">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    {row.others}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-16 bg-gradient-to-r from-amber-50/80 to-orange-50/80 dark:from-amber-950/20 dark:to-orange-950/20 rounded-2xl p-8 border border-amber-200/30 dark:border-amber-800/30">
          <h3 className="text-2xl font-bold text-foreground mb-4 font-cave">
            The SapienWrite Promise
          </h3>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your writing will sound authentically human, bypass all AI detectors, and maintain the exact meaning you intended. 
            If it doesn't work, we'll refund your subscription - no questions asked.
          </p>
        </div>
      </div>
    </section>
  );
};