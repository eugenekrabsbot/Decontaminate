-- Migration: 016_arb_subscription_tracking
-- Purpose: Track Authorize.net ARB subscription IDs so we can manage
--          recurring billing and cancel subscriptions on customer cancellation.
-- Disruption: NONE — adds one nullable column to subscriptions table.

-- Add ARB subscription ID column
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS arb_subscription_id VARCHAR(50);

-- Index for fast lookup by ARB subscription ID
CREATE INDEX IF NOT EXISTS idx_subscriptions_arb_id
  ON subscriptions(arb_subscription_id)
  WHERE arb_subscription_id IS NOT NULL;

INSERT INTO migrations (id, name, applied_at) VALUES (16, '016_arb_subscription_tracking', NOW())
ON CONFLICT (id) DO NOTHING;