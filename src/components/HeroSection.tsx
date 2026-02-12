import { Button } from "@/components/ui/button";
import { Chrome, MousePointerClick, Languages, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 md:py-32 bg-hero-bg">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Humanize AI Text{" "}
            <span className="text-primary">Anywhere</span> on the Web
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Right-click any text to rephrase, fix grammar, and humanize — directly in Gmail, LinkedIn, Docs, and more.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button
              size="lg"
              className="bg-success hover:bg-success/90 text-success-foreground px-8 py-6 text-lg font-semibold shadow-lg"
              onClick={() => window.open('https://chromewebstore.google.com/detail/sapienwrite-ai-humanizer/khkhchbmepbipcdlbgdkjdpfjbkcpbij', '_blank')}
            >
              <Chrome className="w-5 h-5 mr-2" />
              Install Chrome Extension
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-8 py-6 text-lg"
              onClick={() => navigate('/auth')}
            >
              Sign Up Free
            </Button>
          </div>

          {/* Context Menu Demo Visual */}
          <div className="max-w-lg mx-auto bg-card border-2 border-border rounded-xl shadow-xl p-6 text-left">
            <p className="text-sm text-muted-foreground mb-3 font-mono">
              "The utilization of artificial intelligence in modern workflows has demonstrated significant improvements..."
            </p>
            <div className="bg-popover border border-border rounded-lg shadow-lg w-64 ml-auto">
              <div className="py-1">
                <div className="px-4 py-2 text-sm font-semibold text-foreground border-b border-border flex items-center gap-2">
                  <img src="/favicon.png" alt="" className="w-4 h-4" />
                  SapienWrite
                </div>
                <div className="px-4 py-2 text-sm text-foreground hover:bg-accent/10 cursor-default flex items-center gap-2">
                  <MousePointerClick className="w-3.5 h-3.5 text-primary" />
                  Humanize Selected Text
                </div>
                <div className="px-4 py-2 text-sm text-primary font-medium bg-accent/10 cursor-default flex items-center gap-2">
                  <Languages className="w-3.5 h-3.5" />
                  Casual Tone
                </div>
                <div className="px-4 py-2 text-sm text-foreground hover:bg-accent/10 cursor-default flex items-center gap-2">
                  <Languages className="w-3.5 h-3.5 text-muted-foreground" />
                  Formal Tone
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              ↑ Right-click any selected text to see this menu
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
