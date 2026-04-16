const { Pool } = require('pg');
const p = new Pool({
  user: 'ahoyvpn',
  database: 'ahoyvpn',
  password: 'ahoyvpn_secure_password',
  host: 'localhost',
  port: 5432
});
p.query('SELECT username FROM admins LIMIT 5').then(r => {
  console.log('ADMINS:' + JSON.stringify(r.rows));
  p.end();
}).catch(e => {
  console.log('ERR:' + e.message);
  p.end();
});