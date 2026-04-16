-- Create email verification tokens table (similar to password_reset_tokens)
CREATE TABLE email_verify_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(token_hash)
);

-- Index for faster lookups
CREATE INDEX idx_email_verify_tokens_token_hash ON email_verify_tokens(token_hash);
CREATE INDEX idx_email_verify_tokens_user_id ON email_verify_tokens(user_id);