-- Promo codes for AhoyVPN
-- Version: 1.0

CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percent', 'fixed', 'free_trial')),
  discount_value DECIMAL(10,2) NOT NULL, -- percent (0-100) or cents (e.g., 50 for $0.50)
  max_uses INTEGER DEFAULT NULL, -- NULL = unlimited uses
  uses_count INTEGER NOT NULL DEFAULT 0,
  applies_to_plan_keys TEXT[], -- NULL = all plans
  expires_at TIMESTAMP, -- NULL = never expires
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert initial promo codes
INSERT INTO promo_codes (code, description, discount_type, discount_value, max_uses, expires_at) VALUES
  ('JIMBO', '50 cents off indefinitely', 'fixed', 50, NULL, NULL), -- $0.50 off
  ('FREEWILLY', '100% off first month, single-use', 'percent', 100, 1, NULL); -- 100% off, single use

-- Add promo_code_id to subscriptions table
ALTER TABLE subscriptions ADD COLUMN promo_code_id UUID REFERENCES promo_codes(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_expires_at ON promo_codes(expires_at);
CREATE INDEX idx_subscriptions_promo_code_id ON subscriptions(promo_code_id);

-- Trigger for updated_at
CREATE TRIGGER update_promo_codes_updated_at BEFORE UPDATE ON promo_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();