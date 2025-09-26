import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Clock, Zap, Shield, Eye, Brain } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
      id: 'gptzero',
      name: 'GPTZero',
      icon: <Brain className="w-5 h-5" />,
      score: 0,
      status: 'pending',
      delay: 800
    },
    {
      id: 'originality',
      name: 'Originality.AI',
      icon: <Shield className="w-5 h-5" />,
      score: 0,
      status: 'pending',
      delay: 1200
    },
    {
      id: 'copyleaks',
      name: 'Copyleaks',
      icon: <Eye className="w-5 h-5" />,
      score: 0,
      status: 'pending',
      delay: 1600
    },
    {
      id: 'writer',
      name: 'Writer.com',
      icon: <Zap className="w-5 h-5" />,
      score: 0,
      status: 'pending',
      delay: 2000
    }
  ]);

  const [overallScore, setOverallScore] = useState(0);
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);

  // Generate realistic AI detection scores
  const generateRealisticScore = (baseScore: number, variation: number = 15) => {
    const variance = (Math.random() - 0.5) * variation * 2;
    return Math.max(0, Math.min(100, Math.floor(baseScore + variance)));
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

      // Generate base score for text (simulated analysis)
      const textComplexity = text.length > 500 ? 0.8 : text.length > 200 ? 0.6 : 0.4;
      const baseScore = 70 + Math.random() * 25 + textComplexity * 5;

      // Start each detector with staggered timing
      detectors.forEach((detector, index) => {
        setTimeout(() => {
          setDetectors(prev => prev.map(d => 
            d.id === detector.id 
              ? { ...d, status: 'analyzing' as const }
              : d
          ));

          // Complete analysis after a short delay
          setTimeout(() => {
            const score = generateRealisticScore(baseScore);
            setDetectors(prev => prev.map(d => 
              d.id === detector.id 
                ? { ...d, score, status: 'completed' as const }
                : d
            ));
          }, 800);
        }, detector.delay);
      });

      // Calculate overall score when all detectors are done
      setTimeout(() => {
        setOverallScore(Math.floor(baseScore));
        onStatusChange('completed');
      }, 3000);
    }
  }, [status, text, onStatusChange]);

  const getRiskLevel = (score: number) => {
    if (score >= 80) return { level: 'High Risk', color: 'destructive', bgColor: 'bg-destructive/10' };
    if (score >= 50) return { level: 'Medium Risk', color: 'warning', bgColor: 'bg-warning/10' };
    return { level: 'Low Risk', color: 'success', bgColor: 'bg-success/10' };
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

      {/* Overall Score Card */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-center">Overall Detection Score</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {!allCompleted ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-20 rounded-full mx-auto" />
              <Skeleton className="h-6 w-32 mx-auto" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : (
            <>
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto ${getRiskLevel(averageScore).bgColor}`}>
                {averageScore >= 80 ? (
                  <AlertTriangle className={`w-12 h-12 text-destructive`} />
                ) : (
                  <CheckCircle className={`w-12 h-12 text-${getRiskLevel(averageScore).color}`} />
                )}
              </div>
              <div>
                <div className="text-4xl font-bold mb-1">{averageScore}%</div>
                <div className={`text-lg font-medium text-${getRiskLevel(averageScore).color}`}>
                  {getRiskLevel(averageScore).level}
                </div>
              </div>
              <Progress 
                value={averageScore} 
                className="h-3"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Individual Detector Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {detectors.map((detector) => (
          <Card key={detector.id} className="border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {detector.icon}
                  <span className="font-medium">{detector.name}</span>
                </div>
                {detector.status === 'analyzing' && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                )}
              </div>
              
              {detector.status === 'pending' ? (
                <Skeleton className="h-8 w-full" />
              ) : detector.status === 'analyzing' ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Analyzing...</span>
                  </div>
                  <Progress value={Math.random() * 60 + 20} className="h-2" />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold">{detector.score}%</span>
                    <Badge 
                      variant={detector.score >= 80 ? 'destructive' : detector.score >= 50 ? 'secondary' : 'default'}
                      className="text-xs"
                    >
                      {getRiskLevel(detector.score).level}
                    </Badge>
                  </div>
                  <Progress value={detector.score} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recommendation Section */}
      {allCompleted && (
        <Card className={`border-2 ${getRiskLevel(averageScore).bgColor} border-${getRiskLevel(averageScore).color}/20`}>
          <CardContent className="p-6">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              {averageScore >= 80 ? (
                <AlertTriangle className="w-5 h-5 text-destructive" />
              ) : (
                <CheckCircle className="w-5 h-5 text-success" />
              )}
              Recommendation
            </h4>
            <p className="text-muted-foreground mb-4">
              {averageScore >= 80 
                ? 'Your text shows strong AI characteristics across multiple detectors. Humanization is highly recommended to avoid detection.' 
                : averageScore >= 50 
                  ? 'Your text shows some AI patterns. Consider humanization to improve authenticity and bypass AI detectors.' 
                  : 'Your text appears natural and human-written. It should pass most AI detection systems successfully.'}
            </p>
            
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-4">
              <div>
                <span className="font-medium">Word Count:</span> {text.trim().split(/\s+/).length}
              </div>
              <div>
                <span className="font-medium">Detectors Checked:</span> {detectors.length}
              </div>
            </div>

            {averageScore >= 50 && (
              <Button 
                onClick={onHumanize}
                className="w-full bg-success hover:bg-success/90 text-success-foreground"
                size="lg"
              >
                <Brain className="w-4 h-4 mr-2" />
                Humanize This Text
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};