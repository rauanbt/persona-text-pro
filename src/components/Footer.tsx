import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

export const Footer = () => {
  return (
    <footer className="bg-background border-t">
      {/* CTA Section */}
      <section className="py-16 bg-hero-bg">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Make Your Text Sound Human - Instantly
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-3xl mx-auto">
            Turn robotic, AI-generated content into clear, natural writing that sounds like a real person. Whether it's from ChatGPT or another tool, SapienWrite helps you bypass AI detectors and add personality with custom tones in just one click.
          </p>
          <Button size="lg" className="bg-success hover:bg-success/90 text-success-foreground px-8 py-6 text-lg font-semibold shadow-lg">
            <Sparkles className="w-5 h-5 mr-2" />
            Start for free
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            750 words for free. No credit card required
          </p>
        </div>
      </section>

      {/* Footer Links */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="md:col-span-2 lg:col-span-1">
            <div className="mb-4">
              <span className="text-2xl font-bold" style={{ color: '#8B4513' }}>SapienWrite</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The most advanced AI text humanizer with custom tone options. Make your content undetectable and engaging.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Product</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground transition-colors">AI Humanizer</Link></li>
              <li><span className="text-muted-foreground/60 cursor-not-allowed">Chrome Extension</span></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Company</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground transition-colors">About</Link></li>
              <li><Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link></li>
              <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 SapienWrite. All rights reserved. Built with ❤️ for authentic content creators.</p>
        </div>
      </div>
    </footer>
  );
};