import React from 'react';
import { Button } from './ui/button';
import { Package } from 'lucide-react';

interface ExtraWordsPackagesProps {
  onClose?: () => void;
  currentPlan?: string;
}

export const ExtraWordsPackages: React.FC<ExtraWordsPackagesProps> = ({ onClose }) => {
  return (
    <div className="space-y-6 text-center py-8">
      <div className="mx-auto p-4 bg-primary/10 rounded-full w-fit">
        <Package className="w-8 h-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h3 className="text-2xl font-bold">Coming Soon</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Extra word packages are coming soon! We're working on flexible top-up options for when you need more words. Stay tuned.
        </p>
      </div>
      {onClose && (
        <Button onClick={onClose}>
          Got it
        </Button>
      )}
    </div>
  );
};
