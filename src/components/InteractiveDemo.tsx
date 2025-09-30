import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap } from "lucide-react";

export const InteractiveDemo = () => {
  const [activeDemo, setActiveDemo] = useState(0);
  const [activeTone, setActiveTone] = useState(0);

  const demoTexts = [
    {
      category: "Academic Essay",
      before: "Artificial intelligence systems utilize machine learning algorithms to process data and generate outputs that mimic human cognitive functions. These systems are increasingly prevalent in various industries and applications.",
      after: "AI systems harness machine learning to analyze data and create results that mirror how humans think. You'll find these technologies becoming more common across different fields and uses.",
      improvement: "85% → 2%"
    },
    {
      category: "Business Email", 
      before: "I am writing to inform you about the upcoming meeting scheduled for next week. Please confirm your attendance so we can finalize the agenda and allocate appropriate resources.",
      after: "Just wanted to touch base about next week's meeting. Could you let me know if you can make it? This will help me sort out the agenda and make sure we have everything ready.",
      improvement: "78% → 0%"
    },
    {
      category: "Blog Post",
      before: "Content marketing represents a strategic approach focused on creating and distributing valuable, relevant content to attract and retain a clearly defined audience and drive profitable customer action.",
      after: "Content marketing is all about creating stuff your audience actually wants to read. When you consistently share valuable insights, you build trust and turn readers into customers naturally.",
      improvement: "92% → 1%"
    }
  ];

  const toneExamples = [
    {
      tone: "Regular",
      text: "The project deadline has been moved to next Friday. Please adjust your schedules accordingly and let me know if you have any concerns.",
      color: "bg-blue-500"
    },
    {
      tone: "Sarcastic", 
      text: "Oh wonderful, they've graciously moved our deadline to next Friday. Because clearly, we had nothing better to do than wait around for their decision.",
      color: "bg-purple-500"
    },
    {
      tone: "Funny",
      text: "Plot twist alert! The deadline has taken a spontaneous vacation and decided to show up next Friday instead. Our calendars are having an identity crisis right now!",
      color: "bg-orange-500"
    },
    {
      tone: "Smart",
      text: "Following a comprehensive review of project parameters and resource allocation, the submission timeline has been strategically recalibrated to optimize deliverable quality by next Friday.",
      color: "bg-green-500"
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-slate-50/50 to-blue-50/50 dark:from-slate-950/50 dark:to-blue-950/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            See the Magic in Action
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Watch AI-generated text transform into authentic, human-sounding content. 
            Real examples, real results, instant transformation.
          </p>
        </div>

        {/* Before/After Demo */}
        <div className="mb-20">
          <div className="flex justify-center mb-8">
            <div className="flex bg-background rounded-full p-1 shadow-lg">
              {demoTexts.map((demo, index) => (
                <Button
                  key={index}
                  variant={activeDemo === index ? "default" : "ghost"}
                  className="rounded-full px-6"
                  onClick={() => setActiveDemo(index)}
                >
                  {demo.category}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Before */}
            <Card className="relative border-2 border-red-200 dark:border-red-800">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                  <span className="text-red-600 dark:text-red-400">Before: AI-Generated</span>
                  <Badge variant="destructive" className="text-sm">
                    {demoTexts[activeDemo].improvement.split(' → ')[0]} AI Detected
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed text-lg">
                  {demoTexts[activeDemo].before}
                </p>
              </CardContent>
            </Card>

            {/* Arrow */}
            <div className="flex items-center justify-center lg:absolute lg:left-1/2 lg:transform lg:-translate-x-1/2 lg:z-10">
              <div className="bg-primary text-primary-foreground rounded-full p-4 shadow-lg">
                <ArrowRight className="w-6 h-6" />
              </div>
            </div>

            {/* After */}
            <Card className="relative border-2 border-green-200 dark:border-green-800">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                  <span className="text-green-600 dark:text-green-400">After: SapienWrite</span>
                  <Badge className="bg-green-500 text-white text-sm">
                    {demoTexts[activeDemo].improvement.split(' → ')[1]} AI Detected
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed text-lg">
                  {demoTexts[activeDemo].after}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tone Examples */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-foreground mb-4">
              Four Distinct Tones, Infinite Possibilities
            </h3>
            <p className="text-lg text-muted-foreground">
              Same message, different personality. Choose the tone that fits your audience.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {toneExamples.map((example, index) => (
              <Button
                key={index}
                variant={activeTone === index ? "default" : "outline"}
                className={`h-auto p-4 text-left justify-start ${activeTone === index ? example.color : ''}`}
                onClick={() => setActiveTone(index)}
              >
                <div>
                  <div className="font-semibold mb-1">{example.tone}</div>
                  <div className="text-xs opacity-80">Click to see example</div>
                </div>
              </Button>
            ))}
          </div>

          <Card className="bg-gradient-to-r from-card to-card/50 border-2">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className={`w-3 h-3 rounded-full mt-2 ${toneExamples[activeTone].color}`}></div>
                <div>
                  <h4 className="text-xl font-semibold text-foreground mb-3">
                    {toneExamples[activeTone].tone} Tone
                  </h4>
                  <p className="text-lg text-foreground leading-relaxed">
                    "{toneExamples[activeTone].text}"
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-16">
          <Button size="lg" className="px-8 py-4 text-lg">
            <Zap className="w-5 h-5 mr-2" />
            Try It Yourself - Free
          </Button>
        </div>
      </div>
    </section>
  );
};