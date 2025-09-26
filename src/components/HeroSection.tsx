import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ToneSelector } from "./ToneSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Sparkles, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";

export const HeroSection = () => {
  const [text, setText] = useState("");
  const [selectedTone, setSelectedTone] = useState("regular");
  const [aiDetectionResult, setAiDetectionResult] = useState<{
    probability: number;
    status: 'checking' | 'completed' | null;
  }>({ probability: 0, status: null });
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
    
    setAiDetectionResult({ probability: 0, status: 'checking' });
    
    // Simulate AI detection with random result
    setTimeout(() => {
      const probability = Math.floor(Math.random() * 30) + 70; // 70-100%
      setAiDetectionResult({ probability, status: 'completed' });
    }, 2000);
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
        <div className="bg-background rounded-2xl shadow-2xl p-8 max-w-7xl mx-auto">
          {/* Tone Selector */}
          <ToneSelector selectedTone={selectedTone} onToneChange={setSelectedTone} />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
            {/* Left Side - Text Input */}
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
                  disabled={aiDetectionResult.status === 'checking'}
                  className="border-2 hover:border-primary/50 transition-colors flex-1"
                >
                  {aiDetectionResult.status === 'checking' ? (
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

            {/* Right Side - AI Detection Results */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">AI Detection Results</h3>
              
              <Card className="min-h-[400px]">
                <CardContent className="p-6">
                  {aiDetectionResult.status === null && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h4 className="text-lg font-medium mb-2">No Analysis Yet</h4>
                      <p className="text-muted-foreground">
                        Paste your text and click "Check for AI" to see detection results
                      </p>
                    </div>
                  )}

                  {aiDetectionResult.status === 'checking' && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                      <h4 className="text-lg font-medium mb-2">Analyzing Text...</h4>
                      <p className="text-muted-foreground">
                        Running AI detection analysis
                      </p>
                    </div>
                  )}

                  {aiDetectionResult.status === 'completed' && (
                    <div className="space-y-6">
                      <div className="text-center">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 mx-auto ${
                          aiDetectionResult.probability >= 80 
                            ? 'bg-destructive/10 text-destructive' 
                            : aiDetectionResult.probability >= 50 
                              ? 'bg-yellow-500/10 text-yellow-600' 
                              : 'bg-success/10 text-success'
                        }`}>
                          {aiDetectionResult.probability >= 80 ? (
                            <AlertTriangle className="w-10 h-10" />
                          ) : (
                            <CheckCircle className="w-10 h-10" />
                          )}
                        </div>
                        <h4 className="text-2xl font-bold mb-2">{aiDetectionResult.probability}%</h4>
                        <p className="text-muted-foreground">AI Detection Probability</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Detection Level</span>
                          <span className="font-medium">
                            {aiDetectionResult.probability >= 80 ? 'High Risk' : 
                             aiDetectionResult.probability >= 50 ? 'Medium Risk' : 'Low Risk'}
                          </span>
                        </div>
                        <Progress 
                          value={aiDetectionResult.probability} 
                          className="h-3"
                        />
                      </div>

                      <div className={`p-4 rounded-lg border ${
                        aiDetectionResult.probability >= 80 
                          ? 'bg-destructive/5 border-destructive/20' 
                          : aiDetectionResult.probability >= 50 
                            ? 'bg-yellow-500/5 border-yellow-500/20' 
                            : 'bg-success/5 border-success/20'
                      }`}>
                        <h5 className="font-medium mb-2">Recommendation</h5>
                        <p className="text-sm text-muted-foreground">
                          {aiDetectionResult.probability >= 80 
                            ? 'This text is likely AI-generated. Humanization is strongly recommended.' 
                            : aiDetectionResult.probability >= 50 
                              ? 'This text may be AI-generated. Consider humanization for better results.' 
                              : 'This text appears to be human-written and should pass most AI detectors.'}
                        </p>
                      </div>

                      {aiDetectionResult.probability >= 50 && (
                        <Button 
                          onClick={handleHumanize}
                          className="w-full bg-success hover:bg-success/90 text-success-foreground"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Humanize This Text
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};