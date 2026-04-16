-- Migration 003: Add referral code to subscriptions and store order metadata
-- Run after 002_affiliate_payout.sql

ALTER TABLE subscriptions 
ADD COLUMN referral_code VARCHAR(20),
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for referral code lookups
CREATE INDEX idx_subscriptions_referral_code ON subscriptions(referral_code) WHERE referral_code IS NOT NULL;

-- Add column to payments for referral code as well (backup)
ALTER TABLE payments
ADD COLUMN referral_code VARCHAR(20);

-- Add column to affiliates for tracking approved_at
ALTER TABLE affiliates
ADD COLUMN approved_at TIMESTAMP;

-- Update existing approved affiliates
UPDATE affiliates SET approved_at = created_at WHERE is_approved = true;