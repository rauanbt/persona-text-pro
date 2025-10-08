import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ToneSelector } from "./ToneSelector";
import { AIDetectionResults } from "./AIDetectionResults";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Sparkles, Shield, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import caveIllustration from "@/assets/cave-writing-illustration.webp";

export const HeroSection = () => {
  const [text, setText] = useState("");
  const [selectedTone, setSelectedTone] = useState("regular");
  const [aiDetectionStatus, setAiDetectionStatus] = useState<'checking' | 'completed' | null>(null);
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
    if (!text.trim()) {
      toast({
        title: "Please enter some text",
        description: "Add text to check for AI detection.",
        variant: "destructive",
      });
      return;
    }
    
    setAiDetectionStatus('checking');
  };

  return (
    <section className="bg-hero-bg py-16 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Trust Badge - Centered */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="px-4 py-2 text-sm font-medium bg-background/80 text-success border-success/20">
            <Shield className="w-4 h-4 mr-2" />
            Trusted by 1,000+ users
          </Badge>
        </div>

        {/* Hero Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="text-center lg:text-left">
            {/* Main Headline */}
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Humanize AI Text
            </h1>

            {/* Subheading */}
          <p className="text-lg md:text-xl text-muted-foreground mb-8">
            SapienWrite converts your AI-generated content into fully humanized, undetectable writing with custom tones - ensuring it passes every AI detection tool
          </p>

            {/* Em-dash humor */}
            <p className="text-sm md:text-base text-muted-foreground/80 mb-8 italic">
              Fun fact: We don't use those suspiciously perfect em-dashes — like this one — that scream "AI wrote this!" We stick to good old-fashioned hyphens and the occasional comma splice, like a real human would write.
            </p>

            {/* CTA Button */}
            <Button 
              size="lg" 
              className="mb-6 bg-success hover:bg-success/90 text-success-foreground px-8 py-6 text-lg font-semibold shadow-lg"
              onClick={handleTryForFree}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {user ? 'Go to Dashboard' : 'Try for free'}
            </Button>

            <p className="text-sm text-muted-foreground">No credit card required</p>
          </div>

          {/* Right Column - Cave Illustration */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              <img 
                src={caveIllustration} 
                alt="Ancient cave people writing SapienWrite on stone wall - representing the return to authentic human writing"
                className="w-full max-w-md lg:max-w-lg rounded-2xl shadow-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent rounded-2xl"></div>
            </div>
          </div>
        </div>

        {/* Main Tool Interface */}
        <div className="bg-background rounded-2xl shadow-2xl p-8 max-w-7xl mx-auto mt-16">
          {/* Tone Selector */}
          <ToneSelector selectedTone={selectedTone} onToneChange={setSelectedTone} />
          
          <div className={`grid gap-8 mt-6 transition-all duration-500 ${
            aiDetectionStatus !== null ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
          }`}>
            {/* Text Input Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Your Text</h3>
                <Badge 
                  variant="outline" 
                  className={`${wordCount > maxWords ? 'border-destructive text-destructive' : 'border-muted text-muted-foreground'}`}
                >
                  {wordCount} / {maxWords} words
                </Badge>
              </div>
              
              <Textarea
                placeholder="Paste your AI-generated text here to check for AI detection and humanize it..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[400px] resize-none border-2 focus:border-primary/50 transition-colors text-base"
              />

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={handleCheckAI}
                  disabled={aiDetectionStatus === 'checking'}
                  className="border-2 hover:border-primary/50 transition-colors flex-1"
                >
                  {aiDetectionStatus === 'checking' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Checking...
                    </>
                  ) : (
                    'Check for AI'
                  )}
                </Button>
                <Button
                  onClick={handleHumanize}
                  disabled={wordCount > maxWords}
                  className="bg-success hover:bg-success/90 text-success-foreground px-8 flex-1"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Humanize
                </Button>
              </div>
              
              {!user && (
                <p className="text-sm text-muted-foreground text-center">
                  Sign in to access the full humanizer tool
                </p>
              )}
            </div>

            {/* Enhanced AI Detection Results */}
            <AIDetectionResults
              text={text}
              onHumanize={handleHumanize}
              status={aiDetectionStatus}
              onStatusChange={setAiDetectionStatus}
            />
          </div>
        </div>
      </div>
    </section>
  );
};