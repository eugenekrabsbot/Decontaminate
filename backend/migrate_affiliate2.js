const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({
    host: 'localhost',
    user: 'ahoyvpn',
    password: 'ahoyvpn_secure_password',
    database: 'ahoyvpn',
    ssl: false
  });
  const client = await pool.connect();
  try {
    console.log('Connected to:', pool.options.database);

    // Check if affiliates table exists
    const exist = await client.query("SELECT EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'affiliates') as exists");
    console.log('affiliates exists:', exist.rows[0].exists);

    if (!exist.rows[0].exists) {
      console.log('Creating affiliates table...');
      await client.query(`
        CREATE TABLE affiliates (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          recovery_codes_hash TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
          suspended_at TIMESTAMP WITHOUT TIME ZONE
        )
      `);
      console.log('Created affiliates table');
    } else {
      // Check columns
      const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'affiliates' ORDER BY ordinal_position");
      console.log('Existing affiliates columns:', cols.rows.map(r => r.column_name).join(', '));
    }

    // Check affiliate_links
    const alExist = await client.query("SELECT EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'affiliate_links') as exists");
    console.log('affiliate_links exists:', alExist.rows[0].exists);

    if (!alExist.rows[0].exists) {
      await client.query(`
        CREATE TABLE affiliate_links (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
          code VARCHAR(20) UNIQUE NOT NULL,
          url VARCHAR(500),
          clicks INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
          active BOOLEAN NOT NULL DEFAULT true
        )
      `);
      console.log('Created affiliate_links');
    }

    // Check referrals
    const refExist = await client.query("SELECT EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'referrals') as exists");
    console.log('referrals exists:', refExist.rows[0].exists);

    if (!refExist.rows[0].exists) {
      await client.query(`
        CREATE TABLE referrals (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
          customer_hash VARCHAR(100),
          plan VARCHAR(50) NOT NULL,
          amount_cents INTEGER NOT NULL,
          transaction_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          renewal_parent_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
          referral_link_id UUID REFERENCES affiliate_links(id) ON DELETE SET NULL,
          created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      console.log('Created referrals');
    }

    // Check transactions
    const txExist = await client.query("SELECT EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'transactions') as exists");
    console.log('transactions exists:', txExist.rows[0].exists);

    if (!txExist.rows[0].exists) {
      await client.query(`
        CREATE TABLE transactions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL,
          amount_cents INTEGER NOT NULL,
          description VARCHAR(255),
          created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
          paid_out_at TIMESTAMP WITHOUT TIME ZONE,
          payout_request_id UUID REFERENCES payout_requests(id) ON DELETE SET NULL
        )
      `);
      console.log('Created transactions');
    }

    // Check payout_requests
    const prExist = await client.query("SELECT EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'payout_requests') as exists");
    console.log('payout_requests exists:', prExist.rows[0].exists);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_affiliate_links_affiliate_id ON affiliate_links(affiliate_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_affiliate_links_code ON affiliate_links(code)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON referrals(affiliate_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_transactions_affiliate_id ON transactions(affiliate_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payout_requests_affiliate_id ON payout_requests(affiliate_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status)');
    console.log('Indexes created');

    // Final verification
    const final = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'affiliates' ORDER BY ordinal_position");
    console.log('Final affiliates columns:', final.rows.map(r => r.column_name).join(', '));

    console.log('MIGRATION COMPLETE');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(e => { console.error('MIGRATION FAILED:', e.message, e.stack); process.exit(1); });
