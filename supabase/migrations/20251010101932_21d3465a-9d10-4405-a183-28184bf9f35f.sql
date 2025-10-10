-- Add extension_words_used column to usage_tracking table
ALTER TABLE usage_tracking 
ADD COLUMN extension_words_used integer DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN usage_tracking.extension_words_used IS 'Words used through Chrome Extension (separate tracking for Ultra plan bonus words)';