require('dotenv').config();
const argon2 = require('argon2');
const db = require('./src/config/database');

async function main() {
  try {
    const hash = await argon2.hash('AdminPassword123!');
    console.log('Generated hash:', hash.substring(0, 30) + '...');
    
    const result = await db.query(
      'UPDATE admin_users SET password_hash = $1 WHERE username = $2 RETURNING username',
      [hash, 'admin']
    );
    console.log('Updated:', result.rows.length, 'rows');
    
    // Verify it works
    const check = await db.query('SELECT password_hash FROM admin_users WHERE username = $1', ['admin']);
    const isValid = await argon2.verify(check.rows[0].password_hash, 'AdminPassword123!');
    console.log('Verification:', isValid ? 'SUCCESS' : 'FAILED');
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}
main();
