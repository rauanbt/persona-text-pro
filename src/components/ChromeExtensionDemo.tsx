import { MousePointer2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

export const ChromeExtensionDemo = () => {
  const tones = [
    { name: "Regular", description: "Natural, balanced tone", highlighted: false },
    { name: "Formal/Academic", description: "Professional, scholarly tone", highlighted: true },
    { name: "Persuasive/Sales", description: "Compelling, convincing tone", highlighted: false },
    { name: "Empathetic/Warm", description: "Understanding, caring tone", highlighted: false },
    { name: "Sarcastic", description: "Witty, ironic tone", highlighted: false },
    { name: "Funny", description: "Humorous, entertaining tone", highlighted: false },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            How the Chrome Extension Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Humanize any text on any website with a simple right-click
          </p>
        </div>

        {/* Main Visual Demo */}
        <div className="max-w-5xl mx-auto mb-16">
          <Card className="relative overflow-hidden shadow-2xl border-2">
            {/* Mock Browser Window */}
            <div className="bg-muted/30 border-b px-4 py-3 flex items-center gap-2">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="text-xs text-muted-foreground ml-4">example.com/document</div>
            </div>

            {/* Mock Document Content */}
            <div className="bg-card p-8 md:p-12 relative">
              <div className="prose max-w-none">
                <h3 className="text-xl font-semibold text-foreground mb-4">Sample Document</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  The research methodology employed in this investigation adheres to established academic protocols.
                </p>
                
                {/* Highlighted Text */}
                <div className="relative inline-block">
                  <p className="text-foreground leading-relaxed bg-amber-200/60 dark:bg-amber-900/40 px-2 py-1 rounded">
                    The comprehensive analysis of the data reveals significant correlations between 
                    various demographic factors and consumer behavior patterns in the digital marketplace.
                  </p>
                  
                  {/* Context Menu */}
                  <div className="absolute left-1/2 top-full mt-2 z-20 animate-in fade-in duration-300">
                    <Card className="w-64 shadow-xl border-2 bg-popover">
                      <div className="py-1">
                        <div className="px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 cursor-pointer">
                          Copy
                        </div>
                        <div className="px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 cursor-pointer">
                          Paste
                        </div>
                        <div className="border-t my-1"></div>
                        
                        {/* SapienWrite Menu Item */}
                        <div className="relative group">
                          <div className="px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 cursor-pointer flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4" />
                              <span>Humanize with SapienWrite</span>
                            </div>
                            <span className="text-xs">›</span>
                          </div>
                          
                          {/* Tone Submenu */}
                          <Card className="absolute left-full top-0 ml-1 w-72 shadow-2xl border-2 bg-popover z-30 animate-in slide-in-from-left-2 duration-200">
                            <div className="py-1">
                              {tones.map((tone, index) => (
                                <div
                                  key={index}
                                  className={`px-4 py-2.5 cursor-pointer transition-colors ${
                                    tone.highlighted
                                      ? "bg-primary/20 border-l-2 border-primary"
                                      : "hover:bg-muted/50"
                                  }`}
                                >
                                  <div className="font-medium text-sm text-foreground">
                                    {tone.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {tone.description}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </Card>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Cursor Pointer */}
                  <MousePointer2 className="absolute right-4 bottom-4 w-6 h-6 text-primary animate-pulse" />
                </div>

                <p className="text-muted-foreground leading-relaxed mt-4">
                  The findings provide valuable insights for future strategic planning.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-primary">1</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Select Text</h3>
            <p className="text-sm text-muted-foreground">
              Highlight any text on any webpage
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-primary">2</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Right-Click</h3>
            <p className="text-sm text-muted-foreground">
              Open context menu and choose SapienWrite
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-primary">3</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Pick Your Tone</h3>
            <p className="text-sm text-muted-foreground">
              Choose from 6 tones and humanize instantly
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            <a href="/chrome-extension" className="text-primary hover:underline font-medium">
              Get the Chrome Extension →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};
