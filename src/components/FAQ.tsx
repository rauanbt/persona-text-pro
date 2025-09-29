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
      answer: "SapienWrite uses advanced natural language processing to rewrite AI-generated text, making it sound more human while applying your chosen tone (Regular, Funny, Sarcastic, or Smart). Our system analyzes patterns that AI detectors flag and replaces them with more natural alternatives."
    },
    {
      question: "Does SapienWrite bypass AI detection tools?",
      answer: "Yes! Our system is specifically designed to bypass all major AI detection tools including GPTZero, Copyleaks, ZeroGPT, and many others. We continuously test against these tools and update our algorithms to maintain effectiveness."
    },
    {
      question: "How much does SapienWrite cost?",
      answer: "We offer a free plan with 1,500 words per month. Our Pro plan is $27.98/month for 15,000 words, and Ultra is $57.98/month for 30,000 words. Annual plans offer 40% savings - Pro at $201.48/year and Ultra at $417.48/year."
    },
    {
      question: "What are the different tone options?",
      answer: "We offer 4 distinct tones: Regular (professional and natural), Funny (light-hearted and humorous), Sarcastic (witty and sharp), and Smart (sophisticated and intellectual). Each tone maintains the humanization while adding personality to your content."
    },
    {
      question: "What languages does SapienWrite support?",
      answer: "SapienWrite supports over 50 languages for Pro and Ultra plans, while the free plan supports English. All tone options work across all supported languages for a truly global experience."
    },
    {
      question: "I want to humanize a long essay. Is it possible?",
      answer: "Yes! Depending on your plan, you can process anywhere from 500 words (free) to 200,000 words per month (Enterprise). For longer documents, you can process them in chunks or upgrade to a higher plan."
    },
    {
      question: "Can I see my previous humanizations?",
      answer: "Yes, all paid plans include a dashboard where you can view your processing history, download previous results, and track your monthly usage across all tone options."
    },
    {
      question: "How do I cancel my subscription?",
      answer: "You can cancel your subscription anytime from your account dashboard. There are no cancellation fees, and you'll retain access to your plan features until the end of your billing period."
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