const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function check() {
  const client = await pool.connect();
  try {
    // Check the null email users
    const nullUsers = await client.query(`
      SELECT u.id, u.email, u.account_number, u.is_active, u.created_at,
             s.id as sub_id, s.status as sub_status, s.plan_id, s.current_period_end
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      WHERE u.email IS NULL OR u.email NOT LIKE '%@%'
      ORDER BY s.current_period_end DESC
    `);
    console.log('Accounts with null/missing email:');
    nullUsers.rows.forEach(r => {
      console.log(`  ID:${r.id} | #${r.account_number} | active:${r.is_active} | sub:${r.sub_status} | ends:${r.current_period_end}`);
    });

    // Check transactions for these accounts
    const tx1 = await client.query(`
      SELECT u.account_number, u.email, t.amount_cents, t.status, t.created_at
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.type IN ('payment','subscription')
      ORDER BY t.created_at DESC LIMIT 10
    `);
    console.log('\nRecent payment transactions:');
    tx1.rows.forEach(r => {
      console.log(`  #${r.account_number} (${r.email}) | ${r.amount_cents/100} | ${r.status} | ${r.created_at}`);
    });
  } catch (err) { console.error(err.message); }
  finally { client.release(); await pool.end(); }
}
check();
