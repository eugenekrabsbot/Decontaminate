-- Migration 002: Add payout columns to affiliates table
-- Run after 001_initial.sql

ALTER TABLE affiliates 
ADD COLUMN stripe_account_id VARCHAR(255),
ADD COLUMN payout_method VARCHAR(20) NOT NULL DEFAULT 'stripe' CHECK (payout_method IN ('stripe', 'crypto')),
ADD COLUMN wallet_address TEXT,
ADD COLUMN pending_payout_cents INTEGER NOT NULL DEFAULT 0,
ADD COLUMN total_paid_cents INTEGER NOT NULL DEFAULT 0,
ADD COLUMN last_payout_at TIMESTAMP,
ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT false;

-- Add payout threshold configuration (system-wide)
CREATE TABLE payout_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(50) UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO payout_config (key, value, description) VALUES
  ('minimum_payout_cents', '{"amount": 750}'::jsonb, 'Minimum $7.50 for payout (affiliate minimum $0.75/user/month)'),
  ('commission_rate', '{"rate": 0.25}'::jsonb, '25% commission of net profit after expenses');

-- Add payout audit log
CREATE TABLE payout_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  payout_method VARCHAR(20) NOT NULL CHECK (payout_method IN ('stripe', 'crypto')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  stripe_transfer_id VARCHAR(255),
  plisio_payout_id VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_affiliates_pending_payout ON affiliates(pending_payout_cents) WHERE pending_payout_cents > 0;
CREATE INDEX idx_affiliates_approved ON affiliates(is_approved) WHERE is_approved = true;
CREATE INDEX idx_payout_audit_affiliate ON payout_audit(affiliate_id);
CREATE INDEX idx_payout_audit_status ON payout_audit(status) WHERE status IN ('pending', 'processing');