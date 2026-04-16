import { useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { FormGroup, Input } from '../components/ui/Form';
import api from '../api/client';
import { AuthContext } from './_app';
import { sanitizeText } from '../lib/sanitize';

export default function Admin() {
  const router = useRouter();
  const auth = useContext(AuthContext);

  // Redirect if not admin
  useEffect(() => {
    if (!auth?.isLoggedIn) {
      router.push('/login');
    }
    if (auth?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [auth, router]);

  const [tab, setTab] = useState('kpis'); // kpis, customers, affiliates
  const [metrics, setMetrics] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerData, setCustomerData] = useState(null);
  const [searching, setSearching] = useState(false);
  const [affiliates, setAffiliates] = useState([]);
  const [affiliatesLoading, setAffiliatesLoading] = useState(false);

  // Load metrics
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const response = await api.adminMetrics();
        setMetrics(response.data);
      } catch (err) {
        console.error('Failed to load metrics');
      }
    };
    if (auth?.role === 'admin') {
      loadMetrics();
    }
  }, [auth]);

  // Load affiliates when tab changes
  const loadAffiliates = async () => {
    setAffiliatesLoading(true);
    try {
      const response = await api.getAffiliates();
      setAffiliates(response.data || []);
    } catch (err) {
      console.error('Failed to load affiliates');
      setAffiliates([]);
    } finally {
      setAffiliatesLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'affiliates' && auth?.role === 'admin') {
      loadAffiliates();
    }
  }, [tab, auth]);

  const handleSearchCustomer = async (e) => {
    e.preventDefault();
    const sanitizedSearch = sanitizeText(customerSearch);
    if (!sanitizedSearch.trim()) return;

    setSearching(true);
    try {
      const response = await api.searchCustomer(sanitizedSearch);
      setCustomerData(response.data);
    } catch (err) {
      setCustomerData(null);
    } finally {
      setSearching(false);
    }
  };

  const handleDisableAffiliate = async (id) => {
    if (!confirm('Are you sure you want to disable this affiliate? They will no longer earn commissions.')) return;
    try {
      await api.disableAffiliate(id);
      // Refresh affiliates list
      const response = await api.getAffiliates();
      setAffiliates(response.data || []);
    } catch (err) {
      console.error('Failed to disable affiliate', err);
    }
  };

  const handleAdjustEarnings = async (id) => {
    const amount = prompt('Enter adjustment amount in cents (positive to add, negative to deduct):');
    if (amount === null || amount.trim() === '') return;
    const amountCents = parseInt(amount, 10);
    if (isNaN(amountCents)) {
      alert('Invalid amount');
      return;
    }
    const reason = prompt('Reason for adjustment:');
    if (reason === null) return;
    try {
      await api.adjustAffiliateEarnings(id, amountCents, reason);
      // Refresh affiliates list
      const response = await api.getAffiliates();
      setAffiliates(response.data || []);
    } catch (err) {
      console.error('Failed to adjust earnings', err);
    }
  };

  const handleExportAffiliates = () => {
    // Simple CSV export
    const headers = ['Account', 'Code', 'Active Referrals', 'Total Commission', 'Pending Payout', 'Status'];
    const rows = affiliates.map(aff => [
      aff.account_number,
      aff.code,
      aff.active_referrals || 0,
      `$${((aff.total_commission_cents || 0) / 100).toFixed(2)}`,
      `$${((aff.pending_payout_cents || 0) / 100).toFixed(2)}`,
      aff.is_active ? 'Active' : 'Disabled'
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `affiliates-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (auth?.role !== 'admin') {
    return <p>Redirecting...</p>;
  }

  if (!metrics) {
    return <p style={{ textAlign: 'center' }}>Loading admin dashboard...</p>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Admin Dashboard</h1>

      {/* Tabs */}
      <div style={styles.tabsContainer}>
        <button
          onClick={() => setTab('kpis')}
          style={{ ...styles.tab, ...(tab === 'kpis' && styles.tabActive) }}
        >
          System KPIs
        </button>
        <button
          onClick={() => setTab('customers')}
          style={{ ...styles.tab, ...(tab === 'customers' && styles.tabActive) }}
        >
          Customers
        </button>
        <button
          onClick={() => setTab('affiliates')}
          style={{ ...styles.tab, ...(tab === 'affiliates' && styles.tabActive) }}
        >
          Affiliates
        </button>
      </div>

      {/* KPIs Tab */}
      {tab === 'kpis' && (
        <div style={styles.content}>
          <div style={styles.kpisGrid}>
            <KPICard label="Total Customers" value={metrics.totalCustomers} />
            <KPICard label="Active Subscriptions" value={metrics.activeSubscriptions} />
            <KPICard label="Monthly Recurring Revenue" value={`$${metrics.mrr.toFixed(2)}`} />
          </div>

          <Card title="Payment Method Split" style={{ marginBottom: '2rem' }}>
            <div style={styles.paymentSplit}>
              <div style={styles.splitItem}>
                <div style={styles.splitLabel}>Cryptocurrency</div>
                <div style={styles.splitBar}>
                  <div
                    style={{
                      ...styles.splitFill,
                      width: `${metrics.cryptoVsFiat.crypto}%`,
                    }}
                  ></div>
                </div>
                <div style={styles.splitPercent}>{metrics.cryptoVsFiat.crypto}%</div>
              </div>
              <div style={styles.splitItem}>
                <div style={styles.splitLabel}>Fiat (Credit Card)</div>
                <div style={styles.splitBar}>
                  <div
                    style={{
                      ...styles.splitFill,
                      backgroundColor: '#20B2AA',
                      width: `${metrics.cryptoVsFiat.fiat}%`,
                    }}
                  ></div>
                </div>
                <div style={styles.splitPercent}>{metrics.cryptoVsFiat.fiat}%</div>
              </div>
            </div>
          </Card>

          <Card title="System Notes">
            <ul style={styles.notesList}>
              <li>MRR is calculated from active subscriptions only</li>
              <li>Crypto includes Bitcoin and other cryptocurrencies via Plisio</li>
              <li>Fiat includes all credit card payments via PaymentsCloud</li>
              <li>Metrics update in real-time as subscriptions change</li>
            </ul>
          </Card>
        </div>
      )}

      {/* Customers Tab */}
      {tab === 'customers' && (
        <div style={styles.content}>
          <Card title="Search Customer" style={{ marginBottom: '2rem' }}>
            <form onSubmit={handleSearchCustomer} style={styles.searchForm}>
              <FormGroup label="Customer User ID">
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Input
                    type="text"
                    placeholder="e.g., 12345678"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    disabled={searching}
                  />
                  <Button type="submit" disabled={searching}>
                    Search
                  </Button>
                </div>
              </FormGroup>
            </form>
          </Card>

          {customerData && (
            <Card title="Customer Details" style={{ marginBottom: '2rem' }}>
              <div style={styles.customerGrid}>
                <div>
                  <p style={styles.label}>User ID</p>
                  <p style={styles.value}>{customerData.id}</p>
                </div>
                <div>
                  <p style={styles.label}>Plan</p>
                  <p style={styles.value}>{customerData.subscription?.plan || 'N/A'}</p>
                </div>
                <div>
                  <p style={styles.label}>Status</p>
                  <p style={{ ...styles.value, color: customerData.subscription?.status === 'active' ? '#00CED1' : '#FF6B6B' }}>
                    {customerData.subscription?.status || 'N/A'}
                  </p>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ color: '#1E90FF', marginBottom: '1rem' }}>Admin Actions</h4>
                <div style={styles.actionsGrid}>
                  <Button variant="secondary">Reset Password</Button>
                  <Button variant="secondary">Issue Recovery Kit</Button>
                  <Button variant="secondary">Deactivate</Button>
                  <Button variant="danger">Delete Account</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Affiliates Tab */}
      {tab === 'affiliates' && (
        <div style={styles.content}>
          <Card title="Affiliate Management">
            {affiliatesLoading ? (
              <p style={{ color: '#B0C4DE', textAlign: 'center' }}>Loading affiliates...</p>
            ) : affiliates.length === 0 ? (
              <p style={{ color: '#A0AEC0', textAlign: 'center' }}>No affiliates found.</p>
            ) : (
              <div style={styles.affiliatesTable}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#2A2A2A' }}>
                      <th style={styles.tableHeader}>Account</th>
                      <th style={styles.tableHeader}>Code</th>
                      <th style={styles.tableHeader}>Active Referrals</th>
                      <th style={styles.tableHeader}>Total Commission</th>
                      <th style={styles.tableHeader}>Pending Payout</th>
                      <th style={styles.tableHeader}>Status</th>
                      <th style={styles.tableHeader}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {affiliates.map((aff) => (
                      <tr key={aff.id} style={{ borderBottom: '1px solid #3A3A3A' }}>
                        <td style={styles.tableCell}>{aff.account_number}</td>
                        <td style={styles.tableCell}><code>{aff.code}</code></td>
                        <td style={styles.tableCell}>{aff.active_referrals || 0}</td>
                        <td style={styles.tableCell}>${((aff.total_commission_cents || 0) / 100).toFixed(2)}</td>
                        <td style={styles.tableCell}>${((aff.pending_payout_cents || 0) / 100).toFixed(2)}</td>
                        <td style={styles.tableCell}>
                          <span style={{ color: aff.is_active ? '#00CED1' : '#FF6B6B' }}>
                            {aff.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td style={styles.tableCell}>
                          <Button variant="secondary" size="sm" onClick={() => handleDisableAffiliate(aff.id)} disabled={!aff.is_active}>
                            Disable
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleAdjustEarnings(aff.id)} style={{ marginLeft: '0.5rem' }}>
                            Adjust
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
              <Button variant="secondary" onClick={handleExportAffiliates}>
                Export CSV
              </Button>
              <Button variant="secondary" onClick={loadAffiliates}>
                Refresh
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value }) {
  return (
    <Card style={{ textAlign: 'center' }}>
      <p style={{ color: '#A0AEC0', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
        {label}
      </p>
      <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1E90FF' }}>
        {value}
      </p>
    </Card>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
  },

  title: {
    fontSize: '2.5rem',
    color: '#1E90FF',
    marginBottom: '2rem',
  },

  tabsContainer: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '2rem',
    borderBottom: '1px solid #3A3A3A',
  },

  tab: {
    padding: '1rem 1.5rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#B0C4DE',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontWeight: 500,
    fontSize: '1rem',
  },

  tabActive: {
    color: '#1E90FF',
    borderBottomColor: '#1E90FF',
  },

  content: {
    marginBottom: '2rem',
  },

  kpisGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },

  paymentSplit: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },

  splitItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },

  splitLabel: {
    color: '#F0F4F8',
    fontWeight: 600,
  },

  splitBar: {
    backgroundColor: '#2A2A2A',
    borderRadius: '4px',
    height: '24px',
    overflow: 'hidden',
  },

  splitFill: {
    backgroundColor: '#1E90FF',
    height: '100%',
    transition: 'width 0.3s ease',
  },

  splitPercent: {
    color: '#B0C4DE',
    fontSize: '0.9rem',
    fontWeight: 500,
  },

  notesList: {
    color: '#B0C4DE',
    lineHeight: 1.8,
    paddingLeft: '1.5rem',
  },

  searchForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },

  customerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem',
  },

  label: {
    color: '#A0AEC0',
    fontSize: '0.85rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    marginBottom: '0.5rem',
  },

  value: {
    fontSize: '1.3rem',
    fontWeight: 'bold',
    color: '#F0F4F8',
  },

  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem',
  },

  affiliatesTable: {
    overflowX: 'auto',
    marginBottom: '1.5rem',
  },

  tableHeader: {
    padding: '0.75rem',
    textAlign: 'left',
    color: '#1E90FF',
    backgroundColor: '#2A2A2A',
    borderBottom: '1px solid #3A3A3A',
  },

  tableCell: {
    padding: '0.75rem',
    color: '#B0C4DE',
    borderBottom: '1px solid #3A3A3A',
  },
};
