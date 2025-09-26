import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

export const Header = () => {
  return (
    <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <img src={logo} alt="SapienWrite" className="w-8 h-8" />
          <span className="text-xl font-bold text-foreground">SapienWrite</span>
        </div>
        
        <nav className="hidden md:flex items-center space-x-6">
          <a href="#humanizer" className="text-foreground hover:text-primary transition-colors">
            AI Humanizer
          </a>
          <a href="#blog" className="text-muted-foreground hover:text-foreground transition-colors">
            Blog
          </a>
          <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">
            Contact
          </a>
          <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </a>
          <button className="text-muted-foreground hover:text-foreground transition-colors cursor-not-allowed opacity-60">
            Chrome Extension
          </button>
        </nav>

        <div className="flex items-center space-x-3">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
            Log in
          </Button>
          <Button className="bg-success hover:bg-success/90 text-success-foreground">
            Try for free
          </Button>
        </div>
      </div>
    </header>
  );
};