-- Add Google OAuth support to donors table
ALTER TABLE donors ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
-- Allow password_hash to be nullable for Google-only accounts
ALTER TABLE donors ALTER COLUMN password_hash DROP NOT NULL;
-- Allow phone_number to be nullable for Google sign-up (can be filled later)
ALTER TABLE donors ALTER COLUMN phone_number DROP NOT NULL;
-- Allow date_of_birth to be nullable for Google sign-up (can be filled later)
ALTER TABLE donors ALTER COLUMN date_of_birth DROP NOT NULL;
