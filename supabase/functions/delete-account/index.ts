import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error("[delete-account] Auth error:", authError);
      throw new Error("Unauthorized");
    }

    console.log(`[delete-account] Deleting account for user: ${user.id}`);

    // First, get the Stripe customer ID to cancel subscriptions
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    // Cancel all active Stripe subscriptions if customer exists
    if (profile?.stripe_customer_id) {
      console.log(`[delete-account] Found Stripe customer: ${profile.stripe_customer_id}`);
      
      try {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
          apiVersion: "2025-08-27.basil",
        });
        
        // List all active subscriptions
        const subscriptions = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: 'active',
        });
        
        console.log(`[delete-account] Found ${subscriptions.data.length} active subscriptions`);
        
        // Cancel each active subscription
        for (const subscription of subscriptions.data) {
          await stripe.subscriptions.cancel(subscription.id);
          console.log(`[delete-account] Canceled subscription: ${subscription.id}`);
        }
        
        if (subscriptions.data.length > 0) {
          console.log(`[delete-account] Successfully canceled ${subscriptions.data.length} subscription(s)`);
        }
      } catch (stripeError) {
        console.error("[delete-account] Error canceling Stripe subscriptions:", stripeError);
        // Continue with account deletion even if Stripe cancellation fails
      }
    }

    // Delete user data in order (respecting foreign key constraints)
    
    // 1. Delete usage tracking
    const { error: usageError } = await supabaseAdmin
      .from("usage_tracking")
      .delete()
      .eq("user_id", user.id);
    
    if (usageError) {
      console.error("[delete-account] Error deleting usage_tracking:", usageError);
      throw new Error("Failed to delete usage tracking data");
    }
    console.log("[delete-account] Deleted usage_tracking records");

    // 2. Delete humanization requests
    const { error: requestsError } = await supabaseAdmin
      .from("humanization_requests")
      .delete()
      .eq("user_id", user.id);
    
    if (requestsError) {
      console.error("[delete-account] Error deleting humanization_requests:", requestsError);
      throw new Error("Failed to delete humanization requests");
    }
    console.log("[delete-account] Deleted humanization_requests records");

    // 3. Delete extra word purchases
    const { error: purchasesError } = await supabaseAdmin
      .from("extra_word_purchases")
      .delete()
      .eq("user_id", user.id);
    
    if (purchasesError) {
      console.error("[delete-account] Error deleting extra_word_purchases:", purchasesError);
      throw new Error("Failed to delete extra word purchases");
    }
    console.log("[delete-account] Deleted extra_word_purchases records");

    // 4. Delete feedback submissions
    const { error: feedbackError } = await supabaseAdmin
      .from("feedback_submissions")
      .delete()
      .eq("user_id", user.id);
    
    if (feedbackError) {
      console.error("[delete-account] Error deleting feedback_submissions:", feedbackError);
      throw new Error("Failed to delete feedback submissions");
    }
    console.log("[delete-account] Deleted feedback_submissions records");

    // 5. Delete profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", user.id);
    
    if (profileError) {
      console.error("[delete-account] Error deleting profile:", profileError);
      throw new Error("Failed to delete profile");
    }
    console.log("[delete-account] Deleted profile record");

    // 6. Delete auth user (this will cascade to any remaining auth-related data)
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    
    if (deleteUserError) {
      console.error("[delete-account] Error deleting auth user:", deleteUserError);
      throw new Error("Failed to delete user account");
    }
    console.log("[delete-account] Deleted auth user");

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Account successfully deleted" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[delete-account] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to delete account" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
