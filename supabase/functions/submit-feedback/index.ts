import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeedbackRequest {
  feedback_type: 'bug' | 'feature';
  message: string;
  severity?: 'low' | 'medium' | 'high';
  email?: string;
  current_url?: string;
  current_page?: string;
  user_agent?: string;
  app_state?: any;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Try to get authenticated user (optional)
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let userEmail: string | null = null;
    let userPlan: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        userId = user.id;
        userEmail = user.email || null;
        
        // Get user plan from profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('current_plan')
          .eq('user_id', user.id)
          .maybeSingle();
        
        userPlan = profile?.current_plan || null;
      }
    }

    const body: FeedbackRequest = await req.json();

    // Validate input
    if (!body.message || body.message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.message.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Message must be less than 1000 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['bug', 'feature'].includes(body.feedback_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid feedback type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.severity && !['low', 'medium', 'high'].includes(body.severity)) {
      return new Response(
        JSON.stringify({ error: 'Invalid severity level' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert feedback
    const { data, error } = await supabase
      .from('feedback_submissions')
      .insert({
        user_id: userId,
        email: body.email || userEmail,
        plan: userPlan,
        feedback_type: body.feedback_type,
        message: body.message.trim(),
        severity: body.severity || null,
        current_url: body.current_url,
        current_page: body.current_page,
        user_agent: body.user_agent,
        app_state: body.app_state || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting feedback:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to submit feedback' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Feedback submitted successfully:', { id: data.id, type: body.feedback_type });

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in submit-feedback function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
