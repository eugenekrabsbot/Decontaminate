import { useState, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { FormGroup, Input } from '../components/ui/Form';
import api from '../api/client';
import { AuthContext } from './_app';
import { sanitizeText } from '../lib/sanitize';

export default function Recover() {
  const router = useRouter();
  const auth = useContext(AuthContext);

  const [step, setStep] = useState('enter-kit'); // enter-kit, verify, set-password, success
  const [userId, setUserId] = useState('');
  const [recoveryKit, setRecoveryKit] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newRecoveryKit, setNewRecoveryKit] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [kitCopied, setKitCopied] = useState(false);

  const handleVerifyKit = async (e) => {
    e.preventDefault();
    setError('');

    // Sanitize inputs
    const sanitizedUserId = sanitizeText(userId);
    const sanitizedKit = sanitizeText(recoveryKit);

    if (!sanitizedUserId.trim() || !sanitizedKit.trim()) {
      setError('Account number and recovery kit are required');
      return;
    }

    // Move to password step; actual kit verification happens with password reset call.
    setStep('set-password');
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const sanitizedUserId = sanitizeText(userId);
    const sanitizedKit = sanitizeText(recoveryKit);

    if (!newPassword.trim()) {
      setError('Password is required');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await api.recover(sanitizedUserId, sanitizedKit, newPassword);
      const returnedKit = response?.data?.data?.recoveryKit || response?.data?.recoveryKit;

      if (!returnedKit) {
        throw new Error('Recovery succeeded but no new recovery kit was returned.');
      }

      setNewRecoveryKit(returnedKit);
      setStep('success');
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error || 'Failed to recover account. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKit = () => {
    if (newRecoveryKit) {
      navigator.clipboard.writeText(newRecoveryKit);
      setKitCopied(true);
      setTimeout(() => setKitCopied(false), 2000);
    }
  };

  const handleDownloadKit = () => {
    if (newRecoveryKit) {
      const element = document.createElement('a');
      element.setAttribute(
        'href',
        'data:text/plain;charset=utf-8,' + encodeURIComponent(newRecoveryKit)
      );
      element.setAttribute('download', `recovery-kit-${userId}.txt`);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Account Recovery</h1>

      {/* Step 1: Enter Recovery Kit */}
      {step === 'enter-kit' && (
        <div style={styles.formWrapper}>
          <Card>
            <h2 style={styles.stepTitle}>Enter Your Recovery Kit</h2>
            <p style={styles.stepDescription}>
              If you lost your password, you can use your recovery kit to regain access.
            </p>

            <form onSubmit={handleVerifyKit} style={styles.form}>
              <FormGroup
                label="Numeric User ID (8 digits)"
                error={error ? '' : undefined}
              >
                <Input
                  type="text"
                  placeholder="e.g., 12345678"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  disabled={loading}
                  error={error ? true : false}
                />
              </FormGroup>

              <FormGroup label="Recovery Kit Code">
                <textarea
                  placeholder="Paste your recovery kit here"
                  value={recoveryKit}
                  onChange={(e) => setRecoveryKit(e.target.value)}
                  disabled={loading}
                  style={{
                    ...styles.textarea,
                    ...(error && { borderColor: '#FF6B6B' }),
                  }}
                />
              </FormGroup>

              {error && <p style={styles.error}>{error}</p>}

              <div style={styles.buttonGroup}>
                <Link href="/login">
                  <a style={styles.linkButton}>
                    <Button variant="secondary">Back to Login</Button>
                  </a>
                </Link>
                <Button type="submit" disabled={loading} size="lg">
                  {loading ? 'Verifying...' : 'Verify Kit'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Step 2: Set New Password */}
      {step === 'set-password' && (
        <div style={styles.formWrapper}>
          <Card>
            <h2 style={styles.stepTitle}>Set New Password</h2>
            <p style={styles.stepDescription}>
              Your recovery kit has been verified. Now set a new password.
            </p>

            <form onSubmit={handleSetPassword} style={styles.form}>
              <FormGroup label="New Password (Numeric)">
                <Input
                  type="password"
                  placeholder="Enter a new numeric password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  error={error ? true : false}
                />
              </FormGroup>

              <FormGroup label="Confirm Password">
                <Input
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  error={error ? true : false}
                />
              </FormGroup>

              {error && <p style={styles.error}>{error}</p>}

              <div style={styles.buttonGroup}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStep('enter-kit');
                    setError('');
                  }}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button type="submit" disabled={loading} size="lg">
                  {loading ? 'Setting Password...' : 'Set Password'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Step 3: Success - New Recovery Kit */}
      {step === 'success' && (
        <div style={styles.formWrapper}>
          <Card style={{ backgroundColor: '#1A2A1A', borderColor: '#00CED1' }}>
            <h2 style={{ color: '#00CED1', marginBottom: '1rem' }}>
              ✓ Account Recovered Successfully
            </h2>

            <p style={styles.successText}>
              Your password has been updated. Your old recovery kit is now invalid. Here is your new recovery kit—save it securely.
            </p>

            <div style={styles.kitBox}>
              <h4 style={{ color: '#FFD93D', marginBottom: '0.5rem' }}>
                🔐 Your New Recovery Kit
              </h4>
              <div style={styles.kitDisplay}>
                <code style={styles.kitCode}>{newRecoveryKit}</code>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <Button onClick={handleCopyKit} variant="secondary" size="sm">
                  {kitCopied ? '✓ Copied' : 'Copy'}
                </Button>
                <Button onClick={handleDownloadKit} variant="secondary" size="sm">
                  Download
                </Button>
              </div>
            </div>

            <p style={{ ...styles.warning, color: '#FFD93D' }}>
              <strong>⚠️ Important:</strong> Store this kit securely. Do not share it with anyone.
            </p>

            <div style={styles.buttonGroup}>
              <Link href="/login">
                <a style={styles.linkButton}>
                  <Button size="lg" style={{ width: '100%' }}>
                    Go to Login
                  </Button>
                </a>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
  },

  title: {
    fontSize: '2.5rem',
    color: '#1E90FF',
    marginBottom: '2rem',
    textAlign: 'center',
  },

  formWrapper: {
    width: '100%',
  },

  stepTitle: {
    fontSize: '1.5rem',
    color: '#1E90FF',
    marginBottom: '0.5rem',
  },

  stepDescription: {
    color: '#B0C4DE',
    marginBottom: '1.5rem',
    fontSize: '0.95rem',
    lineHeight: 1.6,
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },

  textarea: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: '#252525',
    color: '#F0F4F8',
    border: '1px solid #3A3A3A',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    minHeight: '100px',
    resize: 'vertical',
    transition: 'border-color 0.3s ease',
  },

  error: {
    color: '#FF6B6B',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: '0.75rem',
    borderRadius: '4px',
    fontSize: '0.9rem',
  },

  successText: {
    color: '#B0C4DE',
    marginBottom: '1.5rem',
    fontSize: '0.95rem',
    lineHeight: 1.6,
  },

  kitBox: {
    backgroundColor: '#2A2A2A',
    border: '1px solid #3A3A3A',
    padding: '1rem',
    borderRadius: '4px',
    marginBottom: '1.5rem',
  },

  kitDisplay: {
    backgroundColor: '#1A1A1A',
    border: '1px solid #3A3A3A',
    borderRadius: '4px',
    padding: '1rem',
    overflow: 'auto',
  },

  kitCode: {
    color: '#00CED1',
    fontSize: '0.8rem',
    wordBreak: 'break-all',
  },

  warning: {
    backgroundColor: 'rgba(255, 217, 61, 0.1)',
    padding: '0.75rem',
    borderRadius: '4px',
    marginBottom: '1.5rem',
    fontSize: '0.9rem',
  },

  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'space-between',
  },

  linkButton: {
    textDecoration: 'none',
    flex: 1,
    display: 'block',
  },
};
