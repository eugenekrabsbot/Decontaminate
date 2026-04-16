-- Migration 004: GDPR/CCPA data export requests
-- Run after 003_referral_code.sql

CREATE TABLE data_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  file_path TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'downloaded', 'expired', 'failed')),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  downloaded_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for fast lookups and cleanup
CREATE INDEX idx_data_exports_user_id ON data_exports(user_id);
CREATE INDEX idx_data_exports_token ON data_exports(token);
CREATE INDEX idx_data_exports_expires_at ON data_exports(expires_at) WHERE status != 'expired';
CREATE INDEX idx_data_exports_status ON data_exports(status);

-- Insert a system configuration for export retention period (hours)
INSERT INTO payout_config (key, value, description) VALUES
  ('export_retention_hours', '{"hours": 24}'::jsonb, 'Data export files are deleted after 24 hours');

-- Audit log entry for data export requests
-- (already captured by audit_logs table, but we can add a trigger if needed)