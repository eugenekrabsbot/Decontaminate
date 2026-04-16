const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn',
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Dropping old conflicting tables...');
    await client.query('DROP TABLE IF EXISTS referrals CASCADE');
    await client.query('DROP TABLE IF EXISTS affiliates CASCADE');
    await client.query('DROP TABLE IF EXISTS affiliate_links CASCADE');
    await client.query('DROP TABLE IF EXISTS payout_requests CASCADE');
    await client.query('DROP TABLE IF EXISTS transactions CASCADE');
    console.log('Creating new schema...');

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
    console.log('Created affiliates');

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

    await client.query(`
      CREATE TABLE payout_requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
        amount_cents INTEGER NOT NULL,
        requested_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMP WITHOUT TIME ZONE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        notes TEXT
      )
    `);
    console.log('Created payout_requests');

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

    // Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_affiliate_links_affiliate_id ON affiliate_links(affiliate_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_affiliate_links_code ON affiliate_links(code)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON referrals(affiliate_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_transactions_affiliate_id ON transactions(affiliate_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payout_requests_affiliate_id ON payout_requests(affiliate_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status)');
    console.log('Created indexes');

    // Verify
    const result = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'affiliates' ORDER BY ordinal_position");
    console.log('affiliates columns:', result.rows.map(r => r.column_name).join(', '));

    console.log('MIGRATION COMPLETE');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(e => { console.error('MIGRATION FAILED:', e.message); process.exit(1); });
