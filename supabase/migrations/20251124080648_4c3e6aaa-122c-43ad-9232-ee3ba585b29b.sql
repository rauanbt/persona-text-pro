-- Create missing usage_tracking record for current user
INSERT INTO usage_tracking (user_id, month_year, words_used, extension_words_used, requests_count)
VALUES ('09e77fa6-9406-4131-913c-62544243421d', '2025-11', 0, 0, 0)
ON CONFLICT (user_id, month_year) 
DO UPDATE SET updated_at = NOW();