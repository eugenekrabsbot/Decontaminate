const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });
async function check() {
  const client = await pool.connect();
  try {
    // Get all users with real emails (real customers, not test accounts)
    const users = await client.query(`
      SELECT id, email, account_number, is_active, created_at, failed_attempts, lockout_until
      FROM users
      WHERE email IS NOT NULL
        AND email NOT LIKE '%@test.com'
        AND email NOT LIKE '%@ahoyvpn-test%'
        AND email NOT LIKE '%@ahoyvpn.internal%'
        AND email NOT LIKE '%check%'
      ORDER BY created_at DESC
    `);
    console.log('Real customer accounts:');
    users.rows.forEach(u => {
      console.log(`  ${u.email} | #${u.account_number} | active:${u.is_active} | failed:${u.failed_attempts} | lockout:${u.lockout_until}`);
    });

    // Check subscriptions for active paying customers
    const subs = await client.query(`
      SELECT s.id, s.user_id, s.status, s.plan_id, s.current_period_end, u.email, u.account_number
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      WHERE s.status IN ('active', 'trialing')
      ORDER BY s.created_at DESC
    `);
    console.log('\nActive/trialing subscriptions:');
    subs.rows.forEach(s => {
      console.log(`  ${s.email} | #${s.account_number} | ${s.status} | plan:${s.plan_id} | ends:${s.current_period_end}`);
    });
  } catch (err) { console.error(err.message); }
  finally { client.release(); await pool.end(); }
}
check();
