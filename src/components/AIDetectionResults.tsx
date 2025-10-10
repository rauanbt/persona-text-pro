import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, Info, ChevronDown, ChevronUp } from "lucide-react";
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
  const [showDetails, setShowDetails] = useState(false);
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    if (status === 'checking' && !hasRequestedRef.current) {
      hasRequestedRef.current = true;
      
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
    }
    
    if (status !== 'checking') {
      hasRequestedRef.current = false;
    }
  }, [status, text]);

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
    const aiScore = Math.round(result.score);
    
    return `We are ${confText} confident this text has a ${aiScore}% AI likelihood (combining AI-generated and AI-edited content)`;
  };

  const allCompleted = status === 'completed';

  if (status === null) return null;

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">AI Detection Results</h3>
        {allCompleted && (
          <Badge variant="secondary" className="text-xs">
            Model v3.2 • Final average from 3 engines
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
                          {Math.round(result.score)}%
                        </div>
                        <div className="text-sm font-semibold text-muted-foreground mt-1">
                          AI Likelihood
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 text-center">
                  <p className="text-sm font-medium text-foreground">{result.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">Category: {getCategoryLabel(result.category)}</p>
                </div>
              </div>

              {/* Confidence Message */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-center text-muted-foreground leading-relaxed">
                  {getConfidenceMessage()}
                </p>
              </div>

              {/* Simple AI vs Human Bar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">AI vs Human Content</p>
                </div>
                
                <div className="relative h-8 rounded-full overflow-hidden bg-muted flex">
                  {/* AI Total segment */}
                  {Math.round(result.score) > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center text-xs font-semibold text-white cursor-help transition-all hover:brightness-110"
                            style={{ width: `${Math.round(result.score)}%` }}
                          >
                            {Math.round(result.score) >= 10 && `${Math.round(result.score)}%`}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{Math.round(result.score)}% AI Content</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {/* Human segment */}
                  {(100 - Math.round(result.score)) > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center text-xs font-semibold text-white cursor-help transition-all hover:brightness-110"
                            style={{ width: `${100 - Math.round(result.score)}%` }}
                          >
                            {(100 - Math.round(result.score)) >= 10 && `${100 - Math.round(result.score)}%`}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{100 - Math.round(result.score)}% Human Content</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-600" />
                    <span>AI: {Math.round(result.score)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600" />
                    <span>Human: {100 - Math.round(result.score)}%</span>
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Toggle */}
              <div className="border-t pt-4">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center justify-between w-full text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  <span>Show detailed breakdown</span>
                  {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {showDetails && (
                  <div className="mt-4 space-y-3 animate-in slide-in-from-top duration-300">
                    <p className="text-xs text-muted-foreground">
                      AI likelihood is calculated from AI-generated + Mixed content
                    </p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-600" />
                          <span>AI Generated</span>
                        </div>
                        <span className="font-medium">{Math.round(result.breakdown.ai_generated)}%</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500" />
                          <span>Mixed (AI-edited human)</span>
                        </div>
                        <span className="font-medium">{Math.round(result.breakdown.mixed)}%</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600" />
                          <span>Human Written</span>
                        </div>
                        <span className="font-medium">{Math.round(result.breakdown.human)}%</span>
                      </div>
                    </div>
                  </div>
                )}
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
