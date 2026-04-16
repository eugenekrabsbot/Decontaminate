-- Migration: 017_arb_customer_profiles
-- Purpose: Track Authorize.net Customer Profile IDs so we can manage
--          ARB subscriptions and customer payment profiles.
-- Disruption: NONE — adds nullable column only.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS authorize_profile_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_users_authorize_profile
  ON users(authorize_profile_id)
  WHERE authorize_profile_id IS NOT NULL;

INSERT INTO migrations (id, name, applied_at) VALUES (17, '017_arb_customer_profiles', NOW())
ON CONFLICT (id) DO NOTHING;