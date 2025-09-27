-- Add extra words balance to profiles table
ALTER TABLE public.profiles 
ADD COLUMN extra_words_balance integer DEFAULT 0;

-- Create table to track extra word purchases
CREATE TABLE public.extra_word_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  price_id text NOT NULL,
  word_amount integer NOT NULL,
  amount_paid integer NOT NULL, -- in cents
  stripe_payment_intent_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.extra_word_purchases ENABLE ROW LEVEL SECURITY;

-- Create policies for extra_word_purchases
CREATE POLICY "Users can view their own purchases" 
ON public.extra_word_purchases 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchases" 
ON public.extra_word_purchases 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_extra_word_purchases_user_id ON public.extra_word_purchases(user_id);
CREATE INDEX idx_extra_word_purchases_created_at ON public.extra_word_purchases(created_at DESC);