// Diagnostic for production - run via pm2 exec
// Tries various subscription queries and reports results
const db = require('./src/config/database');

async function diagnose() {
  const results = [];
  
  try {
    // Test 1: basic query on subscriptions
    const test1 = await db.query('SELECT COUNT(*) as cnt FROM subscriptions LIMIT 1');
    results.push({ test: 'basic subscriptions query', ok: true, count: test1.rows[0].cnt });
  } catch (e) {
    results.push({ test: 'basic subscriptions query', ok: false, error: e.message });
  }
  
  try {
    // Test 2: subscriptions with user_id join
    const test2 = await db.query('SELECT COUNT(*) as cnt FROM subscriptions WHERE user_id IS NOT NULL LIMIT 1');
    results.push({ test: 'subscriptions.user_id', ok: true, count: test2.rows[0].cnt });
  } catch (e) {
    results.push({ test: 'subscriptions.user_id', ok: false, error: e.code + ': ' + e.message });
  }
  
  try {
    // Test 3: users table
    const test3 = await db.query('SELECT COUNT(*) as cnt FROM users LIMIT 1');
    results.push({ test: 'basic users query', ok: true, count: test3.rows[0].cnt });
  } catch (e) {
    results.push({ test: 'basic users query', ok: false, error: e.message });
  }
  
  console.log('DIAGNOSTIC RESULTS:');
  results.forEach(r => {
    if (r.ok) {
      console.log(`✅ ${r.test}: ${r.count} rows`);
    } else {
      console.log(`❌ ${r.test}: ${r.error}`);
    }
  });
  
  process.exit(0);
}

diagnose().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});