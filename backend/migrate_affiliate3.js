const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({ host: 'localhost', user: 'ahoyvpn', password: 'ahoyvpn_secure_password', database: 'ahoyvpn', ssl: false });
  const client = await pool.connect();
  try {
    console.log('Verifying affiliates table...');
    const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'affiliates' ORDER BY ordinal_position");
    console.log('affiliates columns:', cols.rows.map(r => r.column_name).join(', '));
    
    // Check referrals table
    const refCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'referrals' ORDER BY ordinal_position");
    console.log('referrals columns:', refCols.rows.map(r => r.column_name).join(', '));
    
    // Check if referral_link_id column exists in referrals
    const hasLinkCol = refCols.rows.find(r => r.column_name === 'referral_link_id');
    if (!hasLinkCol) {
      console.log('Adding referral_link_id to referrals...');
      await client.query('ALTER TABLE referrals ADD COLUMN referral_link_id UUID');
    }

    console.log('Creating indexes (skipping ones we cannot create)...');
    
    // Try to create indexes we can - skip affiliate_links indexes since we don't own it
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON referrals(affiliate_id)',
      'CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status)',
      'CREATE INDEX IF NOT EXISTS idx_payout_requests_affiliate_id ON payout_requests(affiliate_id)',
      'CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status)'
    ];
    
    for (const idx of indexes) {
      try {
        await client.query(idx);
        console.log('OK:', idx.substring(0, 50));
      } catch(e) {
        console.log('SKIP:', idx.substring(0, 50), '-', e.message.split('\n')[0]);
      }
    }

    console.log('MIGRATION COMPLETE');
    const finalCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'affiliates' ORDER BY ordinal_position");
    console.log('Final affiliates:', finalCols.rows.map(r => r.column_name).join(', '));
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
