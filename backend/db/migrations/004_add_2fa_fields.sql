-- Add 2FA related fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_2fa_verification TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes_generated_at TIMESTAMP;
-- totp_secret already exists, we'll keep as plaintext for now (should be encrypted in production)
-- recovery_codes already exists as JSONB, we'll store hashed codes there