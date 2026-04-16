// Run from within the running backend process via pm2
// This gets access to the same env as ahoyvpn-backend
process.stdout.write('ENV_CHECK: ' + (process.env.DATABASE_URL ? 'HAS_DATABASE_URL' : 'NO_DATABASE_URL') + '\n');
process.stdout.write('ENV_AFFILIATE: ' + (process.env.DATABASE_AFFILIATE_URL ? 'HAS_AFFILIATE' : 'NO_AFFILIATE') + '\n');

// Now run actual DB checks
const db = require('./src/config/database');

async function run() {
  try {
    const r = await db.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = current_schema() ORDER BY ordinal_position', ['subscriptions']);
    process.stdout.write('SUBSCRIPTIONS_COLS: ' + r.rows.map(c => c.column_name).join(',') + '\n');
  } catch(e) {
    process.stdout.write('SUBSCRIPTIONS_ERR: ' + e.message + '\n');
  }
  process.exit(0);
}

run();