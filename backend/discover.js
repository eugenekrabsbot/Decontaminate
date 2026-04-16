const { Pool } = require('pg');
const p = new Pool({ user: 'ahoyvpn', database: 'ahoyvpn', password: 'ahoyvpn_secure_password', host: 'localhost', port: 5432 });

async function run() {
  let r;
  
  // Get all tables
  r = await p.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('TABLES:' + JSON.stringify(r.rows.map(t=>t.table_name)));
  
  // Get admins table name
  const adminTables = r.rows.filter(t => t.table_name.toLowerCase().includes('admin') || t.table_name.toLowerCase().includes('user'));
  console.log('ADMIN/USER TABLES:', JSON.stringify(adminTables));
  
  // Try 'users' or 'management' tables
  for (const t of ['users', 'management', 'accounts']) {
    try {
      const result = await p.query(`SELECT username FROM ${t} LIMIT 3`);
      console.log(`${t}: ` + JSON.stringify(result.rows));
    } catch(e) {}
  }
  
  // Check affiliate related tables
  const affTables = r.rows.filter(t => t.table_name.toLowerCase().includes('affiliate') || t.table_name.toLowerCase().includes('commission') || t.table_name.toLowerCase().includes('payout'));
  console.log('AFFILIATE TABLES:', JSON.stringify(affTables));
  
  await p.end();
}

run().catch(e => { console.log('ERR:'+e.message); process.exit(1); });