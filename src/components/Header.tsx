import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
          <span className="text-2xl font-bold" style={{ color: '#8B4513' }}>SapienWrite</span>
        </div>

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
