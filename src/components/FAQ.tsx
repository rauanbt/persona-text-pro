import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const FAQ = () => {
  const faqs = [
    {
      question: "How does the Chrome Extension work?",
      answer: "Select any text on any webpage, right-click, and choose 'Humanize with SapienWrite.' Pick your preferred tone and the text is instantly replaced with a natural, human-sounding version."
    },
    {
      question: "Does SapienWrite bypass AI detection tools?",
      answer: "Yes! Our system uses advanced multi-model AI analysis (Gemini + ChatGPT + Claude) to ensure your humanized text passes detection checks from all major AI detectors."
    },
    {
      question: "Where does the extension work?",
      answer: "Everywhere — Gmail, LinkedIn, Google Docs, ChatGPT, social media, forums, and any website where you can select text. If you can highlight it, you can humanize it."
    },
    {
      question: "How much does it cost?",
      answer: "Free plan gives you 500 words/month. Extension-Only plan is $12.95/month for 5,000 words. Ultra plan is $39.95/month (or $23.97/month billed annually) for 40,000 words. All plans include 6 tone options and AI detection bypass."
    },
    {
      question: "What tone options are available?",
      answer: "We offer 6 tones: Regular (professional), Casual (conversational), Formal (polished), Funny (humorous), Sarcastic (witty), and Smart (sophisticated). Each is available via the right-click menu."
    },
    {
      question: "Can I buy extra words?",
      answer: "Yes! Paid plan users can purchase extra word packages: 5,000 for $12.99, 10,000 for $22.99, or 25,000 for $49.99. Extra words never expire."
    },
    {
      question: "What is your refund policy?",
      answer: "All sales are final due to immediate computational costs. We encourage testing with the free 500-word plan before upgrading."
    },
    {
      question: "How do I cancel my subscription?",
      answer: "Cancel anytime through the Stripe Customer Portal in your dashboard. No cancellation fees. You retain access until the end of your billing period."
    },
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
