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
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }
    
    if (!anthropicApiKey) {
      console.warn('[AI-DETECTION] ANTHROPIC_API_KEY not configured - Claude will be skipped');
    }

    // System prompt for AI detection with breakdown analysis
    const systemPrompt = `You are an advanced AI content detector. Analyze the given text and provide a detailed breakdown of AI involvement.

Focus on these AI indicators:
- Uniform sentence lengths and structure
- Overuse of formal transition words (furthermore, moreover, additionally, consequently, therefore, nevertheless, subsequently, specifically, particularly, essentially, ultimately)
- Perfect grammar with no natural human imperfections
- Lack of contractions or colloquial language
- Predictable word patterns and phrases
- Absence of personal anecdotes or unique perspectives
- Overly balanced paragraph structures
- Use of em-dashes in a formulaic way

ALSO look for signs of AI editing/polishing on human text:
- Minor grammatical improvements and polish
- Consistent formatting and structure added to natural voice
- Slight vocabulary enhancement while maintaining personal style
- Natural flow with occasional perfect phrases

Provide a THREE-CATEGORY breakdown:
1. AI Generated (0-100%): Fully created by AI
2. Mixed (0-100%): Human-written but edited/polished by AI
3. Human (0-100%): Purely human-written

The three percentages should sum to 100%. Also determine the primary category (human, mixed, or ai) and provide a descriptive label.`;

    // Define the tool for structured output with breakdown
    const detectionTool = {
      type: "function" as const,
      function: {
        name: "detect_ai_content",
        description: "Analyze text and return detailed AI detection breakdown",
        parameters: {
          type: "object",
          properties: {
            ai_probability: {
              type: "number",
              description: "Overall AI probability score (0-100)",
              minimum: 0,
              maximum: 100
            },
            breakdown: {
              type: "object",
              description: "Detailed breakdown of content authorship",
              properties: {
                ai_generated: {
                  type: "number",
                  description: "Percentage fully AI-generated (0-100)",
                  minimum: 0,
                  maximum: 100
                },
                mixed: {
                  type: "number",
                  description: "Percentage human-written but AI-edited (0-100)",
                  minimum: 0,
                  maximum: 100
                },
                human: {
                  type: "number",
                  description: "Percentage purely human-written (0-100)",
                  minimum: 0,
                  maximum: 100
                }
              },
              required: ["ai_generated", "mixed", "human"]
            },
            category: {
              type: "string",
              enum: ["human", "mixed", "ai"],
              description: "Primary classification category"
            },
            confidence: {
              type: "string",
              enum: ["low", "moderate", "high"],
              description: "Confidence level in this assessment"
            },
            label: {
              type: "string",
              description: "Descriptive label (e.g. 'Lightly edited by AI', 'Mostly AI-generated', 'Appears human-written')"
            },
            reasoning: {
              type: "string",
              description: "Brief explanation of the assessment"
            }
          },
          required: ["ai_probability", "breakdown", "category", "confidence", "label", "reasoning"],
          additionalProperties: false
        }
      }
    };

    // Helper function for Lovable AI Gateway (Gemini & GPT)
    const callLovableAI = async (model: string) => {
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
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      
      if (!toolCall) {
        throw new Error('No tool call returned');
      }

      return JSON.parse(toolCall.function.arguments);
    };

    // Helper function for Anthropic API (Claude)
    const callAnthropicAI = async (model: string) => {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey!,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          tools: [{
            name: detectionTool.function.name,
            description: detectionTool.function.description,
            input_schema: detectionTool.function.parameters
          }],
          tool_choice: { type: "tool", name: "detect_ai_content" },
          messages: [
            { 
              role: 'user', 
              content: `${systemPrompt}\n\nAnalyze this text for AI generation:\n\n${text}` 
            }
          ]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const toolUse = data.content?.find((block: any) => block.type === 'tool_use');
      
      if (!toolUse) {
        throw new Error('No tool use returned');
      }

      return toolUse.input;
    };

    // Call three models in parallel
    const models = [
      { name: 'gemini', model: 'google/gemini-2.5-flash', weight: 0.40, gateway: 'lovable' },
      { name: 'gpt', model: 'openai/gpt-5-mini', weight: 0.35, gateway: 'lovable' },
      { name: 'claude', model: 'claude-sonnet-4-20250514', weight: 0.25, gateway: 'anthropic' }
    ];

    console.log('[AI-DETECTION] Calling three AI models in parallel...');

    const modelPromises = models.map(async ({ name, model, weight, gateway }) => {
      try {
        let result;

        if (gateway === 'lovable') {
          result = await callLovableAI(model);
        } else if (gateway === 'anthropic') {
          if (!anthropicApiKey) {
            throw new Error('ANTHROPIC_API_KEY not configured');
          }
          result = await callAnthropicAI(model);
        } else {
          throw new Error(`Unknown gateway: ${gateway}`);
        }

        console.log(`[AI-DETECTION] ${name} result:`, result);

        return {
          name,
          score: result.ai_probability,
          confidence: result.confidence,
          breakdown: result.breakdown,
          category: result.category,
          label: result.label,
          reasoning: result.reasoning,
          weight,
          success: true
        };
      } catch (error) {
        console.error(`[AI-DETECTION] ${name} failed:`, error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return {
          name,
          score: 0,
          confidence: 0,
          reasoning: `Error: ${errorMsg}`,
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
    
    // Calculate weighted breakdown percentages
    const weightedBreakdown = normalizedResults.reduce(
      (acc, r: any) => {
        const breakdown = r.breakdown || { ai_generated: r.score, mixed: 0, human: 100 - r.score };
        return {
          ai_generated: acc.ai_generated + (breakdown.ai_generated * r.normalizedWeight),
          mixed: acc.mixed + (breakdown.mixed * r.normalizedWeight),
          human: acc.human + (breakdown.human * r.normalizedWeight)
        };
      },
      { ai_generated: 0, mixed: 0, human: 0 }
    );

    // Normalize breakdown to sum to 100
    const breakdownSum = weightedBreakdown.ai_generated + weightedBreakdown.mixed + weightedBreakdown.human;
    const normalizedBreakdown = {
      ai_generated: Math.round((weightedBreakdown.ai_generated / breakdownSum) * 100),
      mixed: Math.round((weightedBreakdown.mixed / breakdownSum) * 100),
      human: Math.round((weightedBreakdown.human / breakdownSum) * 100)
    };

    // Determine category based on highest percentage
    let category: 'human' | 'mixed' | 'ai' = 'mixed';
    const maxValue = Math.max(normalizedBreakdown.ai_generated, normalizedBreakdown.mixed, normalizedBreakdown.human);
    if (maxValue === normalizedBreakdown.human) category = 'human';
    else if (maxValue === normalizedBreakdown.ai_generated) category = 'ai';

    const finalScore = Math.round(weightedScore);

    // Determine confidence level (aggregate from models)
    const confidenceLevels = successfulResults.map((r: any) => r.confidence || 'moderate');
    const highConfidence = confidenceLevels.filter((c: string) => c === 'high').length;
    const lowConfidence = confidenceLevels.filter((c: string) => c === 'low').length;
    let confidenceLevel: 'low' | 'moderate' | 'high' = 'moderate';
    if (highConfidence > lowConfidence && highConfidence >= successfulResults.length / 2) {
      confidenceLevel = 'high';
    } else if (lowConfidence > highConfidence) {
      confidenceLevel = 'low';
    }

    // Generate descriptive label
    let label = 'Mixed content';
    if (category === 'human') {
      label = normalizedBreakdown.mixed > 20 ? 'Lightly edited by AI' : 'Appears human-written';
    } else if (category === 'ai') {
      label = normalizedBreakdown.ai_generated > 80 ? 'Mostly AI-generated' : 'Significantly AI-generated';
    } else {
      label = normalizedBreakdown.mixed > 60 ? 'Heavily polished by AI' : 'Edited by AI';
    }

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

    console.log(`[AI-DETECTION] Final Score: ${finalScore}%, Category: ${category}, Label: ${label}`);

    return new Response(JSON.stringify({
      score: finalScore,
      category,
      confidence: confidenceLevel,
      breakdown: normalizedBreakdown,
      label,
      riskLevel,
      riskColor,
      wordCount,
      models: successfulResults.map(r => ({
        name: r.name,
        score: Math.round(r.score),
        confidence: (r as any).confidence || 'moderate'
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
