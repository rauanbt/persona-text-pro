import { Button } from "@/components/ui/button";
import { Chrome } from "lucide-react";
import { Link } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="bg-background border-t">
      {/* CTA Section */}
      <section className="py-16 bg-hero-bg">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Start Humanizing Text in Seconds
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Install the Chrome Extension and right-click any text to make it sound human. Free to start.
          </p>
          <Button
            size="lg"
            className="bg-success hover:bg-success/90 text-success-foreground px-8 py-6 text-lg font-semibold shadow-lg"
            onClick={() => window.open('https://chromewebstore.google.com/detail/sapienwrite-ai-humanizer/khkhchbmepbipcdlbgdkjdpfjbkcpbij', '_blank')}
          >
            <Chrome className="w-5 h-5 mr-2" />
            Install Chrome Extension
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            500 words free. No credit card required.
          </p>
        </div>
      </section>

      {/* Footer Links */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-lg font-bold" style={{ color: '#8B4513' }}>SapienWrite</span>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span 
              className="hover:text-foreground transition-colors cursor-pointer"
              onClick={() => {
                if (window.location.pathname === '/') {
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  window.location.href = '/#pricing';
                }
              }}
            >
              Pricing
            </span>
            <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms-of-service" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <a href="mailto:support@sapienwrite.com" className="hover:text-foreground transition-colors">Contact</a>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; 2025 SapienWrite. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
