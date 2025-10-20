-- Create feedback submissions table
CREATE TABLE public.feedback_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- User info
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  plan text,
  
  -- Feedback content
  feedback_type text NOT NULL CHECK (feedback_type IN ('bug', 'feature')),
  message text NOT NULL,
  severity text CHECK (severity IN ('low', 'medium', 'high')),
  
  -- Context
  current_url text,
  current_page text,
  user_agent text,
  app_state jsonb,
  
  -- Status tracking
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  admin_notes text
);

-- Enable RLS
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert feedback (both authenticated and anonymous)
CREATE POLICY "Anyone can submit feedback"
ON public.feedback_submissions
FOR INSERT
TO public
WITH CHECK (true);

-- Only authenticated users can view their own submissions
CREATE POLICY "Users can view their own feedback"
ON public.feedback_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_feedback_status ON public.feedback_submissions(status);
CREATE INDEX idx_feedback_created_at ON public.feedback_submissions(created_at DESC);
CREATE INDEX idx_feedback_user_id ON public.feedback_submissions(user_id);