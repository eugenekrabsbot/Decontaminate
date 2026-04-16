const db = require('../config/database');
const crypto = require('crypto');
const emailService = require('../services/emailService');
const User = require('../models/userModel');

// Hash token (same as authController_csrf)
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Generate random token
const generateRandomToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Render HTML template with common styling (AhoyVPN theme)
const renderTemplate = (title, content) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - AhoyVPN</title>
    <style>
        /* AhoyVPN Color Palette - Pacific/Charcoal/Carbon Theme */
        :root {
          --carbon-black: #0C0C0C;
          --charcoal-blue: #2C3E50;
          --pacific-blue: #1CA3EC;
          --powder-blue: #B0E0E6;
          --alabaster-grey: #F8F8F8;
          
          --charcoal-blue-light: #3A506B;
          --pacific-blue-dark: #0F8BD6;
          --powder-blue-dark: #9BCFD9;
          --carbon-black-light: #1A1A1A;
          
          --bg-primary: var(--carbon-black);
          --bg-secondary: var(--carbon-black-light);
          --bg-card: var(--charcoal-blue);
          --bg-header: var(--charcoal-blue);
          --text-primary: var(--alabaster-grey);
          --text-secondary: #CCCCCC;
          --text-muted: #999999;
          --border-color: #333333;
          --accent-primary: var(--pacific-blue);
          --accent-secondary: var(--powder-blue);
          --button-primary: var(--powder-blue);
          --button-primary-text: var(--charcoal-blue);
          --button-secondary: var(--charcoal-blue-light);
          --button-secondary-text: var(--alabaster-grey);
          --status-active: #10B981;
          --status-inactive: #EF4444;
          --status-warning: #F59E0B;
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: var(--text-primary);
            background: var(--bg-primary);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 0 20px;
        }
        header {
            padding: 20px 0;
            border-bottom: 1px solid var(--border-color);
            background: var(--bg-header);
        }
        .header-inner {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .logo {
            font-size: 24px;
            font-weight: 800;
            color: var(--accent-primary);
            text-decoration: none;
        }
        .logo-text {
            font-size: 24px;
            font-weight: 800;
            color: var(--accent-primary);
            margin-left: 8px;
            vertical-align: middle;
        }
        main {
            flex: 1;
            padding: 60px 0 80px;
        }
        .card {
            background: var(--bg-card);
            border-radius: 12px;
            padding: 2.5rem;
            max-width: 500px;
            margin: 0 auto;
            border: 1px solid var(--border-color);
        }
        .card h1 {
            margin-bottom: 0.5rem;
            color: var(--text-primary);
            font-size: 2.2rem;
            text-align: center;
        }
        .card .subtitle {
            text-align: center;
            color: var(--text-secondary);
            margin-bottom: 2rem;
            font-size: 1.1rem;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
            text-decoration: none;
        }
        .btn-primary {
            background: var(--button-primary);
            color: var(--button-primary-text);
        }
        .btn-primary:hover {
            background: var(--powder-blue-dark);
            transform: translateY(-2px);
        }
        .btn-secondary {
            background: var(--button-secondary);
            color: var(--button-secondary-text);
        }
        .btn-secondary:hover {
            background: var(--charcoal-blue);
        }
        .message {
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
        }
        .message.success {
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid var(--status-active);
            color: #A7F3D0;
        }
        .message.error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid var(--status-inactive);
            color: #FCA5A5;
        }
        .message.warning {
            background: rgba(245, 158, 11, 0.1);
            border: 1px solid var(--status-warning);
            color: #FDE68A;
        }
        .form-group {
            margin-bottom: 1.5rem;
        }
        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: var(--text-secondary);
        }
        input[type="email"],
        input[type="password"] {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            background: var(--bg-secondary);
            color: var(--text-primary);
            font-size: 16px;
        }
        input:focus {
            outline: none;
            border-color: var(--accent-primary);
        }
        .link {
            color: var(--accent-primary);
            text-decoration: none;
            font-weight: 500;
        }
        .link:hover {
            text-decoration: underline;
        }
        footer {
            padding: 40px 0;
            border-top: 1px solid var(--border-color);
            background: var(--bg-header);
            text-align: center;
            color: var(--text-secondary);
            font-size: 0.9rem;
        }
        .actions {
            display: flex;
            gap: 1rem;
            justify-content: center;
            margin-top: 2rem;
        }
        @media (max-width: 768px) {
            .card { padding: 1.5rem; }
            .actions { flex-direction: column; }
        }
    </style>
</head>
<body>
    <header>
        <div class="container header-inner">
            <a href="/" class="logo">
                <img src="/assets/logo.png" alt="AhoyVPN" width="40" height="40" onerror="this.style.display='none'">
                <span class="logo-text">AhoyVPN</span>
            </a>
        </div>
    </header>
    <main>
        <div class="container">
            <div class="card">
                ${content}
            </div>
        </div>
    </main>
    <footer>
        <div class="container">
            <p>&copy; 2026 AhoyVPN. All rights reserved.</p>
            <p>Privacy that travels with you. Everywhere.</p>
        </div>
    </footer>
</body>
</html>`;

// --- Email verification page ---
const verifyEmailPage = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).send(renderTemplate('Invalid Link', `
        <h1>Invalid Verification Link</h1>
        <p class="subtitle">The verification link is missing a token.</p>
        <div class="message error">
          <p>Please check the email we sent you and click the link again.</p>
        </div>
        <div class="actions">
          <a href="/" class="btn btn-secondary">Return Home</a>
          <a href="/contact" class="btn btn-primary">Contact Support</a>
        </div>
      `));
    }
    
    const tokenHash = hashToken(token);
    
    // Find token with user email
    const result = await db.query(
      `SELECT evt.*, u.id as user_id, u.email, u.email_verified
       FROM email_verify_tokens evt
       JOIN users u ON evt.user_id = u.id
       WHERE evt.token_hash = $1`,
      [tokenHash]
    );
    
    if (result.rows.length === 0) {
      // Token not found (invalid or already used)
      return res.status(400).send(renderTemplate('Invalid Link', `
        <h1>Invalid Verification Link</h1>
        <p class="subtitle">This verification link is invalid or has already been used.</p>
        <div class="message error">
          <p>If you haven't verified your email yet, you can request a new verification email below.</p>
        </div>
        <form id="resendForm" method="POST" action="/api/auth/resend-verification">
          <div class="form-group">
            <label for="email">Your Email Address</label>
            <input type="email" id="email" name="email" placeholder="you@example.com" required>
          </div>
          <button type="submit" class="btn btn-primary">Send New Verification Email</button>
        </form>
        <script>
          document.getElementById('resendForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const response = await fetch(e.target.action, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: formData.get('email') })
            });
            const data = await response.json();
            if (response.ok) {
              alert('A new verification email has been sent. Please check your inbox.');
            } else {
              alert('Error: ' + (data.error || 'Unable to send email.'));
            }
          });
        </script>
      `));
    }
    
    const verifyToken = result.rows[0];
    const userId = verifyToken.user_id;
    const email = verifyToken.email;
    const isExpired = new Date(verifyToken.expires_at) < new Date();
    
    if (isExpired) {
      // Token expired
      return res.status(400).send(renderTemplate('Link Expired', `
        <h1>Verification Link Expired</h1>
        <p class="subtitle">This verification link has expired.</p>
        <div class="message warning">
          <p>Verification links are valid for 24 hours. Please request a new one.</p>
        </div>
        <form id="resendForm" method="POST" action="/api/auth/resend-verification">
          <input type="hidden" name="email" value="${email}">
          <p>Click the button below to send a new verification email to <strong>${email}</strong>.</p>
          <button type="submit" class="btn btn-primary">Send New Verification Email</button>
        </form>
        <script>
          document.getElementById('resendForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const response = await fetch(e.target.action, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: formData.get('email') })
            });
            const data = await response.json();
            if (response.ok) {
              alert('A new verification email has been sent. Please check your inbox.');
            } else {
              alert('Error: ' + (data.error || 'Unable to send email.'));
            }
          });
        </script>
      `));
    }
    
    // Token valid and not expired
    // Check if already verified
    if (verifyToken.email_verified) {
      return res.send(renderTemplate('Already Verified', `
        <h1>Email Already Verified</h1>
        <p class="subtitle">Your email address has already been verified.</p>
        <div class="message success">
          <p>You can now log in to your AhoyVPN account.</p>
        </div>
        <div class="actions">
          <a href="/login" class="btn btn-primary">Go to Login</a>
          <a href="/" class="btn btn-secondary">Return Home</a>
        </div>
      `));
    }
    
    // Update user to verified
    await db.query(
      'UPDATE users SET email_verified = true WHERE id = $1',
      [userId]
    );
    
    // Delete used token
    await db.query('DELETE FROM email_verify_tokens WHERE id = $1', [verifyToken.id]);
    
    res.send(renderTemplate('Email Verified', `
      <h1>✅ Email Verified!</h1>
      <p class="subtitle">Your email has been successfully verified.</p>
      <div class="message success">
        <p>You can now log in to your AhoyVPN account.</p>
      </div>
      <div class="actions">
        <a href="/login" class="btn btn-primary">Go to Login</a>
        <a href="/" class="btn btn-secondary">Return Home</a>
      </div>
    `));
    
  } catch (error) {
    console.error('Verify email page error:', error);
    res.status(500).send(renderTemplate('Error', `
      <h1>Something Went Wrong</h1>
      <p class="subtitle">An unexpected error occurred.</p>
      <div class="message error">
        <p>Please try again later or contact support.</p>
      </div>
      <div class="actions">
        <a href="/" class="btn btn-secondary">Return Home</a>
        <a href="/contact" class="btn btn-primary">Contact Support</a>
      </div>
    `));
  }
};

// --- Password reset page ---
const resetPasswordPage = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).send(renderTemplate('Invalid Link', `
        <h1>Invalid Reset Link</h1>
        <p class="subtitle">The password reset link is missing a token.</p>
        <div class="message error">
          <p>Please check the email we sent you and click the link again.</p>
        </div>
        <div class="actions">
          <a href="/" class="btn btn-secondary">Return Home</a>
          <a href="/forgot-password" class="btn btn-primary">Request New Reset</a>
        </div>
      `));
    }
    
    const tokenHash = hashToken(token);
    
    // Find valid, unused token
    const result = await db.query(
      `SELECT prt.*, u.id as user_id, u.email 
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token_hash = $1 AND prt.used = false`,
      [tokenHash]
    );
    
    if (result.rows.length === 0) {
      // Token not found or already used
      return res.status(400).send(renderTemplate('Invalid Link', `
        <h1>Invalid Reset Link</h1>
        <p class="subtitle">This password reset link is invalid or has already been used.</p>
        <div class="message error">
          <p>You can request a new password reset link below.</p>
        </div>
        <form id="forgotForm" method="POST" action="/api/auth/forgot-password">
          <div class="form-group">
            <label for="email">Your Email Address</label>
            <input type="email" id="email" name="email" placeholder="you@example.com" required>
          </div>
          <button type="submit" class="btn btn-primary">Send New Reset Link</button>
        </form>
        <script>
          document.getElementById('forgotForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const response = await fetch(e.target.action, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: formData.get('email') })
            });
            const data = await response.json();
            if (response.ok) {
              alert('A new password reset link has been sent. Please check your inbox.');
            } else {
              alert('Error: ' + (data.error || 'Unable to send email.'));
            }
          });
        </script>
      `));
    }
    
    const resetToken = result.rows[0];
    const email = resetToken.email;
    const isExpired = new Date(resetToken.expires_at) < new Date();
    
    if (isExpired) {
      // Token expired
      return res.status(400).send(renderTemplate('Link Expired', `
        <h1>Reset Link Expired</h1>
        <p class="subtitle">This password reset link has expired.</p>
        <div class="message warning">
          <p>Password reset links are valid for 30 minutes. Please request a new one.</p>
        </div>
        <form id="forgotForm" method="POST" action="/api/auth/forgot-password">
          <input type="hidden" name="email" value="${email}">
          <p>Click the button below to send a new password reset link to <strong>${email}</strong>.</p>
          <button type="submit" class="btn btn-primary">Send New Reset Link</button>
        </form>
        <script>
          document.getElementById('forgotForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const response = await fetch(e.target.action, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: formData.get('email') })
            });
            const data = await response.json();
            if (response.ok) {
              alert('A new password reset link has been sent. Please check your inbox.');
            } else {
              alert('Error: ' + (data.error || 'Unable to send email.'));
            }
          });
        </script>
      `));
    }
    
    // Token valid and not expired – show reset form
    res.send(renderTemplate('Set New Password', `
      <h1>Set New Password</h1>
      <p class="subtitle">Enter your new password below.</p>
      <form id="resetPasswordForm" method="POST" action="/api/auth/reset-password">
        <input type="hidden" name="token" value="${token}">
        <div class="form-group">
          <label for="password">New Password</label>
          <input type="password" id="password" name="password" placeholder="At least 8 characters" required>
          <small style="color: var(--text-muted); display: block; margin-top: 0.5rem;">
            Must be at least 8 characters with a letter and number.
          </small>
        </div>
        <div class="form-group">
          <label for="confirmPassword">Confirm New Password</label>
          <input type="password" id="confirmPassword" name="confirmPassword" placeholder="Confirm your password" required>
        </div>
        <button type="submit" class="btn btn-primary">Reset Password</button>
      </form>
      <script>
        document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const password = formData.get('password');
          const confirmPassword = formData.get('confirmPassword');
          
          if (password.length < 8) {
            alert('Password must be at least 8 characters.');
            return;
          }
          if (!/(?=.*[a-zA-Z])(?=.*\\d)/.test(password)) {
            alert('Password must contain at least one letter and one number.');
            return;
          }
          if (password !== confirmPassword) {
            alert('Passwords do not match.');
            return;
          }
          
          const response = await fetch(e.target.action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: formData.get('token'), password })
          });
          const data = await response.json();
          if (response.ok) {
            alert('Password reset successful! You can now log in.');
            window.location.href = '/login';
          } else {
            alert('Error: ' + (data.error || 'Password reset failed.'));
          }
        });
      </script>
    `));
    
  } catch (error) {
    console.error('Reset password page error:', error);
    res.status(500).send(renderTemplate('Error', `
      <h1>Something Went Wrong</h1>
      <p class="subtitle">An unexpected error occurred.</p>
      <div class="message error">
        <p>Please try again later or contact support.</p>
      </div>
      <div class="actions">
        <a href="/" class="btn btn-secondary">Return Home</a>
        <a href="/contact" class="btn btn-primary">Contact Support</a>
      </div>
    `));
  }
};

// --- Resend verification email (API) ---
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const user = await User.findByEmail(email);
    if (!user) {
      // For security, don't reveal that user doesn't exist
      return res.status(200).json({ 
        success: true, 
        message: 'If an account exists with this email, a verification link has been sent.' 
      });
    }
    
    if (user.email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }
    
    // Delete any existing verification tokens for this user
    await db.query('DELETE FROM email_verify_tokens WHERE user_id = $1', [user.id]);
    
    // Generate new token
    const verifyToken = generateRandomToken();
    const tokenHash = hashToken(verifyToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Store new token
    await db.query(
      'INSERT INTO email_verify_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );
    
    // Send verification email
    const frontendUrl = process.env.FRONTEND_URL || 'https://ahoyvpn.net';
    const verificationLink = `${frontendUrl}/verify-email/${verifyToken}`;
    
    // TODO: Use emailService to send verification email
    // For now, log link (replace with actual email sending)
    console.log(`New verification link for ${email}: ${verificationLink}`);
    
    // Send email via emailService (if template exists)
    try {
      await emailService.sendTransactional(
        email,
        'Verify Your AhoyVPN Email',
        'verification',
        { verificationLink }
      );
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }
    
    res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a verification link has been sent.',
    });
    
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  verifyEmailPage,
  resetPasswordPage,
  resendVerificationEmail,
};