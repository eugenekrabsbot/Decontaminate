-- User Backups table for failsafe recovery
CREATE TABLE IF NOT EXISTS user_backups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  email TEXT,
  account_number VARCHAR(20),
  password_hash TEXT,
  numeric_password_hash TEXT,
  is_active BOOLEAN,
  status TEXT,
  totp_enabled BOOLEAN,
  is_admin BOOLEAN,
  backup_reason TEXT,           -- 'manual_reset', 'migration', 'security_incident', etc.
  performed_by TEXT,            -- 'agent', 'admin_name', 'system'
  performed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_backups_user_id ON user_backups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_backups_performed_at ON user_backups(performed_at);
