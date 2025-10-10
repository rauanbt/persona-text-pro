import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    
    if (!text) {
      throw new Error('Text is required');
    }

    // Word limit validation
    const wordCount = text.trim().split(/\s+/).length;
    const authHeader = req.headers.get('Authorization');
    const isAuthenticated = authHeader && authHeader !== 'Bearer null';
    const maxWords = isAuthenticated ? 2500 : 500;

    console.log(`[AI-DETECTION] Request - Words: ${wordCount}, Max: ${maxWords}, Auth: ${isAuthenticated}`);

    if (wordCount > maxWords) {
      return new Response(JSON.stringify({
        error: 'Word limit exceeded',
        message: `Text exceeds ${maxWords} word limit. Please use ${wordCount <= 500 ? 'up to 500 words' : 'up to 2,500 words (login required)'}.`,
        wordCount,
        maxWords
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // System prompt for AI detection
    const systemPrompt = `You are an advanced AI content detector. Analyze the given text and determine the probability that it was AI-generated.

Focus on these AI indicators:
- Uniform sentence lengths and structure
- Overuse of formal transition words (furthermore, moreover, additionally, consequently, therefore, nevertheless, subsequently, specifically, particularly, essentially, ultimately)
- Perfect grammar with no natural human imperfections
- Lack of contractions or colloquial language
- Predictable word patterns and phrases
- Absence of personal anecdotes or unique perspectives
- Overly balanced paragraph structures
- Use of em-dashes in a formulaic way

Provide a probability score from 0-100, where:
- 0-30: Likely human-written
- 31-70: Mixed or uncertain
- 71-100: Likely AI-generated

Also provide your confidence level (0-100) in this assessment and brief reasoning.`;

    // Define the tool for structured output
    const detectionTool = {
      type: "function" as const,
      function: {
        name: "detect_ai_content",
        description: "Analyze text and return AI detection probability",
        parameters: {
          type: "object",
          properties: {
            ai_probability: {
              type: "number",
              description: "Probability the text is AI-generated (0-100)",
              minimum: 0,
              maximum: 100
            },
            confidence: {
              type: "number",
              description: "Confidence in this assessment (0-100)",
              minimum: 0,
              maximum: 100
            },
            reasoning: {
              type: "string",
              description: "Brief explanation of the assessment"
            }
          },
          required: ["ai_probability", "confidence", "reasoning"],
          additionalProperties: false
        }
      }
    };

    // Call three models in parallel
    const models = [
      { name: 'gemini', model: 'google/gemini-2.5-flash', weight: 0.40 },
      { name: 'gpt', model: 'openai/gpt-5-mini-2025-08-07', weight: 0.35 },
      { name: 'claude', model: 'claude-sonnet-4-20250514', weight: 0.25 }
    ];

    console.log('[AI-DETECTION] Calling three AI models in parallel...');

    const modelPromises = models.map(async ({ name, model, weight }) => {
      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Analyze this text for AI generation:\n\n${text}` }
            ],
            tools: [detectionTool],
            tool_choice: { type: "function", function: { name: "detect_ai_content" } }
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[AI-DETECTION] ${name} error:`, response.status, errorText);
          throw new Error(`${name} API error: ${response.status}`);
        }

        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        
        if (!toolCall) {
          throw new Error(`${name} did not return tool call`);
        }

        const result = JSON.parse(toolCall.function.arguments);
        console.log(`[AI-DETECTION] ${name} result:`, result);

        return {
          name,
          score: result.ai_probability,
          confidence: result.confidence,
          reasoning: result.reasoning,
          weight,
          success: true
        };
      } catch (error) {
        console.error(`[AI-DETECTION] ${name} failed:`, error);
        return {
          name,
          score: 0,
          confidence: 0,
          reasoning: `Error: ${error.message}`,
          weight,
          success: false
        };
      }
    });

    const results = await Promise.all(modelPromises);
    
    // Calculate weighted average from successful models
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      throw new Error('All AI models failed to analyze the text');
    }

    // Recalculate weights for successful models only
    const totalWeight = successfulResults.reduce((sum, r) => sum + r.weight, 0);
    const normalizedResults = successfulResults.map(r => ({
      ...r,
      normalizedWeight: r.weight / totalWeight
    }));

    const weightedScore = normalizedResults.reduce(
      (sum, r) => sum + (r.score * r.normalizedWeight),
      0
    );
    
    const averageConfidence = successfulResults.reduce((sum, r) => sum + r.confidence, 0) / successfulResults.length;

    const finalScore = Math.round(weightedScore);

    // Determine risk level
    let riskLevel = 'Human-like';
    let riskColor = 'success';
    if (finalScore > 70) {
      riskLevel = 'High AI Risk';
      riskColor = 'destructive';
    } else if (finalScore > 30) {
      riskLevel = 'Medium Risk';
      riskColor = 'warning';
    }

    console.log(`[AI-DETECTION] Final Score: ${finalScore}%, Risk: ${riskLevel}`);

    return new Response(JSON.stringify({
      score: finalScore,
      confidence: Math.round(averageConfidence),
      riskLevel,
      riskColor,
      wordCount,
      models: successfulResults.map(r => ({
        name: r.name,
        score: Math.round(r.score),
        confidence: Math.round(r.confidence)
      })),
      summary: {
        totalModels: models.length,
        successfulModels: successfulResults.length,
        analysis: `${successfulResults.length} AI model${successfulResults.length > 1 ? 's' : ''} analyzed your text`
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[AI-DETECTION] Error:', error);
    
    return new Response(JSON.stringify({
      error: 'Detection failed',
      message: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
