const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });

async function check() {
  const client = await pool.connect();
  try {
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'promo_codes'
      ORDER BY ordinal_position
    `);
    
    console.log('promo_codes table columns:');
    columns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
    });
  } catch (err) { console.error(err); } finally { client.release(); await pool.end(); }
}

check().catch(console.error);
