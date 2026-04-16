-- Add password reset and email verification token columns
ALTER TABLE users 
ADD COLUMN password_reset_token VARCHAR(255),
ADD COLUMN password_reset_expires TIMESTAMP,
ADD COLUMN email_verify_token VARCHAR(255),
ADD COLUMN email_verify_expires TIMESTAMP;

-- Index for faster lookups
CREATE INDEX idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX idx_users_email_verify_token ON users(email_verify_token);