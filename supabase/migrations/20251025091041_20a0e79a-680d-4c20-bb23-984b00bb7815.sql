-- Remove the tone constraint - application-level validation in edge function is sufficient
-- This prevents conflicts with live operations and allows tone evolution
ALTER TABLE humanization_requests 
DROP CONSTRAINT IF EXISTS humanization_requests_tone_check;

-- Update any legacy tone values to current supported ones
UPDATE humanization_requests SET tone = 'sarcastic' WHERE tone = 'funny';
UPDATE humanization_requests SET tone = 'formal' WHERE tone = 'smart';