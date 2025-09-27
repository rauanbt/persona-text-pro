import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const copyleaksApiKey = Deno.env.get('COPYLEAKS_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[COPYLEAKS] Starting AI detection request');
    
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

    console.log('[COPYLEAKS] Text received, word count:', text.trim().split(/\s+/).length);

    // First get access token from Copyleaks
    const loginResponse = await fetch('https://id.copyleaks.com/v3/account/login/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'your-copyleaks-email@example.com', // Replace with actual email
        key: copyleaksApiKey
      }),
    });

    if (!loginResponse.ok) {
      console.error('[COPYLEAKS] Login failed:', loginResponse.status, loginResponse.statusText);
      throw new Error(`Copyleaks login failed: ${loginResponse.statusText}`);
    }

    const loginData = await loginResponse.json();
    const accessToken = loginData.access_token;
    console.log('[COPYLEAKS] Access token obtained');

    // Submit text for AI detection
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const submitResponse = await fetch(`https://api.copyleaks.com/v3/education/submit/file/${scanId}/ai-detection`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64: btoa(text),
        filename: 'text.txt',
        properties: {
          webhooks: {
            status: `${req.headers.get('origin') || 'https://yourdomain.com'}/api/copyleaks-webhook/${scanId}`
          }
        }
      }),
    });

    if (!submitResponse.ok) {
      console.error('[COPYLEAKS] Submit failed:', submitResponse.status, submitResponse.statusText);
      throw new Error(`Copyleaks submission failed: ${submitResponse.statusText}`);
    }

    console.log('[COPYLEAKS] Scan submitted successfully');

    // Poll for results (simplified approach - in production you'd use webhooks)
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      attempts++;
      
      try {
        const resultResponse = await fetch(`https://api.copyleaks.com/v3/downloads/${scanId}/ai-detection`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (resultResponse.ok) {
          const result = await resultResponse.json();
          console.log('[COPYLEAKS] Results received:', result);
          
          const aiScore = Math.round(result.summary?.ai * 100) || 0;
          
          return new Response(JSON.stringify({
            detector: 'copyleaks',
            score: aiScore,
            confidence: result.summary?.ai || 0,
            details: {
              human: result.summary?.human || 0,
              ai: result.summary?.ai || 0,
              mixed: result.summary?.mixed || 0
            },
            scanId: scanId
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (pollError) {
        console.log('[COPYLEAKS] Still processing...', attempts);
      }
    }

    // If we reach here, the scan is taking too long
    throw new Error('Copyleaks scan timeout - results taking longer than expected');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[COPYLEAKS] Error:', error);
    
    // Return simulated results as fallback
    console.log('[COPYLEAKS] Returning simulated results as fallback');
    const simulatedScore = Math.floor(Math.random() * 40) + 30; // 30-70% range
    
    return new Response(JSON.stringify({
      detector: 'copyleaks',
      score: simulatedScore,
      confidence: simulatedScore / 100,
      simulated: true,
      error: errorMessage,
      details: {
        human: (100 - simulatedScore) / 100,
        ai: simulatedScore / 100,
        mixed: 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});