import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Clock, Zap, Shield, Eye, Brain } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { analyzeText, calculateAIScore, getDetectorScore } from "@/lib/text-analysis";

interface AIDetector {
  id: string;
  name: string;
  icon: React.ReactNode;
  score: number;
  status: 'pending' | 'analyzing' | 'completed';
  delay: number;
}

interface AIDetectionResultsProps {
  text: string;
  onHumanize: () => void;
  status: 'checking' | 'completed' | null;
  onStatusChange: (status: 'checking' | 'completed' | null) => void;
}

export const AIDetectionResults = ({ text, onHumanize, status, onStatusChange }: AIDetectionResultsProps) => {
  const [detectors, setDetectors] = useState<AIDetector[]>([
    {
      id: 'copyleaks',
      name: 'Copyleaks',
      icon: <Eye className="w-5 h-5" />,
      score: 0,
      status: 'pending',
      delay: 800
    },
    {
      id: 'zerogpt',
      name: 'ZeroGPT',
      icon: <Zap className="w-5 h-5" />,
      score: 0,
      status: 'pending',
      delay: 1200
    },
    {
      id: 'gptzero',
      name: 'GPTZero',
      icon: <Brain className="w-5 h-5" />,
      score: 0,
      status: 'pending',
      delay: 1600
    },
    {
      id: 'originality',
      name: 'Originality.AI',
      icon: <Shield className="w-5 h-5" />,
      score: 0,
      status: 'pending',
      delay: 2000
    }
  ]);

  const [overallScore, setOverallScore] = useState(0);
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);

  // Analyze text and calculate realistic AI scores
  const analyzeAndScore = (text: string) => {
    const analysis = analyzeText(text);
    const baseScore = calculateAIScore(analysis, text);
    return baseScore;
  };

  // Start analysis when status changes to 'checking'
  useEffect(() => {
    if (status === 'checking') {
      setAnalysisStartTime(Date.now());
      
      // Reset all detectors
      setDetectors(prev => prev.map(detector => ({
        ...detector,
        score: 0,
        status: 'pending' as const
      })));

      // Analyze text for realistic scoring
      const baseScore = analyzeAndScore(text);

      // Define detector configs to avoid closure issues
      const detectorConfigs = [
        { id: 'copyleaks', delay: 800 },
        { id: 'zerogpt', delay: 1200 },
        { id: 'gptzero', delay: 1600 },
        { id: 'originality', delay: 2000 }
      ];

      // Start each detector with staggered timing
      detectorConfigs.forEach((config) => {
        setTimeout(() => {
          setDetectors(prev => prev.map(d => 
            d.id === config.id 
              ? { ...d, status: 'analyzing' as const }
              : d
          ));

          // Complete analysis after a short delay
          setTimeout(() => {
            const score = getDetectorScore(baseScore, config.id as keyof typeof import("@/lib/text-analysis").detectorProfiles, text);
            setDetectors(prev => prev.map(d => 
              d.id === config.id 
                ? { ...d, score, status: 'completed' as const }
                : d
            ));
          }, 800);
        }, config.delay);
      });

      // Calculate overall score when all detectors are done
      setTimeout(() => {
        setOverallScore(Math.floor(baseScore));
        onStatusChange('completed');
      }, 3000);

      // Safety timeout to prevent infinite loading
      setTimeout(() => {
        setDetectors(prev => prev.map(d => {
          if (d.status !== 'completed') {
            const fallbackScore = getDetectorScore(baseScore, d.id as keyof typeof import("@/lib/text-analysis").detectorProfiles, text);
            return { ...d, score: fallbackScore, status: 'completed' as const };
          }
          return d;
        }));
        setOverallScore(Math.floor(baseScore));
        onStatusChange('completed');
      }, 5000);
    }
  }, [status, text, onStatusChange]);

  const getRiskLevel = (score: number) => {
    // Lower scores = more human-like (better)
    if (score >= 70) return { level: 'High AI Risk', color: 'destructive', bgColor: 'bg-destructive/10', description: 'Likely AI-generated' };
    if (score >= 40) return { level: 'Medium Risk', color: 'warning', bgColor: 'bg-warning/10', description: 'Some AI patterns detected' };
    return { level: 'Human-like', color: 'success', bgColor: 'bg-success/10', description: 'Appears human-written' };
  };

  const completedDetectors = detectors.filter(d => d.status === 'completed');
  const allCompleted = completedDetectors.length === detectors.length;
  const averageScore = allCompleted ? Math.floor(completedDetectors.reduce((sum, d) => sum + d.score, 0) / completedDetectors.length) : 0;

  if (status === null) return null;

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-foreground">AI Detection Results</h3>
        {status === 'checking' && analysisStartTime && (
          <Badge variant="outline" className="animate-pulse">
            <Clock className="w-3 h-3 mr-1" />
            Analyzing...
          </Badge>
        )}
      </div>

      {/* Overall Score Card - More Compact */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <h3 className="text-lg font-semibold">AI Detection Score</h3>
            {!allCompleted ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-16 rounded-full mx-auto" />
                <Skeleton className="h-5 w-28 mx-auto" />
                <Skeleton className="h-2 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getRiskLevel(averageScore).bgColor}`}>
                    {averageScore >= 70 ? (
                      <AlertTriangle className={`w-8 h-8 text-destructive`} />
                    ) : (
                      <CheckCircle className={`w-8 h-8 text-${getRiskLevel(averageScore).color}`} />
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-3xl font-bold">{averageScore}%</div>
                    <div className="text-sm font-medium text-success uppercase tracking-wide">
                      HUMAN WRITTEN
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {getRiskLevel(averageScore).description}
                    </div>
                  </div>
                </div>
                <Progress 
                  value={averageScore} 
                  className="h-2"
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Individual Detector Results - Compact Grid */}
      <div className="grid grid-cols-2 gap-3">
        {detectors.map((detector) => (
          <Card key={detector.id} className="border h-full">
            <CardContent className="p-3 h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 flex-shrink-0">{detector.icon}</div>
                  <span className="text-sm font-medium truncate">{detector.name}</span>
                </div>
                {detector.status === 'analyzing' && (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary flex-shrink-0"></div>
                )}
              </div>
              
              <div className="flex-1 flex flex-col justify-end">
                {detector.status === 'pending' ? (
                  <Skeleton className="h-6 w-full" />
                ) : detector.status === 'analyzing' ? (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Analyzing...</div>
                    <Progress value={50} className="h-1.5" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">{detector.score}%</span>
                      <Badge 
                        variant={detector.score >= 70 ? 'destructive' : detector.score >= 40 ? 'secondary' : 'default'}
                        className="text-xs px-1 py-0"
                      >
                        {detector.score >= 70 ? 'AI' : detector.score >= 40 ? 'Mixed' : 'Human'}
                      </Badge>
                    </div>
                    <Progress value={detector.score} className="h-1.5" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Enhanced Disclaimer with Transparency */}
      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
          <div className="text-left space-y-2">
            <p className="text-sm font-medium text-foreground">
              Important: AI Detection Limitations
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AI detection tools have known accuracy issues and can produce false positives even for human-written text. 
              Research shows even leading detectors misclassify human writing 20-40% of the time. 
              These results should be viewed as rough estimates, not definitive judgments.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};