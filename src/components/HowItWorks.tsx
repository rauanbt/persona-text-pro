import { FileText, Search, Wand2 } from "lucide-react";

export const HowItWorks = () => {
  const steps = [
    {
      step: "Step 1",
      title: "Paste Your Text",
      description: "Paste any content — homework, assignment, or AI-generated draft",
      icon: <FileText className="w-12 h-12 text-primary" />
    },
    {
      step: "Step 2", 
      title: "Choose Your Tone",
      description: "Select from Regular, Funny, Sarcastic, or Smart tone options",
      icon: <Search className="w-12 h-12 text-primary" />
    },
    {
      step: "Step 3",
      title: "Humanize",
      description: "Rewrite your text to sound 100% human-written with your chosen tone",
      icon: <Wand2 className="w-12 h-12 text-primary" />
    }
  ];

  return (
    <section className="py-16 bg-feature-bg">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Humanize AI Writing in 3 Simple Steps
          </h2>
          <p className="text-lg text-muted-foreground">
            Perfect for essays, assignments, blog posts and research papers
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="text-center">
              <div className="mb-6 flex justify-center">
                <div className="bg-background rounded-2xl p-6 shadow-lg">
                  {step.icon}
                </div>
              </div>
              <div className="text-sm font-medium text-primary mb-2">
                {step.step}
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">
                {step.title}
              </h3>
              <p className="text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};