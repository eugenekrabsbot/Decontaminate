import { useState } from 'react';
import { useRouter } from 'next/router';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { FormGroup, Input } from '../components/ui/Form';
import api from '../api/client';
import { sanitizeText } from '../lib/sanitize';

export default function AffiliateLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1=verify code, 2=set new password

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const sanitizedUsername = sanitizeText(username);
    if (!sanitizedUsername || !password.trim()) {
      setError('Username and password are required');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/affiliate/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: sanitizedUsername, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setSuccess('Login successful! Redirecting...');
      setTimeout(() => {
        window.location.href = '/affiliate-dashboard';
      }, 1000);
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.formWrapper}>
        <Card title="Affiliate Login" style={{ marginBottom: '1.5rem' }}>
          <form onSubmit={handleLogin} style={styles.form}>
            <FormGroup label="Username or Affiliate Code" error={error ? '' : undefined}>
              <Input
                type="text"
                placeholder="Enter your username or affiliate code"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                error={error ? true : false}
              />
            </FormGroup>

            <FormGroup label="Password">
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                error={error ? true : false}
              />
            </FormGroup>

            {error && <p style={styles.error}>{error}</p>}
            {success && <p style={styles.success}>{success}</p>}

            <Button
              type="submit"
              disabled={loading}
              style={styles.submitButton}
              size="lg"
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </Card>

        {!showForgot && (
          <Card>
            <p style={{ color: '#A0AEC0', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Forgot your password? <button type="button" onClick={() => setShowForgot(true)} style={{ background: 'none', border: 'none', color: '#1E90FF', cursor: 'pointer', fontSize: '0.9rem' }}>Use a recovery code instead.</button>
            </p>
          </Card>
        )}

        {showForgot && (
          <>
            {forgotStep === 1 && (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                setError('');
                try {
                  const res = await fetch('/api/auth/affiliate/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ username: forgotUsername, recoveryCode: forgotCode }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Invalid recovery code or username.');
                  setResetToken(data.resetToken);
                  setForgotStep(2);
                } catch (err) {
                  setError(err.message);
                } finally {
                  setLoading(false);
                }
              }} style={styles.form}>
                <p style={{ color: '#A0AEC0', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Enter your affiliate username and a recovery code from your kit to reset your password.
                </p>
                <FormGroup label="Username">
                  <Input type="text" placeholder="Your affiliate username" value={forgotUsername} onChange={e => setForgotUsername(e.target.value)} disabled={loading} />
                </FormGroup>
                <FormGroup label="Recovery Code">
                  <Input type="text" placeholder="One-time recovery code" value={forgotCode} onChange={e => setForgotCode(e.target.value)} disabled={loading} />
                </FormGroup>
                {error && <p style={styles.error}>{error}</p>}
                <Button type="submit" disabled={loading} size="lg">{loading ? 'Verifying...' : 'Verify Code'}</Button>
                <button type="button" onClick={() => { setShowForgot(false); setForgotStep(1); setError(''); setForgotUsername(''); setForgotCode(''); }} style={{ background: 'none', border: 'none', color: '#A0AEC0', cursor: 'pointer', fontSize: '0.9rem', marginTop: '0.75rem' }}>
                  Back to login
                </button>
              </form>
            )}
            {forgotStep === 2 && (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                setError('');
                if (newPassword !== confirmPassword) { setError('Passwords do not match.'); setLoading(false); return; }
                if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); setLoading(false); return; }
                try {
                  const res = await fetch('/api/auth/affiliate/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-reset-token': resetToken },
                    credentials: 'include',
                    body: JSON.stringify({ newPassword, confirmPassword }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Reset failed.');
                  setSuccess('Password reset successful! You can now log in.');
                  setForgotStep(3);
                } catch (err) {
                  setError(err.message);
                } finally {
                  setLoading(false);
                }
              }} style={styles.form}>
                <p style={{ color: '#10B981', marginBottom: '1rem' }}>Code verified. Set your new password below.</p>
                <FormGroup label="New Password">
                  <Input type="password" placeholder="New password (min 8 characters)" value={newPassword} onChange={e => setNewPassword(e.target.value)} disabled={loading} />
                </FormGroup>
                <FormGroup label="Confirm Password">
                  <Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={loading} />
                </FormGroup>
                {error && <p style={styles.error}>{error}</p>}
                {success && <p style={styles.success}>{success}</p>}
                <Button type="submit" disabled={loading} size="lg">{loading ? 'Resetting...' : 'Set New Password'}</Button>
                <button type="button" onClick={() => { setShowForgot(false); setForgotStep(1); setError(''); setNewPassword(''); setConfirmPassword(''); setResetToken(''); }} style={{ background: 'none', border: 'none', color: '#A0AEC0', cursor: 'pointer', fontSize: '0.9rem', marginTop: '0.75rem' }}>
                  Back to login
                </button>
              </form>
            )}
            {forgotStep === 3 && (
              <div style={styles.form}>
                <p style={styles.success}>Password reset complete. Use your new password to log in below.</p>
                <Button onClick={() => { setShowForgot(false); setForgotStep(1); setNewPassword(''); setConfirmPassword(''); setResetToken(''); setError(''); setSuccess(''); }} size="lg">Go to Login</Button>
              </div>
            )}
          </>
        )}

        <Card title="Not an affiliate?" style={styles.infoCard}>
          <p style={styles.infoText}>
            If you are a customer, please login from the <a href="/login" style={styles.link}>customer login page</a>.
          </p>
        </Card>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: '60vh',
    paddingTop: '2rem',
  },

  formWrapper: {
    width: '100%',
    maxWidth: '450px',
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },

  submitButton: {
    marginTop: '1rem',
  },

  error: {
    color: '#FF6B6B',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: '0.75rem',
    borderRadius: '4px',
    marginBottom: '0.5rem',
    fontSize: '0.9rem',
  },

  success: {
    color: '#00CED1',
    backgroundColor: 'rgba(0, 206, 209, 0.1)',
    padding: '0.75rem',
    borderRadius: '4px',
    marginBottom: '0.5rem',
    fontSize: '0.9rem',
  },

  infoCard: {
    backgroundColor: 'rgba(30, 144, 255, 0.05)',
    borderColor: 'rgba(30, 144, 255, 0.2)',
    textAlign: 'center',
  },

  infoText: {
    color: '#B0C4DE',
    fontSize: '0.9rem',
    lineHeight: 1.6,
    marginBottom: '1rem',
  },

  link: {
    color: '#1E90FF',
    textDecoration: 'none',
  },
};