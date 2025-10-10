import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AIDetector {
  id: string;
  name: string;
  icon: string;
  score: number;
  status: 'pending' | 'checking' | 'complete';
}

interface AIDetectionResultsProps {
  text: string;
  onHumanize: () => void;
  status: 'checking' | 'completed' | null;
  onStatusChange: (status: 'checking' | 'completed' | null) => void;
}

export const AIDetectionResults = ({ text, onHumanize, status, onStatusChange }: AIDetectionResultsProps) => {
  const [results, setResults] = useState<AIDetector[]>([]);
  const [overallScore, setOverallScore] = useState<number | null>(null);

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

        setOverallScore(data.score);
        setResults([{
          id: 'consensus',
          name: 'AI Detection Score',
          icon: '🤖',
          score: data.score,
          status: 'complete'
        }]);
        onStatusChange('completed');
      } catch (error: any) {
        console.error('AI detection error:', error);
        setOverallScore(null);
        onStatusChange(null);
      }
    };

    checkAI();
  }, [status, text, onStatusChange]);

  const getRiskLevel = (score: number) => {
    if (score < 30) {
      return { text: 'Human-like', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/20', icon: <TrendingDown className="w-4 h-4" /> };
    } else if (score < 70) {
      return { text: 'Medium Risk', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/20', icon: <AlertCircle className="w-4 h-4" /> };
    } else {
      return { text: 'High AI Risk', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/20', icon: <TrendingUp className="w-4 h-4" /> };
    }
  };

  const allCompleted = status === 'completed';
  const averageScore = overallScore || 0;

  if (status === null) return null;

  const riskInfo = getRiskLevel(averageScore);

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-500">
      <h3 className="text-lg font-semibold text-foreground">AI Detection Results</h3>

      <Card className="bg-gradient-to-br from-background to-muted/20 border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="text-xl">AI Detection Score</span>
            {allCompleted && (
              <Badge className={`${riskInfo.bgColor} ${riskInfo.color} border-0`}>
                {riskInfo.icon}
                <span className="ml-1">{riskInfo.text}</span>
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Triple AI engine analysis (Gemini + GPT + Claude)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!allCompleted ? (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-4" />
              <p className="text-muted-foreground">Running multi-model detection analysis...</p>
            </div>
          ) : (
            <>
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mb-4">
                  <span className="text-5xl font-bold text-foreground">{averageScore}%</span>
                </div>
                <p className="text-sm text-muted-foreground">AI Detection Probability</p>
              </div>
              
              <Progress value={averageScore} className="h-3" />
              
              <div className="bg-muted/30 rounded-lg p-4 text-sm">
                <p className="text-muted-foreground">
                  {averageScore < 30 && "Your text appears to be human-written with natural language patterns."}
                  {averageScore >= 30 && averageScore < 70 && "Your text shows some AI characteristics. Consider humanizing it for better results."}
                  {averageScore >= 70 && "Your text shows strong AI patterns. We recommend humanizing it to avoid detection."}
                </p>
              </div>

              {averageScore >= 30 && (
                <Button 
                  onClick={onHumanize}
                  className="w-full bg-success hover:bg-success/90 text-success-foreground"
                >
                  Humanize This Text
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Important Note */}
      <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 mt-6">
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
