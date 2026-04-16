import { useState } from 'react';
import { useRouter } from 'next/router';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { FormGroup, Input } from '../components/ui/Form';
import { sanitizeText } from '../lib/sanitize';

export default function AhoyManLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      const response = await fetch('/api/auth/ahoyman/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: sanitizedUsername, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token in localStorage so API client can read it
      if (data.data?.token) {
        localStorage.setItem('adminToken', data.data.token);
      }

      setSuccess('Login successful! Redirecting...');
      setTimeout(() => {
        window.location.href = '/ahoyman-dashboard';
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
        <Card style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <h1 style={styles.title}>Partner Portal</h1>
          <p style={styles.subtitle}>Sign in to your account</p>

          <form onSubmit={handleLogin} style={styles.form}>
            <FormGroup label="Username" error={error ? '' : undefined}>
              <Input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                error={error ? true : false}
              />
            </FormGroup>

            <FormGroup label="Password">
              <Input
                type="password"
                placeholder="Enter password"
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
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </Card>

        <Card style={styles.infoCard}>
          <p style={styles.infoText}>
            Need access? Contact your administrator.
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
    minHeight: '70vh',
    paddingTop: '4rem',
  },

  formWrapper: {
    width: '100%',
    maxWidth: '450px',
  },

  title: {
    fontSize: '2rem',
    color: '#8B5CF6',
    marginBottom: '0.5rem',
  },

  subtitle: {
    color: '#A0AEC0',
    fontSize: '1rem',
    marginBottom: '2rem',
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },

  submitButton: {
    marginTop: '1rem',
    background: 'linear-gradient(90deg, #8B5CF6, #A78BFA)',
    color: '#1E293B',
    fontWeight: 'bold',
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
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
    borderColor: 'rgba(139, 92, 246, 0.2)',
    textAlign: 'center',
  },

  infoText: {
    color: '#B0C4DE',
    fontSize: '0.9rem',
    lineHeight: 1.6,
    marginBottom: '1rem',
  },
};
