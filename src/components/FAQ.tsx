import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const FAQ = () => {
  const faqs = [
    {
      question: "How does HumanCraft AI work?",
      answer: "HumanCraft AI uses advanced natural language processing to rewrite AI-generated text, making it sound more human while applying your chosen tone (Regular, Funny, Sarcastic, or Smart). Our system analyzes patterns that AI detectors flag and replaces them with more natural alternatives."
    },
    {
      question: "Does HumanCraft AI bypass Turnitin and other AI checkers?",
      answer: "Yes! Our system is specifically designed to bypass all major AI detection tools including Turnitin, GPTZero, Copyleaks, ZeroGPT, and more. We test against these tools weekly and update our algorithms to maintain effectiveness."
    },
    {
      question: "How much does HumanCraft AI cost?",
      answer: "We offer a free plan with 500 words per month. Paid plans start at $8/month for 10,000 words. Our Pro plan at $19/month includes 50,000 words and API access, while Enterprise at $49/month provides 200,000 words and custom features."
    },
    {
      question: "What are the different tone options?",
      answer: "We offer 4 distinct tones: Regular (professional and natural), Funny (light-hearted and humorous), Sarcastic (witty and sharp), and Smart (sophisticated and intellectual). Each tone maintains the humanization while adding personality to your content."
    },
    {
      question: "What languages does HumanCraft AI support?",
      answer: "Currently, HumanCraft AI supports English content. We're working on adding support for Spanish, French, German, and other major languages. All tone options work across supported languages."
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
            Everything you need to know about HumanCraft AI
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