import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import logo from "@/assets/logo.png";

export const Footer = () => {
  return (
    <footer className="bg-background border-t">
      {/* CTA Section */}
      <section className="py-16 bg-hero-bg">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Make Your Text Sound Human — Instantly
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-3xl mx-auto">
            Turn robotic, AI-generated content into clear, natural writing that sounds like a real person. Whether it's from ChatGPT or another tool, HumanCraft AI helps you bypass AI detectors and add personality with custom tones in just one click.
          </p>
          <Button size="lg" className="bg-success hover:bg-success/90 text-success-foreground px-8 py-6 text-lg font-semibold shadow-lg">
            <Sparkles className="w-5 h-5 mr-2" />
            Start for free
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            500 words for free. No credit card required
          </p>
        </div>
      </section>

      {/* Footer Links */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <img src={logo} alt="HumanCraft AI" className="w-8 h-8" />
              <span className="text-xl font-bold text-foreground">HumanCraft AI</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The most advanced AI text humanizer with custom tone options. Make your content undetectable and engaging.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#humanizer" className="hover:text-foreground transition-colors">AI Humanizer</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
              <li><a href="#api" className="hover:text-foreground transition-colors">API</a></li>
              <li><a href="#changelog" className="hover:text-foreground transition-colors">Changelog</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#blog" className="hover:text-foreground transition-colors">Blog</a></li>
              <li><a href="#guides" className="hover:text-foreground transition-colors">Guides</a></li>
              <li><a href="#help" className="hover:text-foreground transition-colors">Help Center</a></li>
              <li><a href="#status" className="hover:text-foreground transition-colors">Status</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#about" className="hover:text-foreground transition-colors">About</a></li>
              <li><a href="#contact" className="hover:text-foreground transition-colors">Contact</a></li>
              <li><a href="#privacy" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
              <li><a href="#terms" className="hover:text-foreground transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 HumanCraft AI. All rights reserved. Built with ❤️ for authentic content creators.</p>
        </div>
      </div>
    </footer>
  );
};