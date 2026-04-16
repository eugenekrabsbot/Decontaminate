const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function main() {
  const c = await p.connect();
  try {
    const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'affiliates' ORDER BY ordinal_position");
    console.log('affiliates columns:', r.rows.map(x => x.column_name).join(', '));
    const r2 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'referrals' ORDER BY ordinal_position");
    console.log('referrals columns:', r2.rows.map(x => x.column_name).join(', '));
    const r3 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position");
    console.log('transactions columns:', r3.rows.map(x => x.column_name).join(', '));
  } finally { c.release(); }
  await p.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
