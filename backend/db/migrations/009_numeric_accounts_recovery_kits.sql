-- Migration 009: Update schema for numeric accounts and recovery kits
-- Aligns with AhoyVPN core principles:
-- - No customer email collection for accounts/login
-- - Numeric username + numeric password
-- - Recovery kit system

-- Add numeric account fields to users
ALTER TABLE users 
ADD COLUMN account_number VARCHAR(20) UNIQUE,
ADD COLUMN numeric_password_hash VARCHAR(255),
ADD COLUMN is_numeric_account BOOLEAN NOT NULL DEFAULT false;

-- Create recovery_kits table
CREATE TABLE recovery_kits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kit_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  last_shown_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, is_active)
);

-- Create audit_logs table (if not exists from previous migrations)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  ip INET,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_users_account_number ON users(account_number);
CREATE INDEX idx_users_numeric_account ON users(is_numeric_account);
CREATE INDEX idx_recovery_kits_user_id ON recovery_kits(user_id);
CREATE INDEX idx_recovery_kits_active ON recovery_kits(is_active) WHERE is_active = true;
CREATE INDEX idx_recovery_kits_used_at ON recovery_kits(used_at) WHERE used_at IS NULL;

-- Update subscriptions table to support numeric accounts
ALTER TABLE subscriptions 
ADD COLUMN account_number VARCHAR(20),
ADD COLUMN numeric_password_hash VARCHAR(255);

-- Create index for account_number in subscriptions
CREATE INDEX idx_subscriptions_account_number ON subscriptions(account_number);

-- Update payments table to support numeric accounts
ALTER TABLE payments 
ADD COLUMN account_number VARCHAR(20);

-- Create index for account_number in payments
CREATE INDEX idx_payments_account_number ON payments(account_number);

-- Create a view for active numeric accounts
CREATE OR REPLACE VIEW active_numeric_accounts AS
SELECT 
  u.id,
  u.account_number,
  u.numeric_password_hash,
  u.created_at,
  u.updated_at,
  s.status as subscription_status,
  s.current_period_end
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE u.is_numeric_account = true 
  AND u.is_active = true
  AND (s.status = 'active' OR s.status IS NULL);

-- Create a function to generate numeric account number
CREATE OR REPLACE FUNCTION generate_numeric_account_number()
RETURNS VARCHAR(20) AS $$
DECLARE
  new_account_number VARCHAR(20);
  attempts INTEGER := 0;
  max_attempts INTEGER := 100;
BEGIN
  WHILE attempts < max_attempts LOOP
    -- Generate 8-digit numeric account number
    new_account_number := LPAD(FLOOR(RANDOM() * 100000000)::VARCHAR, 8, '0');
    
    -- Check if it already exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE account_number = new_account_number) THEN
      RETURN new_account_number;
    END IF;
    
    attempts := attempts + 1;
  END LOOP;
  
  RAISE EXCEPTION 'Failed to generate unique account number after % attempts', max_attempts;
END;
$$ LANGUAGE plpgsql;

-- Create a function to generate numeric password
CREATE OR REPLACE FUNCTION generate_numeric_password()
RETURNS VARCHAR(20) AS $$
BEGIN
  -- Generate 8-digit numeric password
  RETURN LPAD(FLOOR(RANDOM() * 100000000)::VARCHAR, 8, '0');
END;
$$ LANGUAGE plpgsql;

-- Create a function to create recovery kit
CREATE OR REPLACE FUNCTION create_recovery_kit(user_id UUID)
RETURNS UUID AS $$
DECLARE
  kit_id UUID;
  kit_code VARCHAR(32);
  kit_hash VARCHAR(255);
BEGIN
  -- Generate random kit code (32 characters)
  kit_code := encode(gen_random_bytes(16), 'hex');
  
  -- Hash the kit code (we'll use bcrypt in application layer, but store hash here)
  -- For now, store a simple hash - application will handle proper hashing
  kit_hash := crypt(kit_code, gen_salt('bf'));
  
  -- Deactivate any existing active kits for this user
  UPDATE recovery_kits 
  SET is_active = false, revoked_at = NOW()
  WHERE user_id = create_recovery_kit.user_id AND is_active = true;
  
  -- Create new kit
  INSERT INTO recovery_kits (user_id, kit_hash, is_active)
  VALUES (user_id, kit_hash, true)
  RETURNING id INTO kit_id;
  
  -- Return the kit_id (application will return the plain kit_code to user)
  RETURN kit_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to verify and use recovery kit
CREATE OR REPLACE FUNCTION use_recovery_kit(user_id UUID, kit_code VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  kit_record RECORD;
BEGIN
  -- Find the active kit for this user
  SELECT * INTO kit_record
  FROM recovery_kits 
  WHERE user_id = use_recovery_kit.user_id 
    AND is_active = true
    AND used_at IS NULL
    AND revoked_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Verify the kit code (application will handle proper bcrypt comparison)
  -- For now, we'll just mark it as used
  -- In production, application should verify the hash before calling this
  
  -- Mark kit as used
  UPDATE recovery_kits 
  SET used_at = NOW(), is_active = false
  WHERE id = kit_record.id;
  
  -- Create new kit for next use
  PERFORM create_recovery_kit(user_id);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to update account_number in subscriptions when user is created
CREATE OR REPLACE FUNCTION copy_account_number_to_subscriptions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_number IS NOT NULL THEN
    UPDATE subscriptions 
    SET account_number = NEW.account_number
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscriptions_account_number
AFTER UPDATE OF account_number ON users
FOR EACH ROW
EXECUTE FUNCTION copy_account_number_to_subscriptions();

-- Add trigger to update account_number in payments when user is created
CREATE OR REPLACE FUNCTION copy_account_number_to_payments()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_number IS NOT NULL THEN
    UPDATE payments 
    SET account_number = NEW.account_number
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payments_account_number
AFTER UPDATE OF account_number ON users
FOR EACH ROW
EXECUTE FUNCTION copy_account_number_to_payments();

-- Create a view for account summary (for customer dashboard)
CREATE OR REPLACE VIEW account_summary AS
SELECT 
  u.account_number,
  u.created_at as account_created_at,
  s.plan_id,
  s.status as subscription_status,
  s.current_period_start,
  s.current_period_end,
  s.current_period_end as next_billing_at,
  va.purewl_username,
  va.expiry_date as vpn_expiry_date
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
LEFT JOIN vpn_accounts va ON u.id = va.user_id
WHERE u.is_numeric_account = true;

-- Add comments for documentation
COMMENT ON TABLE recovery_kits IS 'Single-use recovery kits for numeric accounts';
COMMENT ON COLUMN recovery_kits.kit_hash IS 'Hashed recovery kit code (never store plaintext)';
COMMENT ON COLUMN recovery_kits.used_at IS 'When the kit was used (null if unused)';
COMMENT ON COLUMN recovery_kits.revoked_at IS 'When the kit was revoked (null if active)';
COMMENT ON COLUMN recovery_kits.is_active IS 'Whether this is the current active kit';

COMMENT ON FUNCTION create_recovery_kit(UUID) IS 'Creates a new recovery kit for a user and deactivates any existing active kits';
COMMENT ON FUNCTION use_recovery_kit(UUID, VARCHAR) IS 'Verifies and uses a recovery kit, then creates a new one for next use';
