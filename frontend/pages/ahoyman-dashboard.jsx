import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import api from '../api/client';

export default function AhoyManDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.adminMetrics();
      setMetrics(res.data.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) router.push('/ahoyman');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await api.ahoymanLogout();
    router.push('/ahoyman');
  };

  if (loading) return <p style={{ textAlign: 'center', color: '#A0AEC0' }}>Loading...</p>;

  const m = metrics || {};

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', color: '#8B5CF6', margin: 0 }}>Manager Dashboard</h1>
        <Button variant="secondary" size="sm" onClick={handleLogout}>Logout</Button>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <MetricCard label="Total Affiliates" value={m.totalAffiliates ?? 0} color="#8B5CF6" />
        <MetricCard label="Active Affiliates" value={m.activeAffiliates ?? 0} color="#10B981" />
        <MetricCard label="Total Referrals" value={m.totalReferredCustomers ?? 0} color="#1E90FF" />
        <MetricCard label="Active Referrals" value={m.activeReferrals ?? 0} color="#10B981" />
        <MetricCard label="Commissions Paid" value={`$${(m.totalCommissionsPaid ?? 0).toFixed(2)}`} color="#00CED1" />
        <MetricCard label="Pending Payouts" value={`$${(m.pendingPayouts ?? 0).toFixed(2)}`} color="#FFD93D" />
        <MetricCard label="Total Earned" value={`$${(m.totalEarned ?? 0).toFixed(2)}`} color="#1E90FF" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['overview','affiliates','codes','payouts','sales-tax','settings'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
            backgroundColor: tab === t ? '#8B5CF6' : '#2A2A2A',
            color: tab === t ? '#fff' : '#A0AEC0', fontWeight: tab === t ? 'bold' : 'normal',
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <Card title="Getting Started">
          <ul style={{ color: '#B0C4DE', lineHeight: 2, paddingLeft: '1.5rem' }}>
            <li><strong>Affiliates tab:</strong> Create affiliate accounts, view performance, suspend/reactivate accounts</li>
            <li><strong>Payouts tab:</strong> Review and approve payout requests, log manual payments</li>
            <li><strong>Sales Tax tab:</strong> View collected tax by state, filter by date, export CSV for filing</li>
            <li><strong>Settings tab:</strong> Configure commission rates, minimum payout, and hold period</li>
            <li><strong>Recovery kits:</strong> When creating an affiliate, give them the recovery codes shown — they need these to reset their password</li>
            <li><strong>Contact:</strong> Payouts are completed manually — affiliates email ahoyvpn@ahoyvpn.net</li>
          </ul>
        </Card>
      )}

      {tab === 'affiliates' && <AffiliatesTab onAction={loadData} />}
      {tab === 'payouts' && <PayoutsTab onAction={loadData} />}
      {tab === 'codes' && <CodesTab />}
      {tab === 'sales-tax' && <SalesTaxTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}

function MetricCard({ label, value, color = '#8B5CF6' }) {
  return (
    <Card style={{ textAlign: 'center', padding: '1.25rem' }}>
      <p style={{ color: '#A0AEC0', fontSize: '0.85rem', marginBottom: '0.4rem' }}>{label}</p>
      <p style={{ fontSize: '1.8rem', fontWeight: 'bold', color }}>{value}</p>
    </Card>
  );
}

function AffiliatesTab({ onAction }) {
  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState({});
  const [pagination, setPagination] = useState({});
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [createMsg, setCreateMsg] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState(null);

  useEffect(() => { loadAffiliates(1); }, []);

  const loadAffiliates = async (p, s) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 20 };
      if (s) params.search = s;
      const res = await api.getAffiliates(params);
      setAffiliates(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch {} finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadAffiliates(1, search);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const res = await api.createAffiliate(newUsername, newPassword);
      setNewRecoveryCodes(res.data.data?.recoveryCodes || []);
      setCreateMsg('Affiliate created successfully!');
      setNewUsername('');
      setNewPassword('');
      onAction();
      loadAffiliates(page, search);
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create affiliate.');
    } finally {
      setCreating(false);
    }
  };

  const handleSuspend = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try { await api.suspendAffiliate(id); onAction(); loadAffiliates(page, search); }
    catch { alert('Failed to suspend.'); }
    finally { setActionLoading(prev => ({ ...prev, [id]: false })); }
  };

  const handleDelete = async (id) => {
    if (!confirm('This will PERMANENTLY DELETE this affiliate. This cannot be undone. Are you sure?')) return;
    if (!confirm('FINAL CONFIRM: Click OK to delete forever.')) return;
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await api.deleteAffiliate(id);
      onAction();
      loadAffiliates(page, search);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete affiliate.');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleArchive = async (id) => {
    if (!confirm('Archive this affiliate? They will be hidden from the active list but all data is preserved.')) return;
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await api.archiveAffiliate(id);
      onAction();
      loadAffiliates(page, search);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to archive affiliate.');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleReactivate = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try { await api.reactivateAffiliate(id); onAction(); loadAffiliates(page, search); }
    catch { alert('Failed to reactivate.'); }
    finally { setActionLoading(prev => ({ ...prev, [id]: false })); }
  };

  const handleRegenerateKit = async (id) => {
    try {
      const res = await api.regenerateAffiliateKit(id);
      const codes = res.data.data?.recoveryCodes || [];
      const affiliate = affiliates.find(a => a.id === id);
      alert(`New recovery codes for ${affiliate?.username}:\n\n${codes.join('\n')}\n\nGive these to the affiliate. Old codes are invalidated.`);
    } catch { alert('Failed to regenerate kit.'); }
  };

  return (
    <>
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username..."
              style={inputStyle} />
            <Button type="submit" variant="secondary" size="sm">Search</Button>
          </form>
          <Button onClick={() => setShowCreate(!showCreate)} size="sm">
            {showCreate ? 'Cancel' : '+ New Affiliate'}
          </Button>
        </div>

        {showCreate && (
          <div style={{ backgroundColor: '#1A1A1A', border: '1px solid #3A3A3A', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem' }}>
            <h4 style={{ color: '#8B5CF6', marginTop: 0 }}>Create New Affiliate</h4>
            <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input placeholder="Username" value={newUsername} onChange={e => setNewUsername(e.target.value)} required style={inputStyle} />
              <input type="password" placeholder="Password (min 8 chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={inputStyle} />
              <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create'}</Button>
            </form>
            {createError && <p style={{ color: '#FF6B6B', marginTop: '0.5rem' }}>{createError}</p>}
            {newRecoveryCodes && (
              <div style={{ marginTop: '1rem', backgroundColor: '#1A1A1A', border: '1px solid #10B981', borderRadius: '6px', padding: '1rem' }}>
                <p style={{ color: '#10B981', fontWeight: 'bold', marginBottom: '0.5rem' }}>Recovery codes — give these to the affiliate:</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                  {newRecoveryCodes.map((code, i) => (
                    <code key={i} style={{ color: '#00CED1', backgroundColor: '#252525', padding: '0.25rem 0.5rem', borderRadius: '4px', textAlign: 'center', fontFamily: 'monospace' }}>{code}</code>
                  ))}
                </div>
                <p style={{ color: '#A0AEC0', fontSize: '0.8rem', marginTop: '0.5rem' }}>Write these down. They can only be used once.</p>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h3 style={{ color: '#8B5CF6', marginBottom: '1.5rem' }}>All Affiliates</h3>
        {loading ? <p style={{ color: '#A0AEC0' }}>Loading...</p> : affiliates.length === 0 ? (
          <p style={{ color: '#A0AEC0', textAlign: 'center' }}>No affiliates found.</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#2A2A2A', color: '#8B5CF6' }}>
                    {['Username','Status','Total Earned','Paid Out','Pending','Referrals','Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {affiliates.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #3A3A3A' }}>
                      <td style={tdStyle}>{a.username}</td>
                      <td style={tdStyle}>
                        <span style={{ color: a.status === 'active' ? '#10B981' : '#FF6B6B', fontWeight: 'bold' }}>{a.status}</span>
                      </td>
                      <td style={tdStyle}>${(a.totalEarned ?? 0).toFixed(2)}</td>
                      <td style={tdStyle}>${(a.totalPaid ?? 0).toFixed(2)}</td>
                      <td style={tdStyle}><span style={{ color: '#FFD93D' }}>${(a.pendingBalance ?? 0).toFixed(2)}</span></td>
                      <td style={tdStyle}>{a.totalReferrals ?? 0} <span style={{ color: '#10B981' }}>({a.activeReferrals ?? 0} active)</span></td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {a.status === 'active'
                            ? <Button variant="danger" size="xs" onClick={() => handleSuspend(a.id)} disabled={actionLoading[a.id]}>Suspend</Button>
                            : a.status === 'suspended'
                            ? <Button variant="secondary" size="xs" onClick={() => handleReactivate(a.id)} disabled={actionLoading[a.id]}>Reactivate</Button>
                            : null
                          }
                          <Button variant="secondary" size="xs" onClick={() => handleRegenerateKit(a.id)}>New Kit</Button>
                          <Button variant="secondary" size="xs" onClick={() => handleArchive(a.id)} disabled={actionLoading[a.id]} style={{ color: '#FFD93D' }}>Archive</Button>
                          <Button variant="danger" size="xs" onClick={() => handleDelete(a.id)} disabled={actionLoading[a.id]}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination.pages > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => { setPage(p); loadAffiliates(p, search); }}
                    style={{ padding: '0.3rem 0.7rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
                      backgroundColor: p === page ? '#8B5CF6' : '#2A2A2A', color: p === page ? '#fff' : '#A0AEC0' }}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}

function PayoutsTab({ onAction }) {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [manualAffiliate, setManualAffiliate] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualMsg, setManualMsg] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => { loadPayouts(); }, []);

  const loadPayouts = async (status) => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      const res = await api.getPayoutRequests(params);
      setPayouts(res.data.data || []);
    } catch {} finally { setLoading(false); }
  };

  const handleApprove = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await api.approvePayout(id);
      onAction();
      loadPayouts(statusFilter);
    } catch { alert('Failed to approve.'); }
    finally { setActionLoading(prev => ({ ...prev, [id]: false })); }
  };

  const handleReject = async (id) => {
    const notes = prompt('Reason for rejection (optional):') || '';
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await api.rejectPayout(id, notes);
      loadPayouts(statusFilter);
    } catch { alert('Failed to reject.'); }
    finally { setActionLoading(prev => ({ ...prev, [id]: false })); }
  };

  const handleManualPayout = async (e) => {
    e.preventDefault();
    setManualLoading(true);
    try {
      await api.logManualPayout(manualAffiliate, parseFloat(manualAmount), manualNotes);
      setManualMsg('Manual payout logged successfully.');
      setManualAffiliate('');
      setManualAmount('');
      setManualNotes('');
      onAction();
      loadPayouts(statusFilter);
    } catch (err) {
      setManualMsg(err.response?.data?.error || 'Failed to log payout.');
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <>
      <Card style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ color: '#8B5CF6', marginTop: 0 }}>Log Manual Payment</h4>
        <form onSubmit={handleManualPayout} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="Affiliate username" value={manualAffiliate} onChange={e => setManualAffiliate(e.target.value)} required style={inputStyle} />
          <span style={{ color: '#A0AEC0' }}>$</span>
          <input type="number" step="0.01" min="0.01" placeholder="0.00" value={manualAmount} onChange={e => setManualAmount(e.target.value)} required style={{ ...inputStyle, width: '100px' }} />
          <input placeholder="Notes (optional)" value={manualNotes} onChange={e => setManualNotes(e.target.value)} style={inputStyle} />
          <Button type="submit" disabled={manualLoading}>{manualLoading ? 'Logging...' : 'Log Payment'}</Button>
        </form>
        {manualMsg && <p style={{ marginTop: '0.5rem', color: manualMsg.includes('success') ? '#10B981' : '#FF6B6B' }}>{manualMsg}</p>}
      </Card>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ color: '#8B5CF6', margin: 0 }}>Payout Requests</h3>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); loadPayouts(e.target.value); }}
            style={{ ...inputStyle, width: 'auto' }}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="processed">Processed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        {loading ? <p style={{ color: '#A0AEC0' }}>Loading...</p> : payouts.length === 0 ? (
          <p style={{ color: '#A0AEC0', textAlign: 'center' }}>No payout requests.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#2A2A2A', color: '#8B5CF6' }}>
                  {['Affiliate','Amount','Requested','Status','Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {payouts.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #3A3A3A' }}>
                    <td style={tdStyle}>{p.affiliate_username}</td>
                    <td style={tdStyle}>${(p.amount ?? 0).toFixed(2)}</td>
                    <td style={tdStyle}>{new Date(p.requested_at).toLocaleDateString()}</td>
                    <td style={tdStyle}>
                      <span style={{
                        color: p.status === 'pending' ? '#FFD93D' : p.status === 'processed' ? '#10B981' : '#FF6B6B',
                        fontWeight: 'bold',
                      }}>{p.status}</span>
                    </td>
                    <td style={tdStyle}>
                      {p.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <Button variant="success" size="xs" onClick={() => handleApprove(p.id)} disabled={actionLoading[p.id]}>Approve</Button>
                          <Button variant="danger" size="xs" onClick={() => handleReject(p.id)} disabled={actionLoading[p.id]}>Reject</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function CodesTab() {
  const [codes, setCodes] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ affiliateId: '', code: '', discountCents: '0' });
  const [msg, setMsg] = useState('');
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [editDiscountVal, setEditDiscountVal] = useState('');

  useEffect(() => { loadCodes(); loadAffiliatesList(); }, []);

  const loadCodes = async () => {
    setLoading(true);
    try {
      const res = await api.getAffiliateCodes();
      setCodes(res.data.data || []);
    } catch {} finally { setLoading(false); }
  };

  const loadAffiliatesList = async () => {
    try {
      const res = await api.getAffiliates();
      setAffiliates(res.data.data || []);
    } catch {}
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.affiliateId || !form.code) { setMsg('Affiliate and code are required'); return; }
    setCreating(true); setMsg('');
    try {
      await api.createAffiliateCode(form.affiliateId, form.code, parseInt(form.discountCents) || 0);
      setMsg('Code created!');
      setForm({ affiliateId: '', code: '', discountCents: '0' });
      loadCodes();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to create code');
    } finally { setCreating(false); }
  };

  const handleUpdateDiscount = async (codeId) => {
    try {
      await api.updateAffiliateCodeDiscount(codeId, parseInt(editDiscountVal) || 0);
      setEditingDiscount(null);
      loadCodes();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update discount');
    }
  };

  return (
    <Card>
      <h3 style={{ color: '#8B5CF6', marginTop: 0, marginBottom: '1rem' }}>Affiliate Codes</h3>

      {/* Create new code */}
      <div style={{ background: '#1A1A1A', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h4 style={{ color: '#B0C4DE', marginBottom: '0.75rem', marginTop: 0 }}>Create New Code</h4>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ color: '#A0AEC0', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Affiliate</label>
            <select value={form.affiliateId} onChange={e => setForm({...form, affiliateId: e.target.value})}
              style={{ ...inputStyle, width: '180px' }}>
              <option value="">Select affiliate...</option>
              {affiliates.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: '#A0AEC0', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Code</label>
            <input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})}
              placeholder="e.g. SUMMER50" style={{ ...inputStyle, width: '140px' }} />
          </div>
          <div>
            <label style={{ color: '#A0AEC0', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Discount (cents)</label>
            <input type="number" min="0" value={form.discountCents}
              onChange={e => setForm({...form, discountCents: e.target.value})}
              placeholder="0" style={{ ...inputStyle, width: '100px' }} />
          </div>
          <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Code'}</Button>
        </form>
        {form.discountCents > 0 && <p style={{ color: '#10B981', fontSize: '0.85rem', marginTop: '0.5rem' }}>Discount: ${(form.discountCents / 100).toFixed(2)} off per purchase</p>}
        {msg && <p style={{ marginTop: '0.5rem', color: msg.includes('created') ? '#10B981' : '#FF6B6B', fontSize: '0.85rem' }}>{msg}</p>}
      </div>

      {/* Codes table */}
      {loading ? <p style={{ color: '#A0AEC0', textAlign: 'center' }}>Loading...</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #3A3A3A' }}>
                <th style={thStyle}>Code</th>
                <th style={thStyle}>Affiliate</th>
                <th style={thStyle}>Clicks</th>
                <th style={thStyle}>Discount</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center' }}>No codes yet</td></tr>
              ) : codes.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #2A2A2A' }}>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600, color: '#1E90FF' }}>{c.code}</td>
                  <td style={tdStyle}>{c.affiliate_username}</td>
                  <td style={tdStyle}>{c.clicks}</td>
                  <td style={tdStyle}>
                    {editingDiscount === c.id ? (
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <input type="number" min="0" value={editDiscountVal}
                          onChange={e => setEditDiscountVal(e.target.value)}
                          style={{ ...inputStyle, width: '70px', padding: '0.3rem' }} />
                        <Button onClick={() => handleUpdateDiscount(c.id)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>Save</Button>
                        <Button onClick={() => setEditingDiscount(null)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#3A3A3A' }}>X</Button>
                      </div>
                    ) : (
                      <span style={{ color: c.discount_cents > 0 ? '#10B981' : '#A0AEC0' }}>
                        {c.discount_cents > 0 ? `$${(c.discount_cents / 100).toFixed(2)}` : 'None'}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: c.active ? '#10B981' : '#FF6B6B' }}>{c.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td style={tdStyle}>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td style={tdStyle}>
                    <Button onClick={() => { setEditingDiscount(c.id); setEditDiscountVal(c.discount_cents || 0); }}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>Edit Discount</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function SalesTaxTab() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ state: '', startDate: '', endDate: '' });

  useEffect(() => { loadTaxData(); }, [page]);

  const loadTaxData = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filters.state) params.state = filters.state;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const [txRes, sumRes] = await Promise.all([
        api.getTaxTransactions(params),
        api.getTaxSummary(params),
      ]);
      setTransactions(txRes.data.data || []);
      setTotal(txRes.data.pagination?.total || 0);
      setSummary(sumRes.data.data || null);
    } catch (err) {
      console.error('Tax data error:', err);
    } finally { setLoading(false); }
  };

  const handleFilter = (e) => {
    e.preventDefault();
    setPage(1);
    loadTaxData();
  };

  const handleExport = async () => {
    try {
      const params = {};
      if (filters.state) params.state = filters.state;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const res = await api.exportTaxCSV(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `tax-transactions-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <Card>
      <h3 style={{ color: '#8B5CF6', marginTop: 0, marginBottom: '1rem' }}>Sales Tax Center</h3>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#1A1A1A', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
            <p style={{ color: '#A0AEC0', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Total Tax Collected</p>
            <p style={{ color: '#10B981', fontSize: '1.5rem', fontWeight: 'bold' }}>${((summary.totalTaxCents || 0) / 100).toFixed(2)}</p>
          </div>
          <div style={{ background: '#1A1A1A', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
            <p style={{ color: '#A0AEC0', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Transactions</p>
            <p style={{ color: '#1E90FF', fontSize: '1.5rem', fontWeight: 'bold' }}>{summary.totalTransactions || 0}</p>
          </div>
          <div style={{ background: '#1A1A1A', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
            <p style={{ color: '#A0AEC0', fontSize: '0.8rem', marginBottom: '0.3rem' }}>States</p>
            <p style={{ color: '#FFD93D', fontSize: '1.5rem', fontWeight: 'bold' }}>{summary.byState?.length || 0}</p>
          </div>
        </div>
      )}

      {/* State breakdown */}
      {summary?.byState && summary.byState.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: '#B0C4DE', marginBottom: '0.75rem' }}>Tax by State</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
            {summary.byState.map(s => (
              <div key={s.state} style={{ background: '#1A1A1A', borderRadius: '6px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#B0C4DE', fontWeight: 600 }}>{s.state}</span>
                <span style={{ color: '#10B981' }}>${(Number(s.total_tax_cents || 0) / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <form onSubmit={handleFilter} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ color: '#A0AEC0', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>State</label>
          <input value={filters.state} onChange={e => setFilters({...filters, state: e.target.value})} placeholder="e.g. PA" style={{...inputStyle, width: '80px'}} />
        </div>
        <div>
          <label style={{ color: '#A0AEC0', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>From</label>
          <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} style={{...inputStyle, width: '140px'}} />
        </div>
        <div>
          <label style={{ color: '#A0AEC0', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>To</label>
          <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} style={{...inputStyle, width: '140px'}} />
        </div>
        <Button type="submit" style={{ height: '36px' }}>Filter</Button>
        <Button type="button" onClick={handleExport} style={{ height: '36px', backgroundColor: '#10B981' }}>Export CSV</Button>
      </form>

      {/* Transactions table */}
      {loading ? <p style={{ color: '#A0AEC0', textAlign: 'center' }}>Loading...</p> : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #3A3A3A' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>State</th>
                  <th style={thStyle}>Zip</th>
                  <th style={thStyle}>Subtotal</th>
                  <th style={thStyle}>Tax Rate</th>
                  <th style={thStyle}>Tax</th>
                  <th style={thStyle}>Total</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center' }}>No tax transactions found</td></tr>
                ) : transactions.map((tx, i) => (
                  <tr key={tx.id || i} style={{ borderBottom: '1px solid #2A2A2A' }}>
                    <td style={tdStyle}>{new Date(tx.created_at || tx.transaction_date).toLocaleDateString()}</td>
                    <td style={tdStyle}>{tx.state || '—'}</td>
                    <td style={tdStyle}>{tx.postal_code || tx.zip || '—'}</td>
                    <td style={tdStyle}>${((tx.subtotal_cents || 0) / 100).toFixed(2)}</td>
                    <td style={tdStyle}>{tx.tax_rate ? (tx.tax_rate * 100).toFixed(2) + '%' : '—'}</td>
                    <td style={{ ...tdStyle, color: '#10B981', fontWeight: 600 }}>${((tx.tax_amount_cents || 0) / 100).toFixed(2)}</td>
                    <td style={tdStyle}>${(((tx.subtotal_cents || 0) + (tx.tax_amount_cents || 0)) / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
              <span style={{ color: '#A0AEC0', padding: '0.5rem' }}>Page {page} of {totalPages}</span>
              <Button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function SettingsTab() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({});

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.getSettings();
      const s = res.data.data;
      setSettings(s);
      setForm({
        minimumPayout: s.minimumPayout,
        commissionRateMonthly: s.commissionRateMonthly,
        commissionRateQuarterly: s.commissionRateQuarterly,
        commissionRateSemiannual: s.commissionRateSemiannual,
        commissionRateAnnual: s.commissionRateAnnual,
        holdPeriodDays: s.holdPeriodDays,
      });
    } catch {} finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings({
        minimumPayout: parseFloat(form.minimumPayout),
        commissionRateMonthly: parseFloat(form.commissionRateMonthly),
        commissionRateQuarterly: parseFloat(form.commissionRateQuarterly),
        commissionRateSemiannual: parseFloat(form.commissionRateSemiannual),
        commissionRateAnnual: parseFloat(form.commissionRateAnnual),
        holdPeriodDays: parseInt(form.holdPeriodDays),
      });
      setMsg('Settings saved successfully.');
      loadSettings();
    } catch { setMsg('Failed to save settings.'); }
    finally { setSaving(false); }
  };

  if (loading) return <p style={{ color: '#A0AEC0', textAlign: 'center' }}>Loading...</p>;

  const field = (key, label, type = 'number', step) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
      <label style={{ color: '#B0C4DE', width: '200px', flexShrink: 0 }}>{label}</label>
      <input type={type} step={step || 'any'} value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: e.target.value })}
        required style={{ ...inputStyle, width: '100px' }} />
    </div>
  );

  return (
    <Card>
      <h3 style={{ color: '#8B5CF6', marginTop: 0, marginBottom: '1.5rem' }}>System Settings</h3>
      <form onSubmit={handleSave}>
        {field('minimumPayout', 'Minimum Payout ($)', 'number')}
        {field('commissionRateMonthly', 'Commission — Monthly', 'number')}
        {field('commissionRateQuarterly', 'Commission — Quarterly', 'number')}
        {field('commissionRateSemiannual', 'Commission — Semi-Annual', 'number')}
        {field('commissionRateAnnual', 'Commission — Annual', 'number')}
        {field('holdPeriodDays', 'Hold Period (days)', 'number')}
        <Button type="submit" disabled={saving} style={{ marginTop: '0.5rem' }}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        {msg && <p style={{ marginTop: '0.75rem', color: msg.includes('success') ? '#10B981' : '#FF6B6B' }}>{msg}</p>}
      </form>
    </Card>
  );
}

const inputStyle = {
  padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #3A3A3A',
  backgroundColor: '#1A1A1A', color: '#F0F4F8', fontSize: '0.9rem', outline: 'none',
};
const thStyle = { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem' };
const tdStyle = { padding: '0.75rem 1rem', color: '#B0C4DE', fontSize: '0.9rem' };
