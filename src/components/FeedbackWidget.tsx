import { useState } from "react";
import { Bug, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const FeedbackWidget = () => {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature'>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user, subscriptionData } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please describe your feedback",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const payload = {
        feedback_type: feedbackType,
        message: message.trim(),
        severity: feedbackType === 'bug' ? severity : undefined,
        email: email || user?.email || undefined,
        current_url: window.location.href,
        current_page: window.location.pathname,
        user_agent: navigator.userAgent,
        app_state: {
          plan: subscriptionData.plan,
        },
      };

      const { error } = await supabase.functions.invoke('submit-feedback', {
        body: payload,
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`,
        } : {},
      });

      if (error) throw error;

      toast({
        title: "Feedback submitted!",
        description: "Thank you for helping us improve SapienWrite",
      });

      // Reset form
      setMessage('');
      setEmail('');
      setSeverity('medium');
      setFeedbackType('bug');
      setOpen(false);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Failed to submit",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg bg-background border-2 hover:scale-105 transition-transform"
            title="Report a bug or suggest a feature"
          >
            <Bug className="h-6 w-6" />
          </Button>
        </DialogTrigger>
        
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Share Your Feedback
            </DialogTitle>
            <DialogDescription>
              Help us improve SapienWrite by reporting bugs or suggesting features
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Feedback Type */}
            <div className="space-y-2">
              <Label>What would you like to share?</Label>
              <RadioGroup
                value={feedbackType}
                onValueChange={(value) => setFeedbackType(value as 'bug' | 'feature')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bug" id="bug" />
                  <Label htmlFor="bug" className="cursor-pointer">
                    🐛 Bug Report
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="feature" id="feature" />
                  <Label htmlFor="feature" className="cursor-pointer">
                    💡 Feature Request
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Severity (only for bugs) */}
            {feedbackType === 'bug' && (
              <div className="space-y-2">
                <Label htmlFor="severity">How severe is this issue?</Label>
                <Select value={severity} onValueChange={(value) => setSeverity(value as any)}>
                  <SelectTrigger id="severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Minor inconvenience</SelectItem>
                    <SelectItem value="medium">Medium - Affects workflow</SelectItem>
                    <SelectItem value="high">High - Blocking issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">
                {feedbackType === 'bug' ? 'Describe the bug' : 'Describe your feature idea'} *
              </Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  feedbackType === 'bug'
                    ? "What happened? What did you expect to happen?"
                    : "What feature would you like to see and why?"
                }
                rows={4}
                maxLength={1000}
                required
              />
              <p className="text-xs text-muted-foreground">
                {message.length}/1000 characters
              </p>
            </div>

            {/* Email (optional if not logged in) */}
            {!user && (
              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
                <p className="text-xs text-muted-foreground">
                  We'll only use this to follow up on your feedback
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
