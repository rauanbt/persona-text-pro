import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[ZEROGPT] Starting AI detection request');
    
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

    console.log('[ZEROGPT] Text received, word count:', text.trim().split(/\s+/).length);

    const zeroGptApiKey = Deno.env.get('ZEROGPT_API_KEY');
    
    if (!zeroGptApiKey) {
      console.log('[ZEROGPT] No API key found, using fallback analysis');
      // Generate deterministic fallback analysis
      const words = text.trim().split(/\s+/);
      const simulatedScore = Math.floor((deterministicRandom(text, 3) + 1) * 25) + 25; // 25-75% range
      
      return new Response(JSON.stringify({
        detector: 'zerogpt',
        score: simulatedScore,
        confidence: simulatedScore / 100,
        simulated: true,
        details: {
          textLength: words.length,
          analysis: 'Fallback analysis - no API key configured'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      console.log('[ZEROGPT] Making API call to ZeroGPT');
      
      // ZeroGPT API call - adjust endpoint and payload based on actual API documentation
      const apiResponse = await fetch('https://api.zerogpt.com/api/detect/detectText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${zeroGptApiKey}`,
          'User-Agent': 'SapienWrite-API-Client/1.0'
        },
        body: JSON.stringify({
          input_text: text,
          // Add other parameters as needed by ZeroGPT API
        })
      });

      if (!apiResponse.ok) {
        console.error('[ZEROGPT] API response not OK:', apiResponse.status, apiResponse.statusText);
        throw new Error(`ZeroGPT API error: ${apiResponse.status}`);
      }

      const apiData = await apiResponse.json();
      console.log('[ZEROGPT] API response received:', JSON.stringify(apiData, null, 2));

      // Parse ZeroGPT response - adjust based on actual API response format
      const aiScore = apiData.fakePercentage || apiData.ai_percentage || apiData.score || 0;
      const confidence = apiData.confidence || aiScore / 100;
      const words = text.trim().split(/\s+/);
      
      console.log('[ZEROGPT] Real API analysis complete, AI score:', aiScore);
      
      return new Response(JSON.stringify({
        detector: 'zerogpt',
        score: Math.round(aiScore),
        confidence: confidence,
        details: {
          textLength: words.length,
          analysis: 'Real ZeroGPT API analysis',
          apiData: apiData.message || 'Analysis completed'
        },
        simulated: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (apiError) {
      console.error('[ZEROGPT] API error:', apiError);
      throw apiError;
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[ZEROGPT] Error:', error);
    
    // Return deterministic results as fallback
    console.log('[ZEROGPT] Returning deterministic results as fallback');
    const simulatedScore = Math.floor((deterministicRandom(errorMessage, 3) + 1) * 25) + 25; // 25-75% range
    
    return new Response(JSON.stringify({
      detector: 'zerogpt',
      score: simulatedScore,
      confidence: simulatedScore / 100,
      simulated: true,
      error: errorMessage,
      details: {
        analysis: 'Fallback simulated analysis'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});