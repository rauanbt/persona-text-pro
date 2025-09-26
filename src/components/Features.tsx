import { Brain, Shield, Users } from "lucide-react";

export const Features = () => {
  const features = [
    {
      icon: <Brain className="w-16 h-16 text-primary mb-6" />,
      title: "Built on Science, Powered by Precision",
      description: "Our rewriting engine is trained on over 1.2 million samples of academic writing, essays, and AI-generated text. Using advanced linguistic modeling, we analyze syntax, tone, and word patterns commonly flagged by detection systems."
    },
    {
      icon: <Shield className="w-16 h-16 text-primary mb-6" />,
      title: "Tested and Proven Across All AI-Detectors", 
      description: "We test every rewrite against leading detection tools like GPTZero, Turnitin, ZeroGPT, Quillbot and more. Our system is updated weekly to adapt to new detection methods and eliminate flagged patterns like burstiness, perplexity, and unnatural phrasing."
    },
    {
      icon: <Users className="w-16 h-16 text-primary mb-6" />,
      title: "Trusted by 350,000+ Writers Worldwide",
      description: "Students polish their writing to sound more natural, marketers improve content for better engagement and SEO, and businesses send emails that feel personal — not robotic. HumanCraft AI adapts to each use case, delivering clear, human-sounding text that reads like it was written by you."
    }
  ];

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div key={index} className="text-center">
              <div className="flex justify-center">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-foreground mb-4 leading-tight">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};