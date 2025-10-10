-- Fix search_path security issue for get_detection_limit function
CREATE OR REPLACE FUNCTION public.get_detection_limit(plan_name text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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