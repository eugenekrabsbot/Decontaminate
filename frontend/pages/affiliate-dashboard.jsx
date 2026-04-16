import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import api from '../api/client';

export default function AffiliateDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState(null);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(null);
  const [tab, setTab] = useState('overview'); // overview | links | referrals | transactions | payout
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMsg, setPayoutMsg] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(0); // 0=idle, 1=confirming password, 2=showing codes, 3=done
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsRes, linksRes] = await Promise.all([
        api.getAffiliateMetrics(),
        api.getAffiliateLinks(),
      ]);
      setMetrics(metricsRes.data.data);
      setLinks(linksRes.data.data || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/affiliate');
      }
    } finally {
      setLoading(false);
    }
  };

  const [newCode, setNewCode] = useState('');
  const [newDiscount, setNewDiscount] = useState('0');

  const handleGenerateLink = async () => {
    setActionLoading(true);
    try {
      await api.generateAffiliateLink();
      // Refresh all links from API to get complete data (with discount_cents and url)
      const linksRes = await api.getAffiliateLinks();
      setLinks(linksRes.data.data || []);
    } catch {
      alert('Failed to generate link');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateCustomCode = async (e) => {
    e.preventDefault();
    if (!newCode.trim()) { alert('Enter a code'); return; }
    setActionLoading(true);
    try {
      await api.createAffiliateLinkWithCode(newCode.toUpperCase(), parseInt(newDiscount) || 0);
      // Refresh all links from API to get complete data (with discount_cents and url)
      const linksRes = await api.getAffiliateLinks();
      setLinks(linksRes.data.data || []);
      setNewCode('');
      setNewDiscount('0');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create code');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteLink = async (linkId) => {
    if (!confirm('Delete this link? This cannot be undone.')) return;
    try {
      await api.deleteAffiliateLink(linkId);
      setLinks(links.filter(l => l.id !== linkId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete link');
    }
  };

  const handleCopyLink = (link) => {
    const url = link?.url || (link?.code ? 'https://ahoyvpn.net/affiliate/' + link.code : '');
    if (url) {
      navigator.clipboard.writeText(url);
      setLinkCopied(link?.id);
      setTimeout(() => setLinkCopied(null), 2000);
    } else {
      alert('Link URL not available yet. Try refreshing.');
    }
  };

  const handleRequestPayout = async (e) => {
    e.preventDefault();
    setPayoutMsg('');
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) { setPayoutMsg('Enter a valid amount.'); return; }
    setActionLoading(true);
    try {
      await api.requestAffiliatePayout(amount);
      setPayoutMsg(`$${amount.toFixed(2)} payout request submitted. Email Ahoyvpn@ahoyvpn.net to complete.`);
      setPayoutAmount('');
      loadData();
    } catch (err) {
      setPayoutMsg(err.response?.data?.error || 'Payout request failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateRecoveryKit = async (e) => {
    e.preventDefault();
    setRecoveryError('');
    if (!recoveryPassword) { setRecoveryError('Enter your password to generate a recovery kit.'); return; }
    setRecoveryLoading(true);
    try {
      const res = await api.affiliateRegenerateKit(recoveryPassword);
      setRecoveryCodes(res.data.recoveryCodes || []);
      setRecoveryStep(2);
    } catch (err) {
      setRecoveryError(err.response?.data?.error || 'Failed to generate recovery kit.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleAffiliateLogout = async () => {
    await api.affiliateLogout();
    router.push('/affiliate');
  };

  if (loading) return <p style={{ textAlign: 'center', color: '#A0AEC0' }}>Loading...</p>;

  const m = metrics || {};

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', color: '#1E90FF', margin: 0 }}>Affiliate Dashboard</h1>
        <Button variant="secondary" size="sm" onClick={handleAffiliateLogout}>Logout</Button>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <MetricCard label="Total Signups" value={m.totalSignups ?? 0} />
        <MetricCard label="This Month" value={m.signupsThisMonth ?? 0} color="#10B981" />
        <MetricCard label="Active Referrals" value={m.activeReferrals ?? 0} color="#10B981" />
        <MetricCard label="Total Earned" value={`$${(m.totalEarned ?? 0).toFixed(2)}`} color="#00CED1" />
        <MetricCard label="Pending Payout" value={`$${m.pendingPayout?.toFixed(2) ?? '0.00'}`} color="#FFD93D" />
        <MetricCard label="Available" value={`$${m.availableToCashOut?.toFixed(2) ?? '0.00'}`} color="#1E90FF" />
        <MetricCard label="On Hold" value={`$${m.heldAmount?.toFixed(2) ?? '0.00'}`} color="#A0AEC0" />
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['overview','links','referrals','transactions','payout'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
            backgroundColor: tab === t ? '#1E90FF' : '#2A2A2A',
            color: tab === t ? '#fff' : '#A0AEC0', fontWeight: tab === t ? 'bold' : 'normal',
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <>
          <Card title="Attribution & Payout Rules" style={{ marginBottom: '1.5rem' }}>
            <ul style={{ color: '#B0C4DE', lineHeight: 2, paddingLeft: '1.5rem' }}>
              <li><strong>30-day attribution:</strong> Signups within 30 days of referral click are credited to you</li>
              <li><strong>Lifetime commissions:</strong> Earn on every payment for the lifetime of each referred account</li>
              <li><strong>30-day hold:</strong> Commissions held for 30 days before becoming available for payout</li>
              <li><strong>Minimum payout:</strong> $10 — request payout and email Ahoyvpn@ahoyvpn.net to complete</li>
              <li><strong>Recovery kit:</strong> Generate your recovery kit below — keep it safe to avoid being locked out</li>
            </ul>
          </Card>
          <Card title="Recovery Kit">
            <p style={{ color: '#A0AEC0', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Your recovery kit contains one-time codes you can use to reset your password if you&apos;re locked out. Each code can only be used once.
            </p>
            {recoveryStep === 0 && (
              <form onSubmit={handleGenerateRecoveryKit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ color: '#A0AEC0', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Confirm your password</label>
                  <input type="password" placeholder="Your current password" value={recoveryPassword} onChange={e => setRecoveryPassword(e.target.value)} required style={inputStyle} />
                </div>
                <Button type="submit" disabled={recoveryLoading}>{recoveryLoading ? 'Generating...' : 'Generate Recovery Kit'}</Button>
              </form>
            )}
            {recoveryStep === 2 && recoveryCodes.length > 0 && (
              <div>
                <p style={{ color: '#FFD93D', fontWeight: 'bold', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                  Save these codes now — they will not be shown again.
                </p>
                <div style={{ backgroundColor: '#1A1A1A', border: '1px solid #3A3A3A', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
                  {recoveryCodes.map((code, i) => (
                    <p key={i} style={{ color: '#00CED1', fontFamily: 'monospace', fontSize: '1.1rem', margin: '0.25rem 0', fontWeight: 'bold' }}>{code}</p>
                  ))}
                </div>
                <p style={{ color: '#A0AEC0', fontSize: '0.85rem' }}>Store these somewhere safe. If you lose your password, click "Forgot Password?" on the affiliate login page.</p>
                <Button variant="secondary" onClick={() => { setRecoveryStep(0); setRecoveryPassword(''); setRecoveryCodes([]); }} style={{ marginTop: '0.75rem' }}>Done</Button>
              </div>
            )}
            {recoveryError && <p style={{ color: '#FF6B6B', marginTop: '0.5rem' }}>{recoveryError}</p>}
          </Card>
        </>
      )}

      {/* Links */}
      {tab === 'links' && (
        <>
          {/* Create custom code */}
          <Card title="Create Affiliate Code" style={{ marginBottom: '1.5rem' }}>
            <form onSubmit={handleCreateCustomCode} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ color: '#A0AEC0', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Code</label>
                <input value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SUMMER50" style={{ ...inputStyle, width: '150px' }} />
              </div>
              <div>
                <label style={{ color: '#A0AEC0', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Discount</label>
                <select value={newDiscount} onChange={e => setNewDiscount(e.target.value)}
                  style={{ ...inputStyle, width: '150px' }}>
                  <option value="0">None</option>
                  <option value="25">$0.25 off</option>
                  <option value="50">$0.50 off</option>
                </select>
              </div>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? 'Creating...' : 'Create Code'}
              </Button>
              <span style={{ color: '#555', fontSize: '0.85rem', alignSelf: 'center' }}>or</span>
              <Button variant="secondary" onClick={handleGenerateLink} disabled={actionLoading}>
                Auto-Generate
              </Button>
            </form>
          </Card>

          <Card>
            <h3 style={{ color: '#1E90FF', margin: '0 0 1rem 0' }}>Your Affiliate Links</h3>
            {links.length === 0 ? (
              <p style={{ color: '#A0AEC0', textAlign: 'center', padding: '2rem' }}>No links yet. Create one above to start earning.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#2A2A2A', color: '#1E90FF' }}>
                      <th style={thStyle}>Code</th>
                      <th style={thStyle}>URL</th>
                      <th style={thStyle}>Clicks</th>
                      <th style={thStyle}>Signups</th>
                      <th style={thStyle}>Discount</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {links.map(link => (
                      <tr key={link.id} style={{ borderBottom: '1px solid #3A3A3A' }}>
                        <td style={tdStyle}><code style={{ color: '#00CED1' }}>{link.code}</code></td>
                        <td style={tdStyle}><code style={{ color: '#888', fontSize: '0.8rem' }}>{link.url}</code></td>
                        <td style={tdStyle}>{link.clicks ?? 0}</td>
                        <td style={tdStyle}>{link.signups ?? 0}</td>
                        <td style={tdStyle}>
                          <span style={{ color: link.discount_cents > 0 ? '#10B981' : '#A0AEC0' }}>
                            {link.discount_cents > 0 ? `$${(link.discount_cents / 100).toFixed(2)} off` : 'None'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: link.active !== false ? '#10B981' : '#FF6B6B' }}>
                            {link.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <Button variant="secondary" size="sm" onClick={() => handleCopyLink(link)}>
                              {linkCopied === link.id ? '\u2713 Copied' : 'Copy'}
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => handleDeleteLink(link.id)}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Referrals */}
      {tab === 'referrals' && (
        <Card>
          <h3 style={{ color: '#1E90FF', marginBottom: '1.5rem' }}>Referral History</h3>
          <ReferralsTab affiliateId={null} />
        </Card>
      )}

      {/* Transactions */}
      {tab === 'transactions' && (
        <Card>
          <h3 style={{ color: '#1E90FF', marginBottom: '1.5rem' }}>Transaction Ledger</h3>
          <TransactionsTab />
        </Card>
      )}

      {/* Payout */}
      {tab === 'payout' && (
        <Card title="Request Payout">
          <p style={{ color: '#A0AEC0', marginBottom: '1.5rem' }}>
            Available balance: <strong style={{ color: '#00CED1' }}>${m.availableToCashOut?.toFixed(2) ?? '0.00'}</strong>
            {' '}— Minimum: <strong>$10.00</strong>
          </p>
          <form onSubmit={handleRequestPayout} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#A0AEC0' }}>$</span>
            <input type="number" step="0.01" min="10" max={m.availableToCashOut?.toFixed(2)} placeholder="10.00"
              value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} required style={{ ...inputStyle, width: '120px' }} />
            <Button type="submit" disabled={actionLoading || (m.availableToCashOut ?? 0) < 10}>
              {actionLoading ? 'Submitting...' : 'Request Payout'}
            </Button>
          </form>
          {payoutMsg && (
            <p style={{ marginTop: '1rem', color: payoutMsg.includes('submitted') ? '#10B981' : '#FF6B6B' }}>
              {payoutMsg}
            </p>
          )}
          <p style={{ color: '#666', fontSize: '0.85rem', marginTop: '1rem' }}>
            After requesting, email <strong>Ahoyvpn@ahoyvpn.net</strong> with your username and amount to complete the payout.
          </p>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ label, value, color = '#1E90FF' }) {
  return (
    <Card style={{ textAlign: 'center', padding: '1.25rem' }}>
      <p style={{ color: '#A0AEC0', fontSize: '0.85rem', marginBottom: '0.4rem' }}>{label}</p>
      <p style={{ fontSize: '1.8rem', fontWeight: 'bold', color }}>{value}</p>
    </Card>
  );
}

function ReferralsTab() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  useEffect(() => { loadReferrals(1); }, []);

  const loadReferrals = async (p) => {
    setLoading(true);
    try {
      const res = await api.getAffiliateReferrals(p);
      setReferrals(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <p style={{ color: '#A0AEC0' }}>Loading...</p>;
  if (referrals.length === 0) return <p style={{ color: '#A0AEC0', textAlign: 'center' }}>No referrals yet.</p>;

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#2A2A2A', color: '#1E90FF' }}>
              {['Plan','Amount','Commission Date','Status'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {referrals.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #3A3A3A' }}>
                <td style={tdStyle}>{r.plan || '—'}</td>
                <td style={tdStyle}>{r.amount ? `$${r.amount.toFixed(2)}` : '—'}</td>
                <td style={tdStyle}>{r.transaction_date ? new Date(r.transaction_date).toLocaleDateString() : new Date(r.created_at).toLocaleDateString()}</td>
                <td style={tdStyle}>
                  <span style={{
                    color: r.status === 'active' ? '#10B981' : r.status === 'pending' ? '#FFD93D' : '#A0AEC0',
                  }}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination.pages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => { setPage(p); loadReferrals(p); }}
              style={{ padding: '0.3rem 0.7rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
                backgroundColor: p === page ? '#1E90FF' : '#2A2A2A', color: p === page ? '#fff' : '#A0AEC0' }}>
              {p}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function TransactionsTab() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTransactions(); }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.getAffiliateTransactions();
      setTransactions(res.data.data || []);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <p style={{ color: '#A0AEC0' }}>Loading...</p>;
  if (transactions.length === 0) return <p style={{ color: '#A0AEC0', textAlign: 'center' }}>No transactions yet.</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#2A2A2A', color: '#1E90FF' }}>
            {['Type','Amount','Description','Date','Paid Out'].map(h => <th key={h} style={thStyle}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {transactions.map(t => (
            <tr key={t.id} style={{ borderBottom: '1px solid #3A3A3A' }}>
              <td style={tdStyle}>
                <span style={{ color: t.type === 'commission' ? '#10B981' : '#00CED1', fontWeight: 'bold', textTransform: 'capitalize' }}>
                  {t.type}
                </span>
              </td>
              <td style={tdStyle}>
                <span style={{ color: t.type === 'commission' ? '#10B981' : '#FF6B6B' }}>
                  {t.type === 'payout' ? '-' : '+'}${Math.abs(t.amount).toFixed(2)}
                </span>
              </td>
              <td style={tdStyle}>{t.description || '—'}</td>
              <td style={tdStyle}>{new Date(t.created_at).toLocaleDateString()}</td>
              <td style={tdStyle}>{t.paid_out_at ? new Date(t.paid_out_at).toLocaleDateString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = {
  padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #3A3A3A',
  backgroundColor: '#1A1A1A', color: '#F0F4F8', fontSize: '0.9rem', outline: 'none',
};

const thStyle = { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem' };
const tdStyle = { padding: '0.75rem 1rem', color: '#B0C4DE', fontSize: '0.9rem' };
