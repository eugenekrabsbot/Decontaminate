-- Make email column nullable to support numeric-only accounts
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
