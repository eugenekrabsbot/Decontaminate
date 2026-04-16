-- Affiliate promo code tracking & role enhancements
-- Version: 1.0 (conditional)

-- Add affiliate_id to promo_codes to track which affiliate owns the code (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promo_codes' AND column_name = 'affiliate_id') THEN
    ALTER TABLE promo_codes ADD COLUMN affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add is_affiliate flag to users (optional, but simplifies queries)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_affiliate') THEN
    ALTER TABLE users ADD COLUMN is_affiliate BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Update existing affiliates to set is_affiliate = true
UPDATE users u SET is_affiliate = true WHERE EXISTS (SELECT 1 FROM affiliates a WHERE a.user_id = u.id) AND is_affiliate = false;

-- Add total_referrals column to affiliates if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'total_referrals') THEN
    ALTER TABLE affiliates ADD COLUMN total_referrals INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Note: pending_payout_cents already exists (from migration 002), skip

-- Add last_payout_at column to affiliates if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'last_payout_at') THEN
    ALTER TABLE affiliates ADD COLUMN last_payout_at TIMESTAMP;
  END IF;
END $$;

-- Create payout_requests table if not exists
CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,
  processor_transaction_id VARCHAR(255),
  notes TEXT
);

-- Create admin_audit_log table if not exists
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL, -- 'promo_code', 'affiliate', 'user', 'payout'
  target_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip INET,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance (create if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_promo_codes_affiliate') THEN
    CREATE INDEX idx_promo_codes_affiliate ON promo_codes(affiliate_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_is_affiliate') THEN
    CREATE INDEX idx_users_is_affiliate ON users(is_affiliate) WHERE is_affiliate = true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_affiliates_total_referrals') THEN
    CREATE INDEX idx_affiliates_total_referrals ON affiliates(total_referrals);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payout_requests_affiliate') THEN
    CREATE INDEX idx_payout_requests_affiliate ON payout_requests(affiliate_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payout_requests_status') THEN
    CREATE INDEX idx_payout_requests_status ON payout_requests(status) WHERE status = 'pending';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_admin_audit_log_admin_user') THEN
    CREATE INDEX idx_admin_audit_log_admin_user ON admin_audit_log(admin_user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_admin_audit_log_created_at') THEN
    CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at);
  END IF;
END $$;

-- Insert a record into migrations table (will be done by runMigrations.js)