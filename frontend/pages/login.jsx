import { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { FormGroup, Input } from '../components/ui/Form';
import api from '../api/client';
import { AuthContext } from './_app';
import { sanitizeEmail, sanitizeText } from '../lib/sanitize';

export default function Login() {
  const router = useRouter();
  const auth = useContext(AuthContext);

  const [accountNumber, setAccountNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prefillNote, setPrefillNote] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const lastAccount = localStorage.getItem('lastAccountNumber');
    if (lastAccount && !accountNumber) {
      setAccountNumber(lastAccount);
      setPrefillNote(`We pre-filled your last account number: ${lastAccount}`);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Sanitize inputs
    const sanitizedAccountNumber = sanitizeText(accountNumber);
    if (!sanitizedAccountNumber || !password.trim()) {
      setError('Account number and password are required');
      setLoading(false);
      return;
    }

    try {
      const response = await api.login(sanitizedAccountNumber, password);
      const { user, accessToken } = response.data || {};
      if (!user || !accessToken) {
        setError('Login failed. Please try again.');
        setLoading(false);
        return;
      }
      auth.login(user, accessToken, 'customer');
      router.push('/dashboard');
    } catch (err) {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.formWrapper}>
        <Card title="Login to AHOY VPN" style={{ marginBottom: '1.5rem' }}>
          <form onSubmit={handleLogin} style={styles.form}>
            <FormGroup
              label="Account Number"
              error={error ? '' : undefined}
            >
              <Input
                type="text"
                placeholder="Enter your numeric account number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
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
            {prefillNote && <p style={styles.note}>{prefillNote}</p>}

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

        <Card title="Lost your password?" style={styles.recoveryCard}>
          <p style={styles.recoveryText}>
            If you have your recovery kit, you can recover your account and set a new password.
          </p>
          <Link href="/recover">
            <a style={styles.recoveryLink}>
              <Button variant="secondary" style={{ width: '100%' }}>
                Use Recovery Kit
              </Button>
            </a>
          </Link>
        </Card>

        <Card style={styles.infoCard}>
          <h4 style={{ marginBottom: '0.5rem', color: '#1E90FF' }}>ℹ️ Don't have an account?</h4>
          <p style={styles.infoText}>
            Create your AHOY VPN account today. No email required - just set a secure password and you're ready to go.
          </p>
          <Link href="/register">
            <a style={styles.registerLink}>
              <Button variant="secondary" style={{ width: '100%' }}>
                Create Account
              </Button>
            </a>
          </Link>
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
    paddingY: '2rem',
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
  note: {
    color: '#8AB4F8',
    backgroundColor: 'rgba(30, 144, 255, 0.08)',
    padding: '0.6rem',
    borderRadius: '4px',
    marginBottom: '0.5rem',
    fontSize: '0.85rem',
  },

  recoveryCard: {
    marginBottom: '1.5rem',
    textAlign: 'center',
  },

  recoveryText: {
    color: '#B0C4DE',
    marginBottom: '1rem',
    fontSize: '0.95rem',
  },

  recoveryLink: {
    textDecoration: 'none',
    display: 'block',
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

  registerLink: {
    textDecoration: 'none',
    display: 'block',
  },
};
