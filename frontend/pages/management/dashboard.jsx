import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { FormGroup, Input } from '../../components/ui/Form';
import api from '../../api/client';

export default function Admin() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const role = localStorage.getItem('userRole');
    if (!token || role !== 'admin') {
      router.replace('/ahoyman');
      return;
    }
    setAuthChecked(true);
  }, [router]);

  const [tab, setTab] = useState('kpis');
  const [metrics, setMetrics] = useState(null);
  const [metricsError, setMetricsError] = useState('');

  // Affiliates
  const [affiliates, setAffiliates] = useState([]);
  const [affiliatesLoading, setAffiliatesLoading] = useState(false);
  const [showAffiliateModal, setShowAffiliateModal] = useState(false);
  const [newAffiliate, setNewAffiliate] = useState({ username: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [resettingPw, setResettingPw] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [resetPwError, setResetPwError] = useState('');
  const [resetPwSuccess, setResetPwSuccess] = useState('');

  // Customers
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  // Tax
  const [taxData, setTaxData] = useState([]);
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxSummary, setTaxSummary] = useState(null);

  // Load KPIs
  useEffect(() => {
    if (!authChecked) return;
    const loadMetrics = async () => {
      try {
        const response = await api.adminMetrics();
        setMetrics(response.data);
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('userRole');
          router.replace('/ahoyman');
          return;
        }
        setMetricsError('Failed to load dashboard data.');
      }
    };
    loadMetrics();
  }, [authChecked, router]);

  const loadAffiliates = async () => {
    setAffiliatesLoading(true);
    try {
      const response = await api.getAffiliates();
      setAffiliates(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Failed to load affiliates');
    } finally {
      setAffiliatesLoading(false);
    }
  };

  const loadCustomers = async (page = 1) => {
    setCustomersLoading(true);
    try {
      const response = await api.get('/admin/customers', { page, limit: 20 });
      const data = response.data || response;
      if (Array.isArray(data)) {
        setCustomers(data);
      } else if (data.customers) {
        setCustomers(data.customers);
        setCustomerTotal(data.total || data.customers.length);
      } else {
        setCustomers([]);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  const loadTaxData = async () => {
    setTaxLoading(true);
    try {
      const [txResponse, summaryResponse] = await Promise.all([
        api.get('/admin/tax-transactions'),
        api.get('/admin/tax-transactions/summary')
      ]);
      setTaxData(txResponse.data || []);
      setTaxSummary(summaryResponse.data || null);
    } catch (err) {
      console.error('Failed to load tax data:', err);
      setTaxData([]);
    } finally {
      setTaxLoading(false);
    }
  };

  const handleCreateAffiliate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const response = await api.createAffiliate(newAffiliate);
      setAffiliates(prev => [...(Array.isArray(prev) ? prev : []), response.data]);
      setShowAffiliateModal(false);
      setNewAffiliate({ username: '', email: '', password: '' });
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create affiliate');
    } finally {
      setCreating(false);
    }
  };

  const handleResetAffiliatePassword = async (affiliateId) => {
    setResetPwError('');
    setResetPwSuccess('');
    if (!newPw || newPw.length < 8) {
      setResetPwError('Password must be at least 8 characters');
      return;
    }
    try {
      await api.post(`/admin/affiliates/${affiliateId}/reset-password`, { password: newPw });
      setResetPwSuccess('Password updated!');
      setNewPw('');
      setResettingPw(null);
      setTimeout(() => { setResetPwSuccess(''); setResetPwError(''); }, 3000);
    } catch (err) {
      setResetPwError(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const handleSearchCustomer = async (e) => {
    e.preventDefault();
    if (!customerSearch.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const response = await api.searchCustomer(customerSearch);
      setSearchResult(response.data);
    } catch (err) {
      setSearchResult(null);
    } finally {
      setSearching(false);
    }
  };

  const exportTaxCSV = () => {
    window.open('/api/admin/tax-transactions/export/csv', '_blank');
  };

  const TABS = ['kpis', 'customers', 'affiliates', 'tax'];

  if (!authChecked) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#B0C4DE' }}>Loading...</div>;
  }

  if (metricsError) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#ff6b6b' }}>{metricsError}</p>
        <Button onClick={() => router.replace('/ahoyman')}>Back to Login</Button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Management Dashboard</h1>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t}
            style={tab === t ? styles.tabActive : styles.tab}
            onClick={() => {
              setTab(t);
              if (t === 'affiliates') loadAffiliates();
              if (t === 'customers') { setCustomerPage(1); loadCustomers(1); }
              if (t === 'tax') loadTaxData();
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ========== KPIs TAB ========== */}
      {tab === 'kpis' && metrics && (
        <>
          <div style={styles.metricsGrid}>
            <MetricCard label="Total Customers" value={metrics.totalCustomers ?? 0} />
            <MetricCard label="Active Subscriptions" value={metrics.activeSubscriptions ?? 0} />
            <MetricCard label="Total Affiliates" value={metrics.totalAffiliates ?? 0} />
            <MetricCard label="Active Affiliates" value={metrics.activeAffiliates ?? 0} />
            <MetricCard label="Total Referred" value={metrics.totalReferredCustomers ?? 0} />
            <MetricCard label="Total Revenue" value={'$' + (metrics.totalRevenue?.toFixed(2) ?? '0.00')} />
            <MetricCard label="Monthly Recurring" value={'$' + (metrics.mrr?.toFixed(2) ?? '0.00')} />
            <MetricCard label="Affiliate Earnings" value={'$' + (metrics.affiliateEarnings?.toFixed(2) ?? '0.00')} />
            <MetricCard label="Pending Payouts" value={'$' + (metrics.pendingPayouts?.toFixed(2) ?? '0.00')} />
            <MetricCard label="Total Earned" value={'$' + (metrics.totalEarned?.toFixed(2) ?? '0.00')} />
          </div>
          <div style={{ color: '#718096', fontSize: '0.8rem', marginTop: '1rem' }}>
            Note: Affiliate-specific KPIs are in the Affiliates tab.
          </div>
        </>
      )}

      {/* ========== CUSTOMERS TAB ========== */}
      {tab === 'customers' && (
        <div>
          {/* Search */}
          <form onSubmit={handleSearchCustomer} style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Search by account number or username..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              style={{ flex: 1, padding: '0.75rem', backgroundColor: '#1a1a2e', border: '1px solid #2d3748', borderRadius: '8px', color: '#fff' }}
            />
            <Button type="submit" disabled={searching}>{searching ? 'Searching...' : 'Search'}</Button>
            {customerSearch && (
              <Button type="button" onClick={() => { setCustomerSearch(''); setSearchResult(null); loadCustomers(customerPage); }} style={{ backgroundColor: '#4a5568' }}>
                Show All
              </Button>
            )}
          </form>

          {/* Search result */}
          {searchResult && (
            <Card title="Search Result" style={{ marginBottom: '1.5rem' }}>
              <div style={styles.customerRow}>
                <div><strong>Account:</strong> {searchResult.accountNumber || searchResult.username || 'N/A'}</div>
                <div><strong>Status:</strong> {searchResult.is_active !== false ? 'Active' : 'Inactive'}</div>
                {searchResult.subscription && <div><strong>Plan:</strong> {searchResult.subscription}</div>}
                {searchResult.created_at && <div><strong>Joined:</strong> {new Date(searchResult.created_at).toLocaleDateString()}</div>}
              </div>
            </Card>
          )}

          {/* Full customer list */}
          {customersLoading ? (
            <p style={{ color: '#B0C4DE' }}>Loading customers...</p>
          ) : (
            <>
              <Card title={`All Customers${customerTotal ? ` (${customerTotal} total)` : ''}`}>
                {customers.length === 0 ? (
                  <p style={{ color: '#718096' }}>No customers found.</p>
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Status</th>
                        <th>Affiliate</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map(c => (
                        <tr key={c.id}>
                          <td>{c.account_number || c.username || c.id}</td>
                          <td>
                            <span style={c.is_active !== false ? { color: '#48bb78' } : { color: '#f56565' }}>
                              {c.is_active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>{c.affiliate_username || '—'}</td>
                          <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
              {customerTotal > 20 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                  <Button disabled={customerPage <= 1} onClick={() => { const p = customerPage - 1; setCustomerPage(p); loadCustomers(p); }}>
                    Previous
                  </Button>
                  <span style={{ color: '#B0C4DE', lineHeight: '2.4rem' }}>Page {customerPage}</span>
                  <Button disabled={customers.length < 20} onClick={() => { const p = customerPage + 1; setCustomerPage(p); loadCustomers(p); }}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========== AFFILIATES TAB ========== */}
      {tab === 'affiliates' && (
        <div>
          <Button onClick={() => setShowAffiliateModal(true)} style={{ marginBottom: '1.5rem' }}>+ Create New Affiliate</Button>

          {resetPwSuccess && (
            <div style={{ color: '#48bb78', marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#1a2e1e', borderRadius: '4px' }}>
              ✓ {resetPwSuccess}
            </div>
          )}

          {affiliatesLoading ? (
            <p style={{ color: '#B0C4DE' }}>Loading affiliates...</p>
          ) : affiliates.length === 0 ? (
            <p style={{ color: '#718096' }}>No affiliates yet.</p>
          ) : (
            affiliates.map(a => (
              <Card key={a.id} title={a.username} style={{ marginBottom: '1rem' }}>
                {/* Per-affiliate KPI metrics */}
                <div style={styles.metricsGridSm}>
                  <div style={styles.miniMetric}>
                    <div style={{ color: '#1E90FF', fontWeight: 'bold' }}>{a.total_referrals ?? 0}</div>
                    <div style={{ color: '#718096', fontSize: '0.8rem' }}>Total Referrals</div>
                  </div>
                  <div style={styles.miniMetric}>
                    <div style={{ color: '#48bb78', fontWeight: 'bold' }}>{a.active_referrals ?? 0}</div>
                    <div style={{ color: '#718096', fontSize: '0.8rem' }}>Active Referrals</div>
                  </div>
                  <div style={styles.miniMetric}>
                    <div style={{ color: '#ecc94b', fontWeight: 'bold' }}>${((a.total_earned_cents || 0) / 100).toFixed(2)}</div>
                    <div style={{ color: '#718096', fontSize: '0.8rem' }}>Total Earned</div>
                  </div>
                  <div style={styles.miniMetric}>
                    <div style={{ color: '#ed8936', fontWeight: 'bold' }}>${((a.total_paid_cents || 0) / 100).toFixed(2)}</div>
                    <div style={{ color: '#718096', fontSize: '0.8rem' }}>Total Paid Out</div>
                  </div>
                  <div style={styles.miniMetric}>
                    <div style={{ color: a.status === 'active' ? '#48bb78' : '#f56565', fontWeight: 'bold' }}>{a.status || 'active'}</div>
                    <div style={{ color: '#718096', fontSize: '0.8rem' }}>Status</div>
                  </div>
                  <div style={styles.miniMetric}>
                    <div style={{ color: '#B0C4DE', fontWeight: 'bold' }}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}</div>
                    <div style={{ color: '#718096', fontSize: '0.8rem' }}>Joined</div>
                  </div>
                </div>

                {/* Reset password */}
                <div style={{ marginTop: '1rem', borderTop: '1px solid #2d3748', paddingTop: '1rem' }}>
                  {resettingPw === a.id ? (
                    <div>
                      {resetPwError && <p style={{ color: '#f56565', marginBottom: '0.5rem', fontSize: '0.85rem' }}>{resetPwError}</p>}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="password"
                          placeholder="New password (8+ chars)"
                          value={newPw}
                          onChange={e => setNewPw(e.target.value)}
                          style={{ flex: 1, padding: '0.5rem', backgroundColor: '#1a1a2e', border: '1px solid #2d3748', borderRadius: '4px', color: '#fff' }}
                        />
                        <Button onClick={() => handleResetAffiliatePassword(a.id)}>Save</Button>
                        <Button onClick={() => { setResettingPw(null); setNewPw(''); setResetPwError(''); }} style={{ backgroundColor: '#4a5568' }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      style={{ backgroundColor: '#4a5568', fontSize: '0.85rem' }}
                      onClick={() => { setResettingPw(a.id); setNewPw(''); setResetPwError(''); }}
                    >
                      Reset Password
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ========== TAX TAB ========== */}
      {tab === 'tax' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ color: '#fff', margin: 0 }}>Sales Tax Transactions</h2>
            <Button onClick={exportTaxCSV}>Export CSV</Button>
          </div>

          {/* Summary */}
          {taxSummary && (
            <div style={styles.metricsGrid}>
              <MetricCard label="Total Transactions" value={taxSummary.totalTransactions ?? taxData.length} color="#1E90FF" />
              <MetricCard label="Total Base Revenue" value={'$' + ((taxSummary.totalBaseRevenueCents || 0) / 100).toFixed(2)} color="#48bb78" />
              <MetricCard label="Total Tax Collected" value={'$' + ((taxSummary.totalTaxCents || 0) / 100).toFixed(2)} color="#ecc94b" />
              <MetricCard label="States Covered" value={Object.keys(taxSummary.byState || {}).length} color="#ed8936" />
            </div>
          )}

          {/* Table */}
          {taxLoading ? (
            <p style={{ color: '#B0C4DE' }}>Loading tax data...</p>
          ) : taxData.length === 0 ? (
            <p style={{ color: '#718096' }}>No tax transactions found.</p>
          ) : (
            <Card>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Account</th>
                      <th>State</th>
                      <th>Base</th>
                      <th>Tax Rate</th>
                      <th>Tax</th>
                      <th>Total</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxData.map((tx, i) => (
                      <tr key={i}>
                        <td>{tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString() : '—'}</td>
                        <td>{tx.user_account_number || tx.account_number || tx.accountNumber || '—'}</td>
                        <td>{tx.state || '—'}</td>
                        <td>${((tx.base_charge_cents || 0) / 100).toFixed(2)}</td>
                        <td>{parseFloat(tx.tax_rate || 0).toFixed(2)}%</td>
                        <td>${((tx.tax_amount_cents || 0) / 100).toFixed(2)}</td>
                        <td>${((tx.total_amount_cents || 0) / 100).toFixed(2)}</td>
                        <td>{tx.payment_status || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Create Affiliate Modal */}
      {showAffiliateModal && (
        <div style={styles.modal}>
          <Card title="Create New Affiliate" style={{ width: '400px' }}>
            {createError && <div style={{ color: '#ff6b6b', marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#2d1f1f', borderRadius: '4px' }}>{createError}</div>}
            <form onSubmit={handleCreateAffiliate}>
              <FormGroup label="Username"><Input type="text" value={newAffiliate.username} onChange={e => setNewAffiliate({...newAffiliate, username: e.target.value})} required /></FormGroup>
              <FormGroup label="Email"><Input type="email" value={newAffiliate.email} onChange={e => setNewAffiliate({...newAffiliate, email: e.target.value})} required /></FormGroup>
              <FormGroup label="Password"><Input type="password" value={newAffiliate.password} onChange={e => setNewAffiliate({...newAffiliate, password: e.target.value})} required /></FormGroup>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create'}</Button>
                <Button type="button" onClick={() => { setShowAffiliateModal(false); setCreateError(''); }} style={{ backgroundColor: '#4a5568' }}>Cancel</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color = '#1E90FF' }) {
  return (
    <div style={styles.metricCard}>
      <div style={{ ...styles.metricValue, color }}>{value}</div>
      <div style={styles.metricLabel}>{label}</div>
    </div>
  );
}

const styles = {
  container: { padding: '2rem 0' },
  title: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem', color: '#fff' },
  tabs: { display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' },
  tab: { padding: '0.6rem 1.25rem', backgroundColor: '#1a1a2e', border: '1px solid #2d3748', borderRadius: '8px', color: '#B0C4DE', cursor: 'pointer', fontSize: '0.9rem' },
  tabActive: { padding: '0.6rem 1.25rem', backgroundColor: '#1E90FF', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.9rem' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' },
  metricsGridSm: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' },
  miniMetric: { backgroundColor: '#1a1a2e', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' },
  metricCard: { backgroundColor: '#1a1a2e', padding: '1.25rem', borderRadius: '12px', textAlign: 'center' },
  metricValue: { fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '0.4rem' },
  metricLabel: { color: '#B0C4DE', fontSize: '0.82rem' },
  modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  customerRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', color: '#B0C4DE' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: '#B0C4DE' },
};
