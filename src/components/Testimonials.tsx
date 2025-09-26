import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

export const Testimonials = () => {
  const testimonials = [
    {
      quote: "SapienWrite helped me humanize AI text from ChatGPT in seconds. The sarcastic tone option made my LinkedIn posts way more engaging. This tool saved my content strategy.",
      author: "Julia K.",
      role: "Content Marketing Manager"
    },
    {
      quote: "I've tried several tools to bypass AI detectors, but nothing compares to SapienWrite. The tone options are genius - I use 'Smart' for research papers and 'Funny' for social media.",
      author: "Liam R.",
      role: "Freelance Writer"
    },
    {
      quote: "The best thing about SapienWrite? I can humanize my text and add personality with different tones. My emails now sound personal, not robotic. Game changer!",
      author: "Sophie M.",
      role: "Sales Executive"
    }
  ];

  const universities = [
    { name: "Harvard", emoji: "🏛️" },
    { name: "Oxford", emoji: "📚" },
    { name: "MIT", emoji: "🔬" },
    { name: "Stanford", emoji: "🌲" }
  ];

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        {/* Universities */}
        <div className="text-center mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-8">
            Supporting writers at top institutions
          </h2>
          <div className="flex justify-center items-center space-x-8 flex-wrap gap-4">
            {universities.map((uni, index) => (
              <div key={index} className="flex items-center space-x-2 text-muted-foreground">
                <span className="text-2xl">{uni.emoji}</span>
                <span className="font-medium">{uni.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            What our users say
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-card border-border shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <blockquote className="text-foreground mb-4 leading-relaxed">
                    "{testimonial.quote}"
                  </blockquote>
                  <footer>
                    <div className="font-semibold text-foreground">{testimonial.author}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </footer>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};