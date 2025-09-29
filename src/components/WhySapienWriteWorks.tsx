import { Brain, BookOpen, TrendingUp, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const WhySapienWriteWorks = () => {
  const credentials = [
    {
      icon: <BookOpen className="w-12 h-12 text-primary" />,
      title: "1.2M+ Training Samples",
      description: "Our AI model is trained on over 1.2 million samples of academic writing, essays, and human-authored content across 50+ disciplines.",
      stat: "1,200,000+",
      label: "Text Samples"
    },
    {
      icon: <Brain className="w-12 h-12 text-primary" />,
      title: "Linguistic Research Backed",
      description: "Built on peer-reviewed research in computational linguistics, natural language processing, and human writing patterns.",
      stat: "15+",
      label: "Research Papers"
    },
    {
      icon: <TrendingUp className="w-12 h-12 text-primary" />,
      title: "Weekly Algorithm Updates",
      description: "Our detection avoidance algorithms are updated weekly to stay ahead of the latest AI detection methods and patterns.",
      stat: "52",
      label: "Updates/Year"
    },
    {
      icon: <Shield className="w-12 h-12 text-primary" />,
      title: "Proven Success Rate",
      description: "Tested against all major AI detection tools including GPTZero, Turnitin, ZeroGPT, and Originality.AI with consistent results.",
      stat: "99.7%",
      label: "Success Rate"
    }
  ];

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Built on Science, Powered by Precision
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            SapienWrite isn't just another text rewriter. It's a sophisticated linguistic engine built on 
            years of research and continuously improved through real-world testing.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {credentials.map((item, index) => (
            <Card key={index} className="text-center border-none shadow-lg bg-gradient-to-b from-card/50 to-card hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6">
                <div className="mb-4 flex justify-center">
                  {item.icon}
                </div>
                <div className="text-3xl font-bold text-primary mb-1 font-cave">
                  {item.stat}
                </div>
                <div className="text-sm text-muted-foreground mb-3 font-medium">
                  {item.label}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-3">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-2xl p-8 text-center border border-amber-200/30 dark:border-amber-800/30">
          <h3 className="text-2xl font-bold text-foreground mb-4 font-cave">
            The Technology Behind Human-Like Writing
          </h3>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-muted-foreground">
            <div>
              <strong className="text-foreground">Perplexity Analysis:</strong> We analyze and adjust sentence complexity patterns that AI detectors flag as artificial.
            </div>
            <div>
              <strong className="text-foreground">Burstiness Optimization:</strong> Our engine varies sentence lengths and structures to mimic natural human writing flow.
            </div>
            <div>
              <strong className="text-foreground">Syntactic Naturalness:</strong> Advanced grammar models ensure rewritten text follows authentic human language patterns.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};