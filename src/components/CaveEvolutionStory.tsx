import { ArrowRight } from "lucide-react";

export const CaveEvolutionStory = () => {
  const evolutionSteps = [
    {
      era: "30,000 BCE",
      title: "Cave Paintings",
      description: "Humans first told stories with pictures on stone walls",
      icon: "🗿"
    },
    {
      era: "3000 BCE", 
      title: "Written Language",
      description: "Scripts and symbols carried human thoughts across time",
      icon: "📜"
    },
    {
      era: "1440 CE",
      title: "Printing Press", 
      description: "Knowledge spread like wildfire across civilizations",
      icon: "📚"
    },
    {
      era: "1990s",
      title: "Digital Writing",
      description: "Computers transformed how we create and share ideas",
      icon: "💻"
    },
    {
      era: "2020s",
      title: "AI Generation",
      description: "Machines began writing, but something was missing...",
      icon: "🤖"
    },
    {
      era: "Today",
      title: "SapienWrite",
      description: "Bringing the human soul back to AI-generated text",
      icon: "✨"
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-amber-50/30 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 font-cave" style={{ color: '#8B4513' }}>
            Every Great Leap in Writing Started with Humans
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            From the first cave paintings to AI text generation, humans have always found ways to express their unique voice. 
            Now it's time to reclaim that authenticity.
          </p>
        </div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-amber-200 to-orange-300 dark:from-amber-800 dark:to-orange-700 rounded-full opacity-30"></div>
          
          <div className="space-y-16">
            {evolutionSteps.map((step, index) => (
              <div key={index} className={`flex items-center ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} flex-col gap-8`}>
                <div className={`flex-1 ${index % 2 === 0 ? 'md:text-right' : 'md:text-left'} text-center`}>
                  <div className="inline-block">
                    <div className="text-sm font-medium text-primary mb-2 tracking-wide uppercase">
                      {step.era}
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-3 font-cave">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed max-w-md mx-auto md:mx-0">
                      {step.description}
                    </p>
                  </div>
                </div>
                
                {/* Timeline node */}
                <div className="relative z-10 w-20 h-20 bg-background border-4 border-amber-200 dark:border-amber-800 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-3xl">{step.icon}</span>
                </div>
                
                <div className="flex-1 md:block hidden"></div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-16">
          <div className="inline-flex items-center gap-3 bg-background/80 backdrop-blur-sm border border-amber-200 dark:border-amber-800 rounded-full px-8 py-4 shadow-lg">
            <span className="text-lg font-semibold text-foreground font-cave">
              Your Story Continues Here
            </span>
            <ArrowRight className="w-5 h-5 text-primary animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  );
};