import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const FAQ = () => {
  const faqs = [
    {
      question: "How does SapienWrite work?",
      answer: "SapienWrite uses advanced natural language processing to rewrite AI-generated text, making it sound more human while applying your chosen tone (Regular, Casual, Formal, Funny, Sarcastic, or Smart). Our system analyzes patterns that AI detectors flag and replaces them with more natural alternatives."
    },
    {
      question: "Does SapienWrite bypass AI detection tools?",
      answer: "Yes! Our system is specifically designed to bypass all major AI detection tools. We use advanced multi-model AI analysis (powered by Gemini, GPT, and Claude) to ensure your humanized text passes detection checks. We continuously test and update our algorithms to maintain effectiveness."
    },
    {
      question: "Are there limits on AI detection checks?",
      answer: "No! We offer unlimited AI detection checks for all users. Free users can check up to 500 words per request, while paid subscribers (Pro, Ultra) can check up to 2,500 words per request. There's no monthly limit on the number of checks you can perform."
    },
    {
      question: "How much does SapienWrite cost?",
      answer: "Our Pro plan is $24.95/month (or $14.97/month annually) for 15,000 words, and Ultra is $54.95/month (or $32.97/month annually) for 30,000 words. Annual plans save you 40% - Pro at $179.64/year and Ultra at $395.64/year. We also offer a free plan with 750 words/month to get you started, and an Extension-Only plan at $12.95/month with 5,000 words for Chrome Extension access."
    },
    {
      question: "What are the different tone options?",
      answer: "We offer 6 distinct tones: Regular (professional and natural), Casual (relaxed and conversational), Formal (structured and polished), Funny (light-hearted and humorous), Sarcastic (witty and sharp), and Smart (sophisticated and intellectual). Each tone maintains the humanization while adding personality to your content."
    },
    {
      question: "Is there a Chrome extension?",
      answer: "Yes! The SapienWrite Chrome Extension is available in two ways: (1) Included FREE with our Ultra plan ($54.95/month), or (2) Available as a standalone Extension-Only subscription for $12.95/month with 5,000 words. The extension lets you humanize text anywhere on the web with a simple right-click."
    },
    {
      question: "What languages does SapienWrite support?",
      answer: "SapienWrite supports over 50 languages for Pro and Ultra plans, while the free plan supports English. All tone options work across all supported languages for a truly global experience."
    },
    {
      question: "I want to humanize a long essay. Is it possible?",
      answer: "Yes! Depending on your plan, you can process from 750 words per month (free) to 30,000 words per month (Ultra). For longer documents, you can process them in chunks or upgrade to a higher plan. You can also purchase extra word packages (5,000 for $12.99, 10,000 for $22.99, or 25,000 for $49.99) that never expire."
    },
    {
      question: "Can I see my previous humanizations?",
      answer: "Yes, all paid plans include a dashboard where you can view your processing history, download previous results, and track your monthly usage across all tone options."
    },
    {
      question: "What is your refund policy?",
      answer: "All sales are final. Due to the nature of AI-powered services and the immediate computational costs involved, we do not offer refunds on paid subscriptions. We encourage you to fully test our platform using the free 750-word trial before upgrading."
    },
    {
      question: "How do I cancel my subscription?",
      answer: "You can cancel your subscription anytime through the Stripe Customer Portal accessible from your dashboard. There are no cancellation fees. All sales are final with no refunds. You'll retain full access to your plan features until the end of your current billing period."
    }
  ];

  return (
    <section className="py-16 bg-feature-bg">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to know about SapienWrite
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="bg-background rounded-lg border border-border shadow-sm"
              >
                <AccordionTrigger className="px-6 py-4 text-left font-semibold text-foreground hover:no-underline hover:bg-muted/50 transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4 text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};