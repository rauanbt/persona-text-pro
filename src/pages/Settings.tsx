import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Loader2, Trash2, Calendar, FileText } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

interface HumanizationRequest {
  id: string;
  created_at: string;
  original_text: string;
  humanized_text: string | null;
  tone: string;
  word_count: number;
}

const Settings = () => {
  const { user, signOut, subscriptionData } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<HumanizationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<HumanizationRequest | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const currentPlan = subscriptionData.plan;

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('humanization_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast({
        title: "Error",
        description: "Failed to load humanization history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    setIsDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');

      if (error) throw error;

      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted.",
      });

      await signOut();
      navigate('/');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive",
      });
      setIsDeletingAccount(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Text copied to clipboard",
    });
  };

  const openDetailDialog = (request: HumanizationRequest) => {
    setSelectedRequest(request);
    setShowDetailDialog(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.email}
            </span>
            <Button onClick={signOut} variant="outline" size="sm">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs defaultValue="history" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Humanization History</CardTitle>
                <CardDescription>
                  View your recent humanization requests (last 50)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No humanization history yet</p>
                    <p className="text-sm mt-1">Start humanizing text to see your history here</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-3">
                      {history.map((request) => (
                        <Card key={request.id} className="border-l-4 border-l-primary">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {request.tone}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(request.created_at), 'MMM d, yyyy h:mm a')}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {request.word_count} words
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {request.original_text}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDetailDialog(request)}
                                >
                                  View
                                </Button>
                                {request.humanized_text && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(request.humanized_text!)}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Account Management</CardTitle>
                <CardDescription>
                  Manage your account settings and data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Account Info */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Account Information</h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Email: {user?.email}</p>
                    <p>Current Plan: <Badge variant="secondary">{currentPlan.toUpperCase()}</Badge></p>
                  </div>
                </div>

                {/* Delete Account Section */}
                <div className="border-t pt-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Once you delete your account, there is no going back. Please be certain.
                      </p>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Account
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription className="space-y-3">
                            <p>
                              This action <strong>cannot be undone</strong>. This will permanently delete your account and remove all your data from our servers, including:
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                              <li>All usage history and word balances</li>
                              <li>All humanization requests</li>
                              <li>All extra word purchases</li>
                              <li>Your account profile</li>
                              {(currentPlan === 'ultra' || currentPlan === 'master' || currentPlan === 'extension_only') && (
                                <li className="text-amber-600 dark:text-amber-400 font-semibold">
                                  <strong>Active Stripe subscriptions will be canceled</strong>
                                </li>
                              )}
                            </ul>
                            {(currentPlan === 'ultra' || currentPlan === 'master' || currentPlan === 'extension_only') && (
                              <p className="text-amber-600 dark:text-amber-400 font-semibold">
                                ⚠️ Your {currentPlan === 'extension_only' ? 'Extension' : 'Ultra'} subscription will be canceled immediately.
                              </p>
                            )}
                            <p className="text-sm">
                              If you're using the Chrome extension, it will be automatically logged out and you'll need to sign up again if you want to use it in the future.
                            </p>
                            <div className="mt-4">
                              <label className="text-sm font-medium">
                                Type <code className="bg-muted px-1 py-0.5 rounded">DELETE</code> to confirm:
                              </label>
                              <Input
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder="Type DELETE"
                                className="mt-2"
                              />
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteAccount}
                            disabled={deleteConfirmText !== 'DELETE' || isDeletingAccount}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {isDeletingAccount ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              'Delete Account'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Humanization Details
              {selectedRequest && (
                <Badge variant="secondary" className="text-xs">
                  {selectedRequest.tone}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(selectedRequest.created_at), 'MMM d, yyyy h:mm a')}
                </span>
                <span>{selectedRequest.word_count} words</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Original Text</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(selectedRequest.original_text)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                  <p className="text-sm whitespace-pre-wrap">{selectedRequest.original_text}</p>
                </ScrollArea>
              </div>

              {selectedRequest.humanized_text && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Humanized Text</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(selectedRequest.humanized_text!)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <ScrollArea className="h-[200px] w-full rounded-md border p-4 bg-muted/50">
                    <p className="text-sm whitespace-pre-wrap">{selectedRequest.humanized_text}</p>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
