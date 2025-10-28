import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, GraduationCap, Linkedin, Mail, MessageSquare } from "lucide-react";

export const UseCasesDemo = () => {
  const [activeUseCase, setActiveUseCase] = useState(0);

  const useCases = [
    {
      id: "blog",
      icon: <FileText className="w-6 h-6" />,
      label: "Blog Post",
      title: "Travel Blog Article",
      mockup: (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl p-8 max-w-3xl mx-auto border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60" />
            <div>
              <div className="font-semibold text-foreground">Travel Adventures Blog</div>
              <div className="text-sm text-muted-foreground">Published May 15, 2025</div>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Hidden Gems of Southeast Asia
          </h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Last summer, I stumbled upon a tiny village in northern Vietnam that completely changed how I think about travel. There were no tourist buses, no souvenir shops - just genuine human connection and breathtaking mountain views that made me realize why I started traveling in the first place.
            </p>
            <p>
              The locals welcomed me with warm smiles and homemade rice wine, sharing stories about their families and traditions. These authentic moments, away from the typical tourist trail, reminded me that the best travel experiences often happen when you venture off the beaten path.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center gap-4 text-sm text-muted-foreground">
            <span>❤️ 234 likes</span>
            <span>💬 45 comments</span>
            <span>🔖 Save</span>
          </div>
        </div>
      )
    },
    {
      id: "academic",
      icon: <GraduationCap className="w-6 h-6" />,
      label: "Academic Essay",
      title: "University Research Paper",
      mockup: (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl p-12 max-w-3xl mx-auto border border-slate-200 dark:border-slate-700">
          <div className="text-center mb-8 pb-6 border-b-2 border-slate-300 dark:border-slate-600">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              The Impact of Climate Change on Coastal Ecosystems
            </h1>
            <p className="text-sm text-muted-foreground">
              Sarah Mitchell | Environmental Science 402 | Spring 2025
            </p>
          </div>
          
          <div className="space-y-4 text-muted-foreground leading-relaxed font-serif">
            <h3 className="text-xl font-semibold text-foreground mb-3">Introduction</h3>
            <p className="indent-8">
              Coastal ecosystems face unprecedented challenges as global temperatures continue to rise. Recent studies indicate that coral reefs, mangrove forests, and tidal wetlands are experiencing significant degradation at rates that exceed previous scientific projections. This research examines the multifaceted consequences of climate change on these critical marine environments.
            </p>
            <p className="indent-8">
              The relationship between atmospheric carbon dioxide levels and ocean acidification has become increasingly evident through longitudinal studies conducted over the past two decades. Understanding these dynamics is essential for developing effective conservation strategies that can mitigate further ecosystem decline.
            </p>
          </div>
          
          <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-700 text-xs text-muted-foreground">
            Page 1 of 15
          </div>
        </div>
      )
    },
    {
      id: "linkedin",
      icon: <Linkedin className="w-6 h-6" />,
      label: "LinkedIn Post",
      title: "Professional Update",
      mockup: (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl p-6 max-w-2xl mx-auto border border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold">
              JD
            </div>
            <div className="flex-1">
              <div className="font-semibold text-foreground">Jessica Davis</div>
              <div className="text-sm text-muted-foreground">Marketing Director at TechStart Inc.</div>
              <div className="text-xs text-muted-foreground">2h • 🌎</div>
            </div>
          </div>
          
          <div className="text-muted-foreground leading-relaxed space-y-3 mb-4">
            <p>
              Really excited to share that our team just launched a campaign that's been months in the making! 🚀
            </p>
            <p>
              What I've learned from this project: authentic storytelling beats flashy gimmicks every single time. Our customers don't want to be sold to - they want to connect with brands that genuinely understand their challenges.
            </p>
            <p>
              Huge thanks to everyone who contributed. This kind of work doesn't happen without collaboration and trust. 💡
            </p>
          </div>
          
          <div className="flex items-center gap-6 pt-4 border-t border-slate-200 dark:border-slate-700 text-sm text-muted-foreground">
            <button className="hover:text-primary transition-colors">👍 Like</button>
            <button className="hover:text-primary transition-colors">💬 Comment</button>
            <button className="hover:text-primary transition-colors">🔄 Repost</button>
            <button className="hover:text-primary transition-colors">📤 Send</button>
          </div>
        </div>
      )
    },
    {
      id: "email",
      icon: <Mail className="w-6 h-6" />,
      label: "Business Email",
      title: "Professional Communication",
      mockup: (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl max-w-3xl mx-auto border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="bg-slate-100 dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-sm font-medium text-muted-foreground">From:</div>
              <div className="text-sm text-foreground">alex.thompson@company.com</div>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="text-sm font-medium text-muted-foreground">To:</div>
              <div className="text-sm text-foreground">client@business.com</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-muted-foreground">Subject:</div>
              <div className="text-sm font-semibold text-foreground">Q2 Project Timeline Update</div>
            </div>
          </div>
          
          <div className="p-8 space-y-4 text-muted-foreground leading-relaxed">
            <p>Hi Michael,</p>
            <p>
              I wanted to give you a quick update on where we stand with the Q2 deliverables. We've made solid progress on the initial design phase and are currently ahead of schedule, which is always nice to report!
            </p>
            <p>
              That said, I think it would be valuable to schedule a brief call next week to align on the final specifications. There are a few details I'd like to clarify to make sure we're delivering exactly what you envision.
            </p>
            <p>
              Would Tuesday or Thursday afternoon work for you? I'm flexible on timing and happy to work around your schedule.
            </p>
            <p>Looking forward to hearing from you,</p>
            <p className="text-foreground font-medium">
              Alex Thompson<br />
              <span className="text-sm text-muted-foreground">Senior Project Manager</span>
            </p>
          </div>
        </div>
      )
    },
    {
      id: "social",
      icon: <MessageSquare className="w-6 h-6" />,
      label: "Social Media",
      title: "Engaging Social Post",
      mockup: (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl p-6 max-w-xl mx-auto border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
            <div>
              <div className="font-semibold text-foreground">@creativemind</div>
              <div className="text-xs text-muted-foreground">2 hours ago</div>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="aspect-video bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white text-2xl font-bold">
              Creative Content
            </div>
          </div>
          
          <div className="text-muted-foreground leading-relaxed mb-4">
            <p>
              Sometimes the best ideas come when you're not even trying to think of them. 💭✨
            </p>
            <p className="mt-2">
              I was just making coffee this morning when suddenly everything clicked about that project I've been stuck on for weeks. Funny how the brain works, right?
            </p>
            <p className="mt-2 text-primary">#CreativeProcess #MondayMotivation #ContentCreator</p>
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700 text-sm text-muted-foreground">
            <div className="flex gap-4">
              <button className="hover:text-red-500 transition-colors">❤️ 1.2K</button>
              <button className="hover:text-primary transition-colors">💬 89</button>
              <button className="hover:text-primary transition-colors">🔄 234</button>
            </div>
            <button className="hover:text-primary transition-colors">🔖</button>
          </div>
        </div>
      )
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-background via-slate-50/50 dark:via-slate-950/50 to-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Your Writing, Everywhere It Matters
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            See how humanized text fits naturally into real-world contexts. From professional emails to academic papers, 
            your content will sound authentic wherever it's published.
          </p>
        </div>

        {/* Use Case Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {useCases.map((useCase, index) => (
            <Button
              key={useCase.id}
              variant={activeUseCase === index ? "default" : "outline"}
              size="lg"
              onClick={() => setActiveUseCase(index)}
              className="gap-2"
            >
              {useCase.icon}
              {useCase.label}
            </Button>
          ))}
        </div>

        {/* Active Mockup Display */}
        <div className="mb-12">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-foreground mb-2">
              {useCases[activeUseCase].title}
            </h3>
            <p className="text-muted-foreground">
              Humanized content that resonates with your audience
            </p>
          </div>
          
          <div className="animate-in fade-in duration-500">
            {useCases[activeUseCase].mockup}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Card className="inline-block border-none shadow-lg bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Ready to Transform Your Writing?
              </h3>
              <p className="text-muted-foreground mb-6 max-w-xl">
                Join thousands of writers who use SapienWrite to create authentic, human-sounding content 
                that passes AI detection and connects with readers.
              </p>
              <Button size="lg" className="text-lg px-8">
                Try SapienWrite Free
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                500 free words monthly • No credit card required
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};