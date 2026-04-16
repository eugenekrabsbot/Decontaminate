-- PCI DSS Password Compliance Migration
-- Adds password history tracking, password changed timestamp, and supports user-set passwords

-- Add password_changed_at column to users table
ALTER TABLE users 
ADD COLUMN password_changed_at TIMESTAMP DEFAULT NOW();

-- Add force_password_change flag for first-time users
ALTER TABLE users 
ADD COLUMN force_password_change BOOLEAN DEFAULT true;

-- Create password history table
CREATE TABLE password_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for password history
CREATE INDEX idx_password_history_user_id ON password_history(user_id);
CREATE INDEX idx_password_history_created_at ON password_history(created_at);
CREATE INDEX idx_password_history_user_created ON password_history(user_id, created_at DESC);

-- Update existing users to set password_changed_at to created_at
UPDATE users SET password_changed_at = created_at WHERE password_changed_at IS NULL;

-- Update existing users to not force password change (they've already used their initial password)
UPDATE users SET force_password_change = false WHERE force_password_change = true;

-- Add comment for documentation
COMMENT ON COLUMN users.password_changed_at IS 'Timestamp when password was last changed';
COMMENT ON COLUMN users.force_password_change IS 'Flag to force password change on next login';
COMMENT ON TABLE password_history IS 'Stores history of previous passwords for PCI DSS compliance';
