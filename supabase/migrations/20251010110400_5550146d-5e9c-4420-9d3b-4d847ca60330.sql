-- Add detection tracking columns to usage_tracking table
ALTER TABLE public.usage_tracking
ADD COLUMN IF NOT EXISTS detection_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS detection_limit integer;

-- Create function to determine detection limit based on plan
CREATE OR REPLACE FUNCTION public.get_detection_limit(plan_name text)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN CASE plan_name
    WHEN 'free' THEN 5
    WHEN 'extension_only' THEN 0
    WHEN 'pro' THEN 50
    WHEN 'ultra' THEN 100
    WHEN 'wordsmith' THEN 50  -- legacy
    WHEN 'master' THEN 100     -- legacy
    ELSE 5  -- default to free tier
  END;
END;
$$;

-- Create trigger function to set detection limit on insert
CREATE OR REPLACE FUNCTION public.set_detection_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan text;
BEGIN
  -- Get user's current plan
  SELECT current_plan INTO user_plan
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  
  -- Set the detection limit based on plan
  NEW.detection_limit := public.get_detection_limit(COALESCE(user_plan, 'free'));
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically set detection_limit on new usage_tracking records
DROP TRIGGER IF EXISTS set_detection_limit_trigger ON public.usage_tracking;
CREATE TRIGGER set_detection_limit_trigger
  BEFORE INSERT ON public.usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.set_detection_limit();

-- Update existing records with appropriate detection limits
UPDATE public.usage_tracking ut
SET detection_limit = public.get_detection_limit(COALESCE(p.current_plan, 'free'))
FROM public.profiles p
WHERE ut.user_id = p.user_id
  AND ut.detection_limit IS NULL;