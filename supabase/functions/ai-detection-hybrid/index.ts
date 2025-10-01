import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[HYBRID] Starting hybrid AI detection request');
    
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error('User not authenticated');
    }

    const { text } = await req.json();
    
    if (!text) {
      throw new Error('Text is required');
    }

    console.log('[HYBRID] Text received, orchestrating multiple detectors');

    // Call multiple detection services in parallel
    const detectionPromises = [];
    
    // Call GPTZero (recommended - most accurate)
    detectionPromises.push(
      supabase.functions.invoke('ai-detection-gptzero', {
        body: { text },
        headers: { Authorization: authHeader }
      }).catch(error => {
        console.error('[HYBRID] GPTZero failed:', error);
        return { data: null, error: error.message };
      })
    );
    
    // Call Copyleaks (premium alternative)
    detectionPromises.push(
      supabase.functions.invoke('ai-detection-copyleaks', {
        body: { text },
        headers: { Authorization: authHeader }
      }).catch(error => {
        console.error('[HYBRID] Copyleaks failed:', error);
        return { data: null, error: error.message };
      })
    );
    
    // Call ZeroGPT (additional validation)
    detectionPromises.push(
      supabase.functions.invoke('ai-detection-zerogpt', {
        body: { text },
        headers: { Authorization: authHeader }
      }).catch(error => {
        console.error('[HYBRID] ZeroGPT failed:', error);
        return { data: null, error: error.message };
      })
    );

    // Wait for all detection services to complete
    const results = await Promise.all(detectionPromises);
    console.log('[HYBRID] All detectors completed');

    // Process results
    const successfulResults = results.filter(result => result.data && !result.error);
    const failedResults = results.filter(result => result.error);
    
    let detectorResults: any[] = [];
    
    // Process successful results
    successfulResults.forEach(result => {
      if (result.data) {
        detectorResults.push(result.data);
      }
    });
    
    // If no successful results, provide fallback analysis
    if (detectorResults.length === 0) {
      console.log('[HYBRID] No successful results, using fallback analysis');
      detectorResults = await generateFallbackResults(text);
    }
    
    // Calculate overall confidence and score
    const validScores = detectorResults.filter(r => typeof r.score === 'number').map(r => r.score);
    const averageScore = validScores.length > 0 
      ? Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length)
      : 50;
    
    const overallConfidence = Math.min(
      validScores.length > 0 ? validScores.reduce((sum, score) => sum + score, 0) / (validScores.length * 100) : 0.5,
      1.0
    );
    
    // Determine risk level
    const getRiskLevel = (score: number) => {
      if (score >= 70) return { level: 'High AI Risk', color: 'destructive', description: 'Likely AI-generated' };
      if (score >= 40) return { level: 'Medium Risk', color: 'warning', description: 'Some AI patterns detected' };
      return { level: 'Human-like', color: 'success', description: 'Appears human-written' };
    };
    
    const riskLevel = getRiskLevel(averageScore);
    
    return new Response(JSON.stringify({
      overallScore: averageScore,
      confidence: overallConfidence,
      riskLevel: riskLevel,
      detectors: detectorResults,
      summary: {
        totalDetectors: detectorResults.length,
        successfulDetectors: successfulResults.length,
        failedDetectors: failedResults.length,
        wordCount: text.trim().split(/\s+/).length
      },
      errors: failedResults.map(r => r.error).filter(Boolean)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[HYBRID] Error:', error);
    
    // Return comprehensive fallback results
    const fallbackResults = await generateFallbackResults('');
    
    return new Response(JSON.stringify({
      overallScore: 45,
      confidence: 0.5,
      riskLevel: { level: 'Medium Risk', color: 'warning', description: 'Analysis unavailable - using fallback' },
      detectors: fallbackResults,
      summary: {
        totalDetectors: fallbackResults.length,
        successfulDetectors: 0,
        failedDetectors: 2,
        wordCount: 0
      },
      error: errorMessage,
      fallback: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Deterministic hash function for consistent scoring
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Deterministic random based on text and seed
function deterministicRandom(text: string, seed: number = 0): number {
  const hash = hashString(text + seed.toString());
  return ((hash % 10000) / 10000) * 2 - 1; // -1 to 1
}

async function generateFallbackResults(text: string) {
  // Enhanced fallback with sophisticated text analysis
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const wordCount = words.length;
  
  // Calculate linguistic metrics
  const uniqueWords = new Set(words);
  const lexicalDiversity = wordCount > 0 ? uniqueWords.size / wordCount : 0.5;
  
  // AI-typical formal words and phrases
  const aiIndicators = [
    'furthermore', 'moreover', 'additionally', 'consequently', 'nevertheless',
    'specifically', 'particularly', 'essentially', 'ultimately', 'delve',
    'leverage', 'utilize', 'comprehensive', 'robust', 'seamless'
  ];
  
  const aiPhrases = [
    'in conclusion', 'to summarize', 'it is important to note',
    'in today\'s world', 'as a result', 'in other words'
  ];
  
  const indicatorCount = words.filter(w => aiIndicators.includes(w)).length;
  const phraseCount = aiPhrases.filter(phrase => text.toLowerCase().includes(phrase)).length;
  
  // Sentence uniformity analysis
  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / (sentences.length || 1);
  const lengthVariance = sentenceLengths.reduce((sum, len) => 
    sum + Math.pow(len - avgLength, 2), 0) / (sentences.length || 1);
  
  // Calculate base score
  let baseScore = 35;
  baseScore += (indicatorCount / wordCount) * 100 * 15; // Formal indicators
  baseScore += phraseCount * 8; // AI cliché phrases
  baseScore += (1 - lexicalDiversity) * 20; // Low diversity
  baseScore += (lengthVariance < 20 ? 15 : lengthVariance < 50 ? 8 : 0); // Uniformity
  baseScore += (wordCount > 500 ? 5 : 0); // Length bias
  
  // Add controlled deterministic variance
  const variance = deterministicRandom(text, 100) * 18;
  baseScore = Math.max(20, Math.min(85, baseScore + variance));
  
  return [
    {
      detector: 'gptzero',
      score: Math.round(baseScore + deterministicRandom(text, 1) * 12),
      confidence: 0.65,
      simulated: true,
      details: { 
        analysis: 'Enhanced fallback - GPTZero API unavailable',
        note: 'Estimated based on linguistic patterns'
      }
    },
    {
      detector: 'copyleaks',
      score: Math.round(baseScore * 0.85 + deterministicRandom(text, 2) * 10),
      confidence: 0.62,
      simulated: true,
      details: { 
        analysis: 'Enhanced fallback - Copyleaks API unavailable',
        note: 'Estimated based on text metrics'
      }
    },
    {
      detector: 'zerogpt', 
      score: Math.round(baseScore * 1.1 + deterministicRandom(text, 3) * 14),
      confidence: 0.58,
      simulated: true,
      details: { 
        analysis: 'Enhanced fallback - ZeroGPT API unavailable',
        note: 'Estimated using pattern analysis'
      }
    }
  ];
}