import { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { FormGroup, Input } from '../components/ui/Form';
import api from '../api/client';
import { AuthContext } from './_app';

const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$5.99',
    period: '/month + tax',
    description: 'Perfect for trying AHOY VPN',
    features: ['10 simultaneous connections', '50+ server locations', '24/7 support'],
    cryptoOnly: false,
  },
  {
    id: 'quarterly',
    name: 'Quarterly',
    price: '$16.99',
    period: '/3 months + tax',
    description: 'Great value, save a bit',
    features: ['10 simultaneous connections', '50+ server locations', '24/7 support', 'Save 5%'],
    highlight: true,
    cryptoOnly: false,
  },
  {
    id: 'semiannual',
    name: 'Semi-Annual',
    price: '$31.99',
    period: '/6 months + tax',
    description: 'Best savings',
    features: ['10 simultaneous connections', '50+ server locations', '24/7 support', 'Save 10%'],
    cryptoOnly: true,
  },
  {
    id: 'annual',
    name: 'Annual',
    price: '$59.99',
    period: '/year + tax',
    description: 'Ultimate savings',
    features: ['10 simultaneous connections', '50+ server locations', '24/7 support', 'Save 15%'],
    cryptoOnly: true,
  },
];

export default function Dashboard() {
  const router = useRouter();
  const auth = useContext(AuthContext);

  // Redirect if not logged in
  useEffect(() => {
    if (!auth?.isLoggedIn) {
      router.push('/login');
    }
  }, [auth, router]);

  const [subscription, setSubscription] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('crypto');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showNewKit, setShowNewKit] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [newRecoveryKit, setNewRecoveryKit] = useState('');
  const [kitCopied, setKitCopied] = useState(false);

  const [cancelLoading, setCancelLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [exportStatus, setExportStatus] = useState('');
  const [exportToken, setExportToken] = useState('');
  const [exportError, setExportError] = useState('');

  const triggerExportDownload = async (token) => {
    const response = await api.downloadAccountExport(token);
    const contentType = response?.headers?.['content-type'] || 'application/json';
    const blob = new Blob([response.data], { type: contentType });

    const disposition = response?.headers?.['content-disposition'] || '';
    const match = disposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i);
    const fileName = match ? decodeURIComponent(match[1]).replace(/\"/g, '') : `ahoyvpn-data-${token}.txt`;

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  // Data export
  const handleRequestDataExport = async () => {
    setExportStatus('Generating your export...');
    setExportError('');
    setExportToken('');

    try {
      const response = await api.exportAccountData();
      const token = response?.data?.data?.token || response?.data?.token;

      if (!token) {
        setExportStatus('Export request submitted. Please try again in a moment.');
        return;
      }

      setExportToken(token);
      await triggerExportDownload(token);
      setExportStatus('Export ready. Download started.');
    } catch (err) {
      const existingToken = err?.response?.data?.token;
      const isActiveExport = err?.response?.status === 429 && existingToken;

      if (isActiveExport) {
        try {
          setExportToken(existingToken);
          await triggerExportDownload(existingToken);
          setExportError('');
          setExportStatus('You already had an active export. Download started.');
          return;
        } catch (downloadErr) {
          const fallbackMessage = downloadErr?.response?.data?.message || downloadErr?.response?.data?.error || 'Active export found, but download failed.';
          setExportStatus('');
          setExportError(fallbackMessage);
          return;
        }
      }

      const message = err?.response?.data?.message || err?.response?.data?.error || 'Failed to generate export.';
      setExportStatus('');
      setExportError(message);
    }
  };

  // Load profile + subscription data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const profileResponse = await api.getUser();
        const profileData = profileResponse?.data?.data || profileResponse?.data || null;
        setProfile(profileData);
      } catch (err) {
        console.error('Failed to load profile', err);
      }

      try {
        const response = await api.getSubscription();
        const subData = response?.data?.data || response?.data || null;
        setSubscription(subData);
      } catch (err) {
        console.error('Failed to load subscription', err);
      }
    };

    if (auth?.isLoggedIn) {
      loadDashboardData();
    }
  }, [auth]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      setPasswordLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      setPasswordLoading(false);
      return;
    }

    try {
      await api.changePassword(oldPassword, newPassword);
      setPasswordSuccess('Password changed successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error || 'Failed to change password';
      setPasswordError(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleGenerateKit = async () => {
    const password = typeof window !== 'undefined'
      ? window.prompt('Enter your current password to generate a new recovery kit:')
      : null;

    if (!password) {
      return;
    }

    try {
      const response = await api.generateRecoveryKit(password);
      const kit = response?.data?.data?.recoveryKit || response?.data?.recoveryKit;
      if (!kit) {
        throw new Error('Recovery kit was not returned.');
      }
      setNewRecoveryKit(kit);
      setShowNewKit(true);
      setKitCopied(false);
    } catch (err) {
      console.error('Failed to generate recovery kit', err);
      if (typeof window !== 'undefined') {
        window.alert(err?.response?.data?.error || err?.message || 'Failed to generate recovery kit');
      }
    }
  };

  const handleCopyKit = () => {
    if (newRecoveryKit) {
      navigator.clipboard.writeText(newRecoveryKit);
      setKitCopied(true);
      setTimeout(() => setKitCopied(false), 2000);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      await api.cancelSubscription();
      setSubscription(null);
      setShowCancelModal(false);
    } catch (err) {
      console.error('Failed to cancel subscription');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await api.deleteAccount();
      auth.logout();
      router.push('/');
    } catch (err) {
      console.error('Failed to delete account');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handlePurchase = async (plan) => {
    setSelectedPlan(plan);
    // Redirect to checkout with plan ID
    router.push(`/checkout?plan=${plan.id}&method=${paymentMethod}`);
  };

  if (!auth?.isLoggedIn) {
    return null;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Dashboard</h1>

      {/* Subscription Status */}
      <Card style={styles.card}>
        <h2>Subscription Status</h2>
        {subscription ? (
          <div>
            <p><strong>Plan:</strong> {subscription.planName}</p>
            <p><strong>Status:</strong> {subscription.status}</p>
            <p><strong>Next Billing:</strong> {subscription.nextBilling}</p>
            <Button onClick={() => setShowCancelModal(true)} style={styles.cancelButton}>
              Cancel Subscription
            </Button>
          </div>
        ) : (
          <div>
            <p style={{ marginBottom: '1rem' }}>No active subscription. Choose a plan below to get started.</p>
            <div style={styles.plansGrid}>
              {PLANS.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onSelect={() => handlePurchase(plan)}
                  selected={selectedPlan?.id === plan.id}
                />
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Account Settings */}
      <Card style={styles.card}>
        <h2>Account Settings</h2>
        
        <div style={styles.accountInfo}>
          <p><strong>Account Number:</strong> {profile?.account_number || auth.user?.accountNumber || '—'}</p>
          <p><strong>Account Status:</strong> {profile?.is_active || auth.user?.isActive ? 'Active' : 'Pending'}</p>
        </div>

        <div style={styles.settingsButtons}>
          <Button onClick={() => setShowPasswordForm(!showPasswordForm)}>
            Change Password
          </Button>
          <Button onClick={handleGenerateKit}>
            Generate New Recovery Kit
          </Button>
          <Button onClick={handleRequestDataExport}>
            Request Data Export
          </Button>
          <Button onClick={() => setShowDeleteModal(true)} style={styles.deleteButton}>
            Delete Account
          </Button>
        </div>

        {exportStatus && <p style={styles.success}>{exportStatus}</p>}
        {exportError && <p style={styles.error}>{exportError}</p>}
        {exportToken && (
          <p style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              onClick={() => triggerExportDownload(exportToken)}
              style={{ background: 'none', border: 'none', color: '#1E90FF', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
            >
              Download your export again
            </button>
          </p>
        )}

        {showPasswordForm && (
          <form onSubmit={handleChangePassword} style={styles.passwordForm}>
            <FormGroup label="Old Password">
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </FormGroup>
            <FormGroup label="New Password">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </FormGroup>
            <FormGroup label="Confirm New Password">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </FormGroup>
            {passwordError && <p style={styles.error}>{passwordError}</p>}
            {passwordSuccess && <p style={styles.success}>{passwordSuccess}</p>}
            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading ? 'Changing...' : 'Change Password'}
            </Button>
          </form>
        )}

        {showNewKit && (
          <div style={styles.kitContainer}>
            <p><strong>New Recovery Kit:</strong></p>
            <div style={styles.kitCode}>
              <code style={styles.kitCodeValue}>{newRecoveryKit}</code>
              <Button onClick={handleCopyKit} style={styles.copyButton}>
                {kitCopied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <p style={styles.kitWarning}>
              ⚠️ Save this recovery kit in a secure location. You will need it to recover your account if you forget your password.
            </p>
          </div>
        )}
      </Card>

      {/* VPN Credentials */}
      <Card style={styles.card}>
        <h2>VPN Credentials</h2>
        {profile?.vpn_username ? (
          <div style={styles.vpnCredsBox}>
            <p><strong>Username:</strong> <code>{profile.vpn_username}</code></p>
            <p><strong>Password:</strong> <code>{profile.vpn_password}</code></p>
            <p><strong>Status:</strong> {profile?.vpn_status || 'active'}</p>
            {profile?.vpn_expiry_date && (
              <p><strong>Expires:</strong> {new Date(profile.vpn_expiry_date).toLocaleString()}</p>
            )}
            {subscription?.current_period_end && (
              <p><strong>Subscription Expires:</strong> {new Date(subscription.current_period_end).toLocaleDateString()}</p>
            )}
          </div>
        ) : (
          <p style={{ marginBottom: '1rem' }}>
            VPN credentials are not available yet. If you paid with crypto, activation can take up to 15 minutes.
          </p>
        )}

        <p style={{ marginTop: '0.75rem' }}>
          After payment, download a client from{' '}
          <a href="/downloads" style={{ color: '#1E90FF' }}>https://ahoyvpn.net/downloads</a>
          {' '}and sign in with these credentials.
        </p>

        <Link href="/downloads">
          <Button>Open Downloads</Button>
        </Link>
      </Card>

      {/* Modals */}
      {showCancelModal && (
        <div style={styles.modalOverlay}>
          <Card style={styles.modal}>
            <h3>Cancel Subscription</h3>
            <p>Are you sure you want to cancel your subscription?</p>
            <div style={styles.modalButtons}>
              <Button onClick={() => setShowCancelModal(false)}>
                Keep Subscription
              </Button>
              <Button onClick={handleCancelSubscription} disabled={cancelLoading}>
                {cancelLoading ? 'Cancelling...' : 'Cancel Subscription'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showDeleteModal && (
        <div style={styles.modalOverlay}>
          <Card style={styles.modal}>
            <h3>Delete Account</h3>
            <p>Are you sure you want to delete your account? This action cannot be undone.</p>
            <div style={styles.modalButtons}>
              <Button onClick={() => setShowDeleteModal(false)}>
                Keep Account
              </Button>
              <Button onClick={handleDeleteAccount} disabled={deleteLoading} style={styles.deleteButton}>
                {deleteLoading ? 'Deleting...' : 'Delete Account'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// Plan Card Component
function PlanCard({ plan, onSelect, selected }) {
  return (
    <Card style={{
      ...styles.planCard,
      ...(selected && styles.planCardSelected),
      ...(plan.highlight && styles.planCardHighlighted)
    }}>
      <h3>{plan.name}</h3>
      <div style={styles.planPrice}>
        <span style={styles.priceAmount}>{plan.price}</span>
        <span style={styles.pricePeriod}>{plan.period}</span>
      </div>
      <p style={styles.planDescription}>{plan.description}</p>
      <ul style={styles.planFeatures}>
        {plan.features.map((feature, i) => (
          <li key={i}>{feature}</li>
        ))}
      </ul>
      {plan.cryptoOnly && (
        <p style={styles.cryptoOnly}>Crypto payment only</p>
      )}
      <Button onClick={onSelect} style={styles.selectButton}>
        Select Plan
      </Button>
    </Card>
  );
}

// Styles
const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
  },
  title: {
    marginBottom: '2rem',
  },
  card: {
    marginBottom: '2rem',
    padding: '2rem',
  },
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1.5rem',
    marginTop: '1.5rem',
  },
  planCard: {
    padding: '1.5rem',
    textAlign: 'center',
    transition: 'transform 0.2s',
  },
  planCardSelected: {
    border: '2px solid #4CAF50',
  },
  planCardHighlighted: {
    border: '1px solid #38BDF8',
    boxShadow: '0 0 0 1px rgba(56, 189, 248, 0.35)',
    background: 'rgba(15, 23, 42, 0.9)',
  },
  planPrice: {
    margin: '1rem 0',
  },
  priceAmount: {
    fontSize: '2rem',
    fontWeight: 'bold',
  },
  pricePeriod: {
    fontSize: '0.9rem',
    opacity: 0.8,
  },
  planDescription: {
    marginBottom: '1rem',
    opacity: 0.8,
  },
  planFeatures: {
    textAlign: 'left',
    marginBottom: '1rem',
    paddingLeft: '1.5rem',
  },
  cryptoOnly: {
    fontSize: '0.8rem',
    color: '#666',
    marginBottom: '1rem',
  },
  selectButton: {
    width: '100%',
  },
  paymentMethod: {
    display: 'flex',
    gap: '2rem',
    marginTop: '1.5rem',
    justifyContent: 'center',
  },
  accountInfo: {
    marginBottom: '1rem',
  },
  vpnCredsBox: {
    marginBottom: '1rem',
    padding: '1rem',
    borderRadius: '8px',
    background: 'rgba(30, 144, 255, 0.08)',
    border: '1px solid rgba(30, 144, 255, 0.25)',
    lineHeight: 1.8,
  },
  settingsButtons: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  passwordForm: {
    marginTop: '1.5rem',
    padding: '1.5rem',
    borderRadius: '10px',
    border: '1px solid #334155',
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, rgba(15, 23, 42, 0.78) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(148, 163, 184, 0.14)',
  },
  kitContainer: {
    marginTop: '1.5rem',
    padding: '1rem',
    borderRadius: '10px',
    border: '1px solid rgba(245, 158, 11, 0.45)',
    background: 'linear-gradient(180deg, rgba(120, 53, 15, 0.24) 0%, rgba(69, 26, 3, 0.3) 100%)',
  },
  kitCode: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    marginTop: '0.5rem',
  },
  kitCodeValue: {
    flex: 1,
    display: 'block',
    padding: '0.75rem',
    borderRadius: '8px',
    background: '#0B1220',
    border: '1px solid #1F2937',
    color: '#67E8F9',
    fontSize: '0.85rem',
    lineHeight: 1.4,
    wordBreak: 'break-all',
  },
  copyButton: {
    padding: '0.5rem 1rem',
    flexShrink: 0,
  },
  kitWarning: {
    marginTop: '1rem',
    fontSize: '0.9rem',
    color: '#FCD34D',
  },
  cancelButton: {
    marginTop: '1rem',
    background: '#dc3545',
  },
  deleteButton: {
    background: '#dc3545',
  },
  error: {
    color: '#dc3545',
    marginBottom: '1rem',
  },
  success: {
    color: '#28a745',
    marginBottom: '1rem',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    maxWidth: '400px',
    padding: '2rem',
  },
  modalButtons: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1.5rem',
  },
};
