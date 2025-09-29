import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

export const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleAuthClick = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  const handlePricingClick = () => {
    if (window.location.pathname === '/') {
      const pricingElement = document.getElementById('pricing');
      if (pricingElement) {
        pricingElement.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate('/', { replace: true });
      setTimeout(() => {
        const pricingElement = document.getElementById('pricing');
        if (pricingElement) {
          pricingElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  return (
    <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
          <span className="text-2xl font-cave font-bold" style={{ color: '#8B4513' }}>SapienWrite</span>
        </div>
        
        <nav className="hidden md:flex items-center space-x-6">
          <span 
            className="text-foreground hover:text-primary transition-colors cursor-pointer"
            onClick={() => navigate('/')}
          >
            AI Humanizer
          </span>
          <span 
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            onClick={() => navigate('/blog')}
          >
            Blog
          </span>
          <span 
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            onClick={() => navigate('/contact')}
          >
            Contact
          </span>
          <span 
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            onClick={handlePricingClick}
          >
            Pricing
          </span>
          <button className="text-muted-foreground hover:text-foreground transition-colors cursor-not-allowed opacity-60">
            Chrome Extension
          </button>
        </nav>

        <div className="flex items-center space-x-3">
          {user ? (
            <>
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
              <Button variant="outline" onClick={signOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate('/auth')}>
                Log in
              </Button>
              <Button 
                className="bg-success hover:bg-success/90 text-success-foreground"
                onClick={() => navigate('/auth')}
              >
                Try for free
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};