import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Package, Zap } from 'lucide-react';

const WORD_PACKAGES = [
  {
    id: 'price_1SD82KH8HT0u8xphXJbo7pPd',
    name: '5,000 Extra Words',
    words: 5000,
    price: '$12.99',
    description: 'Perfect for small projects',
    icon: Package,
    popular: false
  },
  {
    id: 'price_1SD82WH8HT0u8xphP7eGLpUi',
    name: '10,000 Extra Words',
    words: 10000,
    price: '$22.99',
    description: 'Great value for regular users',
    icon: Sparkles,
    popular: true
  },
  {
    id: 'price_1SD82iH8HT0u8xphiQxkr7rG',
    name: '25,000 Extra Words',
    words: 25000,
    price: '$49.99',
    description: 'Best for heavy users',
    icon: Zap,
    popular: false
  }
];

interface ExtraWordsPackagesProps {
  onClose?: () => void;
}

export const ExtraWordsPackages: React.FC<ExtraWordsPackagesProps> = ({ onClose }) => {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState<string | null>(null);

  const handlePurchase = async (priceId: string, packageName: string) => {
    try {
      setLoading(priceId);
      
      const { data, error } = await supabase.functions.invoke('purchase-extra-words', {
        body: { priceId }
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Error purchasing extra words:', error);
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to initiate purchase. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold">Extra Words Packages</h3>
        <p className="text-muted-foreground">
          Get more words to continue humanizing your content
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {WORD_PACKAGES.map((pkg) => {
          const Icon = pkg.icon;
          return (
            <Card key={pkg.id} className={`relative ${pkg.popular ? 'border-primary shadow-lg' : ''}`}>
              {pkg.popular && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
                  Most Popular
                </Badge>
              )}
              
              <CardHeader className="text-center space-y-2">
                <div className="mx-auto p-3 bg-primary/10 rounded-full w-fit">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{pkg.name}</CardTitle>
                <CardDescription>{pkg.description}</CardDescription>
                <div className="text-3xl font-bold text-primary">{pkg.price}</div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {pkg.words.toLocaleString()} additional words
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Never expires • Use anytime
                  </p>
                </div>
                
                <Button 
                  onClick={() => handlePurchase(pkg.id, pkg.name)}
                  disabled={loading === pkg.id}
                  className="w-full"
                  variant={pkg.popular ? "default" : "outline"}
                >
                  {loading === pkg.id ? "Processing..." : "Purchase Now"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {onClose && (
        <div className="text-center">
          <Button variant="ghost" onClick={onClose}>
            Maybe Later
          </Button>
        </div>
      )}
    </div>
  );
};