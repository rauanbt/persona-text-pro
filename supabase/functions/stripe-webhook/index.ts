import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Plan details mapping using actual Stripe price IDs
const PLAN_DETAILS: Record<string, {
  name: string;
  wordLimit: number;
  billingPeriod: string;
  features: string[];
  hasExtension: boolean;
}> = {
  // Ultra Monthly
  'price_1SD81xH8HT0u8xphuqiq8xet': {
    name: 'Ultra Plan',
    wordLimit: 40000,
    billingPeriod: 'Monthly',
    hasExtension: true,
    features: [
      '40,000 words per month (shared pool across web & extension)',
      'Chrome Extension access included',
      'Advanced AI engines (GPT-4, Claude) + Fast engines',
      '50+ languages supported',
      'All tone options (Professional, Casual, Academic, Creative, Technical)',
      'Priority support'
    ]
  },
  // Ultra Annual
  'price_1SGMo6H8HT0u8xphytzP4SFR': {
    name: 'Ultra Plan',
    wordLimit: 40000,
    billingPeriod: 'Annual',
    hasExtension: true,
    features: [
      '40,000 words per month (shared pool across web & extension)',
      'Chrome Extension access included',
      'Advanced AI engines (GPT-4, Claude) + Fast engines',
      '50+ languages supported',
      'All tone options (Professional, Casual, Academic, Creative, Technical)',
      'Priority support',
      '💰 Save 40% with annual billing'
    ]
  },
  // Pro Monthly
  'price_1SD818H8HT0u8xph48V9GxXG': {
    name: 'Pro Plan',
    wordLimit: 15000,
    billingPeriod: 'Monthly',
    hasExtension: false,
    features: [
      '15,000 words per month',
      'Web dashboard access only (no Chrome Extension)',
      'Advanced AI engines (GPT-4, Claude) + Fast engines',
      '50+ languages supported',
      'All tone options (Professional, Casual, Academic, Creative, Technical)',
      'Email support'
    ]
  },
  // Pro Annual
  'price_1SGMnjH8HT0u8xphJXTgm1Ii': {
    name: 'Pro Plan',
    wordLimit: 15000,
    billingPeriod: 'Annual',
    hasExtension: false,
    features: [
      '15,000 words per month',
      'Web dashboard access only (no Chrome Extension)',
      'Advanced AI engines (GPT-4, Claude) + Fast engines',
      '50+ languages supported',
      'All tone options (Professional, Casual, Academic, Creative, Technical)',
      'Email support',
      '💰 Save 40% with annual billing'
    ]
  },
  // Extension-Only
  'price_1SGNtsH8HT0u8xphEd7pG9Po': {
    name: 'Extension-Only Plan',
    wordLimit: 5000,
    billingPeriod: 'Monthly',
    hasExtension: true,
    features: [
      '5,000 words per month',
      'Chrome Extension access only',
      'Fast AI engines',
      '50+ languages supported',
      'All tone options (Professional, Casual, Academic, Creative, Technical)',
      'Email support'
    ]
  }
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No stripe-signature header found");
    }

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const body = await req.text();
    
    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Webhook signature verified", { eventType: event.type });
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err.message });
      return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      logStep("Processing checkout session", { 
        sessionId: session.id,
        customerEmail: session.customer_email,
        customer: session.customer
      });

      // Get customer email
      let customerEmail = session.customer_email;
      if (!customerEmail && session.customer) {
        const customer = await stripe.customers.retrieve(session.customer as string) as Stripe.Customer;
        customerEmail = customer.email || null;
      }

      if (!customerEmail) {
        logStep("No customer email found, skipping receipt");
        return new Response(JSON.stringify({ received: true, skipped: "no_email" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get line items to find the price ID
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
      const priceId = lineItems.data[0]?.price?.id;

      if (!priceId) {
        logStep("No price ID found in session");
        return new Response(JSON.stringify({ received: true, skipped: "no_price" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const planDetails = PLAN_DETAILS[priceId];
      if (!planDetails) {
        logStep("Unknown price ID", { priceId });
        return new Response(JSON.stringify({ received: true, skipped: "unknown_price" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      logStep("Matched plan details", { 
        priceId, 
        planName: planDetails.name,
        customerEmail 
      });

      // Get amount paid
      const amountPaid = (session.amount_total || 0) / 100;
      const currency = (session.currency || 'usd').toUpperCase();

      // Get invoice ID for receipt number
      const invoiceId = session.invoice || session.id;

      // Format features list for email
      const featuresHtml = planDetails.features
        .map(feature => `          ✓ ${feature}`)
        .join('\n');

      // Construct email
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 30px 0; border-bottom: 3px solid #8B5CF6; }
    .header h1 { color: #8B5CF6; margin: 0; font-size: 28px; }
    .content { padding: 30px 0; }
    .section { margin: 25px 0; padding: 20px; background: #f9fafb; border-radius: 8px; }
    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #1f2937; }
    .detail-row { margin: 8px 0; }
    .detail-label { font-weight: 600; color: #6b7280; }
    .features { white-space: pre-line; font-family: monospace; background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #8B5CF6; }
    .cta-button { display: inline-block; padding: 12px 24px; background: #8B5CF6; color: white; text-decoration: none; border-radius: 6px; margin: 10px 10px 10px 0; }
    .footer { text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; margin-top: 40px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Payment Received Successfully!</h1>
    </div>
    
    <div class="content">
      <p>Hi there,</p>
      <p>Thank you for subscribing to <strong>SapienWrite</strong>! Your payment has been processed successfully.</p>
      
      <div class="section">
        <div class="section-title">📋 SUBSCRIPTION DETAILS</div>
        <div class="detail-row"><span class="detail-label">Plan:</span> ${planDetails.name}</div>
        <div class="detail-row"><span class="detail-label">Amount:</span> $${amountPaid.toFixed(2)} ${currency}</div>
        <div class="detail-row"><span class="detail-label">Billing Period:</span> ${planDetails.billingPeriod}</div>
        <div class="detail-row"><span class="detail-label">Payment Date:</span> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div class="detail-row"><span class="detail-label">Receipt #:</span> ${invoiceId}</div>
      </div>
      
      <div class="section">
        <div class="section-title">✨ WHAT'S INCLUDED</div>
        <div class="features">${featuresHtml}</div>
      </div>
      
      <div class="section">
        <div class="section-title">🚀 GET STARTED</div>
        <p>Your subscription is now active! Here's what to do next:</p>
        <a href="https://sapienwrite.com/dashboard" class="cta-button">Visit Dashboard</a>
        ${planDetails.hasExtension ? '<a href="https://sapienwrite.com/chrome-extension" class="cta-button">Get Chrome Extension</a>' : ''}
        <a href="https://sapienwrite.com/" class="cta-button">Manage Subscription</a>
      </div>
      
      <p>Need help? Reply to this email or contact us at <a href="mailto:rauanberdali@gmail.com">rauanberdali@gmail.com</a></p>
      
      <p>Best regards,<br><strong>The SapienWrite Team</strong></p>
    </div>
    
    <div class="footer">
      <p>SapienWrite - AI-Powered Human Writing</p>
      <p><a href="https://sapienwrite.com/privacy-policy">Privacy Policy</a> | <a href="https://sapienwrite.com/terms-of-service">Terms of Service</a></p>
    </div>
  </div>
</body>
</html>
      `;

      // Send email via Resend
      try {
        const emailResponse = await resend.emails.send({
          from: "SapienWrite <onboarding@resend.dev>",
          to: [customerEmail],
          subject: `Receipt for SapienWrite ${planDetails.name} - $${amountPaid.toFixed(2)}`,
          html: emailHtml,
        });

        logStep("Receipt email sent successfully", { 
          emailId: emailResponse.id,
          customerEmail,
          planName: planDetails.name
        });

        return new Response(JSON.stringify({ 
          received: true, 
          email_sent: true,
          email_id: emailResponse.id
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (emailError) {
        logStep("Failed to send receipt email", { error: emailError.message });
        // Don't fail the webhook if email fails
        return new Response(JSON.stringify({ 
          received: true, 
          email_sent: false,
          error: emailError.message
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Handle invoice.payment_succeeded event (for recurring payments)
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      
      // Skip if it's the first invoice (already handled by checkout.session.completed)
      if (invoice.billing_reason === "subscription_create") {
        logStep("Skipping first invoice (handled by checkout.session.completed)");
        return new Response(JSON.stringify({ received: true, skipped: "first_invoice" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      logStep("Processing recurring invoice", { 
        invoiceId: invoice.id,
        customerEmail: invoice.customer_email
      });

      const customerEmail = invoice.customer_email;
      if (!customerEmail) {
        logStep("No customer email found");
        return new Response(JSON.stringify({ received: true, skipped: "no_email" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const priceId = invoice.lines.data[0]?.price?.id;
      if (!priceId) {
        logStep("No price ID found in invoice");
        return new Response(JSON.stringify({ received: true, skipped: "no_price" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const planDetails = PLAN_DETAILS[priceId];
      if (!planDetails) {
        logStep("Unknown price ID", { priceId });
        return new Response(JSON.stringify({ received: true, skipped: "unknown_price" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountPaid = (invoice.amount_paid || 0) / 100;
      const currency = (invoice.currency || 'usd').toUpperCase();

      const featuresHtml = planDetails.features
        .map(feature => `          ✓ ${feature}`)
        .join('\n');

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 30px 0; border-bottom: 3px solid #8B5CF6; }
    .header h1 { color: #8B5CF6; margin: 0; font-size: 28px; }
    .content { padding: 30px 0; }
    .section { margin: 25px 0; padding: 20px; background: #f9fafb; border-radius: 8px; }
    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #1f2937; }
    .detail-row { margin: 8px 0; }
    .detail-label { font-weight: 600; color: #6b7280; }
    .features { white-space: pre-line; font-family: monospace; background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #8B5CF6; }
    .cta-button { display: inline-block; padding: 12px 24px; background: #8B5CF6; color: white; text-decoration: none; border-radius: 6px; margin: 10px 10px 10px 0; }
    .footer { text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; margin-top: 40px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Subscription Renewed Successfully!</h1>
    </div>
    
    <div class="content">
      <p>Hi there,</p>
      <p>Your <strong>SapienWrite</strong> subscription has been renewed. Thank you for your continued support!</p>
      
      <div class="section">
        <div class="section-title">📋 PAYMENT DETAILS</div>
        <div class="detail-row"><span class="detail-label">Plan:</span> ${planDetails.name}</div>
        <div class="detail-row"><span class="detail-label">Amount:</span> $${amountPaid.toFixed(2)} ${currency}</div>
        <div class="detail-row"><span class="detail-label">Billing Period:</span> ${planDetails.billingPeriod}</div>
        <div class="detail-row"><span class="detail-label">Payment Date:</span> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div class="detail-row"><span class="detail-label">Receipt #:</span> ${invoice.id}</div>
      </div>
      
      <div class="section">
        <div class="section-title">✨ YOUR PLAN INCLUDES</div>
        <div class="features">${featuresHtml}</div>
      </div>
      
      <div class="section">
        <div class="section-title">🚀 CONTINUE WRITING</div>
        <a href="https://sapienwrite.com/dashboard" class="cta-button">Visit Dashboard</a>
        ${planDetails.hasExtension ? '<a href="https://sapienwrite.com/chrome-extension" class="cta-button">Chrome Extension</a>' : ''}
        <a href="https://sapienwrite.com/" class="cta-button">Manage Subscription</a>
      </div>
      
      <p>Need help? Reply to this email or contact us at <a href="mailto:rauanberdali@gmail.com">rauanberdali@gmail.com</a></p>
      
      <p>Best regards,<br><strong>The SapienWrite Team</strong></p>
    </div>
    
    <div class="footer">
      <p>SapienWrite - AI-Powered Human Writing</p>
      <p><a href="https://sapienwrite.com/privacy-policy">Privacy Policy</a> | <a href="https://sapienwrite.com/terms-of-service">Terms of Service</a></p>
    </div>
  </div>
</body>
</html>
      `;

      try {
        const emailResponse = await resend.emails.send({
          from: "SapienWrite <onboarding@resend.dev>",
          to: [customerEmail],
          subject: `Subscription Renewed - ${planDetails.name} - $${amountPaid.toFixed(2)}`,
          html: emailHtml,
        });

        logStep("Renewal receipt sent successfully", { 
          emailId: emailResponse.id,
          customerEmail,
          planName: planDetails.name
        });

        return new Response(JSON.stringify({ 
          received: true, 
          email_sent: true,
          email_id: emailResponse.id
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (emailError) {
        logStep("Failed to send renewal receipt", { error: emailError.message });
        return new Response(JSON.stringify({ 
          received: true, 
          email_sent: false,
          error: emailError.message
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // For other event types, just acknowledge
    logStep("Event received but not processed", { eventType: event.type });
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in webhook handler", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
