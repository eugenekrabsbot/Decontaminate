const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://ahoyvpn:simplepassword@localhost:5432/ahoyvpn?sslmode=disable',
  ssl: false,
});

(async () => {
  try {
    const client = await pool.connect();
    console.log('Connected!');
    const res = await client.query('SELECT 1 as test');
    console.log('Result:', res.rows[0]);
    client.release();
    pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Full error:', err);
  }
})();
