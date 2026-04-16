-- Migration 010: Add admin users, audit events, and webhook verification
-- Implements admin authentication, audit logging, and webhook security

-- Admin users table
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Audit events table
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('customer', 'affiliate', 'admin', 'system')),
  actor_id UUID,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Credential claim table (for secure credential delivery post-payment)
CREATE TABLE credential_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  claimed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Webhook verification table
CREATE TABLE webhook_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL,
  webhook_id VARCHAR(255) UNIQUE NOT NULL,
  signature VARCHAR(255),
  processed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Internal messages table
CREATE TABLE internal_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_admin_users_username ON admin_users(username);
CREATE INDEX idx_admin_users_active ON admin_users(is_active) WHERE is_active = true;
CREATE INDEX idx_audit_events_actor ON audit_events(actor_type, actor_id);
CREATE INDEX idx_audit_events_action ON audit_events(action);
CREATE INDEX idx_audit_events_created ON audit_events(created_at);
CREATE INDEX idx_credential_claims_customer ON credential_claims(customer_id);
CREATE INDEX idx_credential_claims_token ON credential_claims(claim_token_hash);
CREATE INDEX idx_credential_claims_expires ON credential_claims(expires_at) WHERE claimed_at IS NULL;
CREATE INDEX idx_webhook_verifications_webhook_id ON webhook_verifications(webhook_id);
CREATE INDEX idx_internal_messages_user ON internal_messages(user_id);
CREATE INDEX idx_internal_messages_unread ON internal_messages(user_id, is_read) WHERE is_read = false;

-- Add trigger for admin_users updated_at
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_admin_users_updated_at();

-- Create view for customer dashboard (account summary)
CREATE OR REPLACE VIEW customer_dashboard AS
SELECT 
  u.account_number,
  u.created_at as account_created_at,
  s.plan_id,
  s.status as subscription_status,
  s.current_period_start,
  s.current_period_end,
  s.current_period_end as next_billing_at,
  s.cancel_at_period_end,
  va.purewl_username,
  va.expiry_date as vpn_expiry_date,
  va.status as vpn_status
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
LEFT JOIN vpn_accounts va ON u.id = va.user_id
WHERE u.is_numeric_account = true;

-- Create view for affiliate dashboard
CREATE OR REPLACE VIEW affiliate_dashboard AS
SELECT 
  a.id as affiliate_id,
  a.code as affiliate_code,
  a.commission_rate,
  a.total_earned_cents,
  a.pending_payout_cents,
  a.paid_out_cents,
  a.created_at as affiliate_since,
  COUNT(DISTINCT r.id) as total_referrals,
  COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) as active_referrals,
  SUM(CASE WHEN r.status = 'active' THEN r.commission_cents ELSE 0 END) as total_commission_cents
FROM affiliates a
LEFT JOIN referrals r ON a.id = r.affiliate_id
GROUP BY a.id;

-- Create view for admin KPIs
CREATE OR REPLACE VIEW admin_kpis AS
SELECT 
  -- Customer metrics
  (SELECT COUNT(*) FROM users WHERE is_numeric_account = true) as total_customers,
  (SELECT COUNT(*) FROM users WHERE is_numeric_account = true AND created_at >= NOW() - INTERVAL '30 days') as new_customers_30d,
  
  -- Subscription metrics
  (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') as active_subscriptions,
  (SELECT COUNT(*) FROM subscriptions WHERE status = 'cancelled') as cancelled_subscriptions,
  (SELECT COUNT(*) FROM subscriptions WHERE status = 'trialing') as trialing_subscriptions,
  
  -- Revenue metrics
  (SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE status = 'succeeded') as total_revenue_cents,
  (SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE status = 'succeeded' AND created_at >= NOW() - INTERVAL '30 days') as revenue_30d_cents,
  
  -- Affiliate metrics
  (SELECT COUNT(*) FROM affiliates) as total_affiliates,
  (SELECT COUNT(*) FROM affiliates WHERE is_approved = true) as approved_affiliates,
  (SELECT COALESCE(SUM(total_earned_cents), 0) FROM affiliates) as total_affiliate_earnings_cents,
  
  -- Webhook metrics
  (SELECT COUNT(*) FROM webhook_verifications WHERE processed_at IS NOT NULL) as webhooks_processed,
  (SELECT COUNT(*) FROM webhook_verifications WHERE processed_at IS NULL) as webhooks_pending;

-- Comments for documentation
COMMENT ON TABLE admin_users IS 'Administrator accounts for management dashboard';
COMMENT ON TABLE audit_events IS 'Audit log for all admin actions and system events';
COMMENT ON TABLE credential_claims IS 'Secure credential delivery tokens post-payment';
COMMENT ON TABLE webhook_verifications IS 'Track webhook processing for replay protection';
COMMENT ON TABLE internal_messages IS 'Internal communications between admin and customers';
