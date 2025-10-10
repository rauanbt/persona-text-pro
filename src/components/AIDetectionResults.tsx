import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AIDetectionResult {
  score: number;
  category: 'human' | 'mixed' | 'ai';
  confidence: 'low' | 'moderate' | 'high';
  breakdown: {
    ai_generated: number;
    mixed: number;
    human: number;
  };
  label: string;
  riskLevel: string;
}

interface AIDetectionResultsProps {
  text: string;
  onHumanize: () => void;
  status: 'checking' | 'completed' | null;
  onStatusChange: (status: 'checking' | 'completed' | null) => void;
  onScoreReceived?: (score: number) => void;
}

export const AIDetectionResults = ({ text, onHumanize, status, onStatusChange, onScoreReceived }: AIDetectionResultsProps) => {
  const [result, setResult] = useState<AIDetectionResult | null>(null);

  useEffect(() => {
    if (status !== 'checking') return;

    const checkAI = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('ai-detection-lovable', {
          body: { text }
        });

        if (error) throw error;

        if (data?.error) {
          throw new Error(data.message || 'Detection failed');
        }

        setResult({
          score: data.score,
          category: data.category,
          confidence: data.confidence,
          breakdown: data.breakdown,
          label: data.label,
          riskLevel: data.riskLevel
        });
        onStatusChange('completed');
        
        if (onScoreReceived) {
          onScoreReceived(data.score);
        }
      } catch (error: any) {
        console.error('AI detection error:', error);
        setResult(null);
        onStatusChange(null);
      }
    };

    checkAI();
  }, [status, text, onStatusChange, onScoreReceived]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'human':
        return 'from-green-500 to-emerald-600';
      case 'mixed':
        return 'from-yellow-500 to-orange-500';
      case 'ai':
        return 'from-red-500 to-pink-600';
      default:
        return 'from-gray-400 to-gray-500';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'human':
        return 'Human';
      case 'mixed':
        return 'Mixed';
      case 'ai':
        return 'AI';
      default:
        return 'Unknown';
    }
  };

  const getConfidenceText = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'highly';
      case 'low':
        return 'somewhat';
      default:
        return 'moderately';
    }
  };

  const getConfidenceMessage = () => {
    if (!result) return '';
    
    const confText = getConfidenceText(result.confidence);
    const breakdown = result.breakdown;
    
    if (result.category === 'human') {
      if (breakdown.mixed > 20) {
        return `We are ${confText} confident this text was originally human written and lightly polished by AI`;
      }
      return `We are ${confText} confident this text was human written`;
    } else if (result.category === 'ai') {
      return `We are ${confText} confident this text was AI generated`;
    } else {
      return `We are ${confText} confident this text was originally human written and edited by AI`;
    }
  };

  const allCompleted = status === 'completed';

  if (status === null) return null;

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">AI Detection Results</h3>
        {allCompleted && (
          <Badge variant="secondary" className="text-xs">
            Model v3.2
          </Badge>
        )}
      </div>

      <Card className="border-2 shadow-lg">
        <CardContent className="pt-6 space-y-6">
          {!allCompleted ? (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-4" />
              <p className="text-muted-foreground">Running advanced multi-model analysis...</p>
              <p className="text-sm text-muted-foreground/70 mt-2">This may take a few moments</p>
            </div>
          ) : result ? (
            <>
              {/* Circular Indicator */}
              <div className="flex flex-col items-center py-4">
                <div className="relative">
                  <div className={`w-40 h-40 rounded-full bg-gradient-to-br ${getCategoryColor(result.category)} p-1 shadow-2xl`}>
                    <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-foreground">
                          {result.score}%
                        </div>
                        <div className="text-sm font-semibold text-muted-foreground mt-1">
                          {getCategoryLabel(result.category)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 text-center">
                  <p className="text-sm font-medium text-foreground">{result.label}</p>
                </div>
              </div>

              {/* Confidence Message */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-center text-muted-foreground leading-relaxed">
                  {getConfidenceMessage().split(' ').map((word, i) => {
                    const isHighlight = ['human written', 'polished by AI', 'edited by AI', 'AI generated', 'lightly polished'].some(phrase => 
                      getConfidenceMessage().toLowerCase().includes(phrase.toLowerCase()) && 
                      phrase.toLowerCase().includes(word.toLowerCase())
                    );
                    
                    return isHighlight ? (
                      <TooltipProvider key={i}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="underline decoration-dotted decoration-primary/50 cursor-help">
                              {word}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs max-w-xs">
                              {word.toLowerCase().includes('human') && 'Content shows natural human writing patterns'}
                              {word.toLowerCase().includes('polished') && 'Minor AI improvements to grammar and structure'}
                              {word.toLowerCase().includes('edited') && 'Significant AI modifications to the original text'}
                              {word.toLowerCase().includes('generated') && 'Content appears to be created by AI'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span key={i}>{word} </span>
                    );
                  })}
                </p>
              </div>

              {/* Probability Breakdown Bar */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">Probability Breakdown</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-xs">
                          Analysis of content authorship based on multiple AI models
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <div className="relative h-8 rounded-full overflow-hidden bg-muted flex">
                  {/* AI Generated segment */}
                  {result.breakdown.ai_generated > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center text-xs font-semibold text-white cursor-help transition-all hover:brightness-110"
                            style={{ width: `${result.breakdown.ai_generated}%` }}
                          >
                            {result.breakdown.ai_generated >= 15 && `${result.breakdown.ai_generated}%`}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{result.breakdown.ai_generated}% AI Generated</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {/* Mixed segment */}
                  {result.breakdown.mixed > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center text-xs font-semibold text-white cursor-help transition-all hover:brightness-110"
                            style={{ width: `${result.breakdown.mixed}%` }}
                          >
                            {result.breakdown.mixed >= 15 && `${result.breakdown.mixed}%`}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{result.breakdown.mixed}% Mixed (Human + AI)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {/* Human segment */}
                  {result.breakdown.human > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center text-xs font-semibold text-white cursor-help transition-all hover:brightness-110"
                            style={{ width: `${result.breakdown.human}%` }}
                          >
                            {result.breakdown.human >= 15 && `${result.breakdown.human}%`}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{result.breakdown.human}% Human Written</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-600" />
                    <span>AI Generated: {result.breakdown.ai_generated}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500" />
                    <span>Mixed: {result.breakdown.mixed}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600" />
                    <span>Human: {result.breakdown.human}%</span>
                  </div>
                </div>
              </div>

              {/* Humanize Button - Show for mixed or ai categories */}
              {(result.category === 'mixed' || result.category === 'ai') && (
                <Button 
                  onClick={onHumanize}
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg"
                  size="lg"
                >
                  Humanize This Text
                </Button>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Important Note */}
      <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">Important Note</p>
              <p className="text-amber-800 dark:text-amber-200">
                AI detection tools are not 100% accurate and may produce false positives. These results are consensus estimates from multiple advanced AI models and should be used as a guide only.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
