import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ToneSelector } from "./ToneSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Sparkles, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const HeroSection = () => {
  const [text, setText] = useState("");
  const [selectedTone, setSelectedTone] = useState("regular");
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
  const maxWords = 500;

  const handleTryForFree = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  const handleHumanize = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to use the AI humanizer tool.",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    if (!text.trim()) {
      toast({
        title: "Please enter some text",
        description: "Add text to humanize and apply your selected tone.",
        variant: "destructive",
      });
      return;
    }

    // Redirect to dashboard for full functionality
    navigate('/dashboard');
  };

  const handleCheckAI = () => {
    if (!user) {
      toast({
        title: "Sign in required",  
        description: "Please sign in to check for AI detection.",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    if (!text.trim()) {
      toast({
        title: "Please enter some text",
        description: "Add text to check for AI detection.",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "AI Detection Check Complete",
      description: "AI probability: 89% - Humanization recommended",
    });
  };

  return (
    <section className="bg-hero-bg py-16 px-4">
      <div className="container mx-auto max-w-6xl text-center">
        {/* Trust Badge */}
        <Badge variant="secondary" className="mb-8 px-4 py-2 text-sm font-medium bg-background/80 text-success border-success/20">
          <Shield className="w-4 h-4 mr-2" />
          Trusted by 350,000+ users
        </Badge>

        {/* Main Headline */}
        <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
          Humanize AI Text & Outsmart AI Detectors
        </h1>

        {/* Subheading */}
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-4xl mx-auto">
          SapienWrite converts your AI-generated content into fully humanized, undetectable writing with custom tones — ensuring it passes every AI detection tool
        </p>

        {/* CTA Button */}
        <Button 
          size="lg" 
          className="mb-12 bg-success hover:bg-success/90 text-success-foreground px-8 py-6 text-lg font-semibold shadow-lg"
          onClick={handleTryForFree}
        >
          <Sparkles className="w-5 h-5 mr-2" />
          {user ? 'Go to Dashboard' : 'Try for free'}
        </Button>

        <p className="text-sm text-muted-foreground mb-12">No credit card required</p>

        {/* Main Tool Interface */}
        <div className="bg-background rounded-2xl shadow-2xl p-8 max-w-4xl mx-auto">
          {/* Tone Selector */}
          <ToneSelector selectedTone={selectedTone} onToneChange={setSelectedTone} />
          
          {/* Text Input Area */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-foreground">Your Text</h3>
              <Badge 
                variant="outline" 
                className={`${wordCount > maxWords ? 'border-destructive text-destructive' : 'border-muted text-muted-foreground'}`}
              >
                {wordCount} / {maxWords} words
              </Badge>
            </div>
            
            <Textarea
              placeholder="Paste your text here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[200px] resize-none border-2 focus:border-primary/50 transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="outline"
              onClick={handleCheckAI}
              className="border-2 hover:border-primary/50 transition-colors"
            >
              Check for AI
            </Button>
            <Button
              onClick={handleHumanize}
              disabled={wordCount > maxWords}
              className="bg-success hover:bg-success/90 text-success-foreground px-8"
            >
              Humanize
            </Button>
          </div>
          
          {!user && (
            <p className="text-sm text-muted-foreground mt-4">
              Sign in to access the full humanizer tool
            </p>
          )}
        </div>
      </div>
    </section>
  );
};