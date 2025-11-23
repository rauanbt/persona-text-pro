-- Add first_subscription_date to profiles table to track when user first subscribed to a paid plan
ALTER TABLE profiles 
ADD COLUMN first_subscription_date timestamp with time zone;

-- Add comment for clarity
COMMENT ON COLUMN profiles.first_subscription_date IS 'Timestamp when user first subscribed to a paid plan, used to calculate prorated first month';