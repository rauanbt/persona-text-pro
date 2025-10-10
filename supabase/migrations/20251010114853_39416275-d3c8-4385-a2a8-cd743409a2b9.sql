-- Remove detection tracking from usage_tracking table
-- Drop trigger first
DROP TRIGGER IF EXISTS set_detection_limit_trigger ON usage_tracking;

-- Drop functions
DROP FUNCTION IF EXISTS get_detection_limit(text);
DROP FUNCTION IF EXISTS set_detection_limit();

-- Remove columns
ALTER TABLE usage_tracking 
  DROP COLUMN IF EXISTS detection_count,
  DROP COLUMN IF EXISTS detection_limit;
