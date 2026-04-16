// check_columns.js - Run via pm2 to check schema with correct env
const db = require('./src/config/database');

async function check() {
  try {
    const result = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'subscriptions'
       ORDER BY ordinal_position`
    );
    console.log('subscriptions columns:', result.rows.map(r => r.column_name).join(', '));
    
    const usersResult = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'users'
       ORDER BY ordinal_position`
    );
    console.log('users columns:', usersResult.rows.map(r => r.column_name).join(', '));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

check();