import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, BookOpen, Briefcase } from "lucide-react";

export const SuccessStories = () => {
  const stories = [
    {
      category: "Content Marketing",
      icon: <TrendingUp className="w-8 h-8 text-blue-500" />,
      user: "Sarah Chen",
      role: "Content Marketing Manager at TechFlow",
      before: "92% AI Detection",
      after: "0% AI Detection", 
      metric: "300% increase in engagement",
      challenge: "Our AI-generated blog posts were getting flagged and hurting our SEO rankings.",
      solution: "SapienWrite's Professional tone transformed our content to sound genuinely human while maintaining our brand voice.",
      quote: "SapienWrite saved our content strategy. Our posts now pass all AI detectors and our organic traffic has tripled.",
      timeframe: "Within 2 weeks"
    },
    {
      category: "Academic Writing",
      icon: <BookOpen className="w-8 h-8 text-green-500" />,
      user: "Marcus Rodriguez",
      role: "Graduate Student, Stanford University",
      before: "78% AI Detection",
      after: "1% AI Detection",
      metric: "Thesis approved on first submission",
      challenge: "My research drafts kept triggering university AI detection systems despite being my original work.",
      solution: "Used SapienWrite's Academic tone to refine my writing style and eliminate false positives.",
      quote: "Finally submitted my thesis without AI detection fears. The Academic tone made my writing more polished.",
      timeframe: "3 days"
    },
    {
      category: "Business Communications", 
      icon: <Briefcase className="w-8 h-8 text-purple-500" />,
      user: "Jennifer Walsh",
      role: "Sales Director at CloudSync",
      before: "85% AI Detection",
      after: "0% AI Detection",
      metric: "45% higher response rates",
      challenge: "Our AI-assisted emails sounded robotic and weren't getting responses from potential clients.",
      solution: "SapienWrite's Conversational tone made our outreach feel personal and authentic.",
      quote: "Our email response rates doubled. Clients actually respond because our messages sound human now.",
      timeframe: "1 week"
    }
  ];

  const aggregateStats = [
    {
      number: "350,000+",
      label: "Active Writers",
      icon: <Users className="w-6 h-6 text-primary" />
    },
    {
      number: "99.7%",
      label: "Success Rate",
      icon: <TrendingUp className="w-6 h-6 text-primary" />
    },
    {
      number: "50M+",
      label: "Words Humanized",
      icon: <BookOpen className="w-6 h-6 text-primary" />
    },
    {
      number: "< 5 sec",
      label: "Avg. Processing",
      icon: <Briefcase className="w-6 h-6 text-primary" />
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-slate-50/50 to-blue-50/50 dark:from-slate-950/50 dark:to-blue-950/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Real Results from Real Users
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Don't just take our word for it. See how SapienWrite has transformed writing workflows 
            across industries and helped creators achieve their goals.
          </p>
        </div>

        {/* Aggregate Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-20 max-w-4xl mx-auto">
          {aggregateStats.map((stat, index) => (
            <Card key={index} className="text-center border-none shadow-lg bg-background/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex justify-center mb-3">
                  {stat.icon}
                </div>
                <div className="text-3xl font-bold text-primary font-cave mb-1">
                  {stat.number}
                </div>
                <div className="text-sm text-muted-foreground font-medium">
                  {stat.label}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Success Stories */}
        <div className="space-y-12">
          {stories.map((story, index) => (
            <Card key={index} className={`overflow-hidden shadow-xl border-none ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} flex flex-col md:flex`}>
              <div className="md:w-1/3 bg-gradient-to-br from-card to-muted/20 p-8 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-4">
                  {story.icon}
                  <Badge variant="outline" className="text-sm">
                    {story.category}
                  </Badge>
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  {story.user}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {story.role}
                </p>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <span className="text-sm font-medium">Before:</span>
                    <Badge variant="destructive" className="text-xs">
                      {story.before}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <span className="text-sm font-medium">After:</span>
                    <Badge className="bg-green-500 text-white text-xs">
                      {story.after}
                    </Badge>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg text-center">
                    <div className="text-primary font-semibold text-lg">
                      {story.metric}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {story.timeframe}
                    </div>
                  </div>
                </div>
              </div>
              
              <CardContent className="md:w-2/3 p-8 flex flex-col justify-center">
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-foreground mb-2">The Challenge</h4>
                  <p className="text-muted-foreground mb-4">
                    {story.challenge}
                  </p>
                  
                  <h4 className="text-lg font-semibold text-foreground mb-2">The Solution</h4>
                  <p className="text-muted-foreground mb-6">
                    {story.solution}
                  </p>
                </div>
                
                <blockquote className="border-l-4 border-primary pl-6 italic text-lg text-foreground leading-relaxed">
                  "{story.quote}"
                </blockquote>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-16 bg-background/80 backdrop-blur-sm rounded-2xl p-8 border shadow-lg">
          <h3 className="text-2xl font-bold text-foreground mb-4 font-cave">
            Ready to Join Thousands of Successful Writers?
          </h3>
          <p className="text-lg text-muted-foreground mb-6">
            Start your journey with SapienWrite today. No credit card required to begin.
          </p>
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <span>✓ Free 1,500 words monthly</span>
            <span>•</span>
            <span>✓ All tone options included</span>
            <span>•</span>
            <span>✓ No setup required</span>
          </div>
        </div>
      </div>
    </section>
  );
};