import { Brain, BookOpen, TrendingUp, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const WhySapienWriteWorks = () => {
  const credentials = [
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

        <div className="grid md:grid-cols-3 gap-6 mb-16">
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

      </div>
    </section>
  );
};