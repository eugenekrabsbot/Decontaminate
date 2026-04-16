const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn',
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Creating promo_codes table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        discount_type VARCHAR(20) NOT NULL,
        discount_value INTEGER NOT NULL,
        max_uses INTEGER,
        expires_at TIMESTAMP WITHOUT TIME ZONE,
        applies_to_plan_keys TEXT,
        affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    
    console.log('Creating indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_promo_codes_affiliate_id ON promo_codes(affiliate_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_promo_codes_status ON promo_codes(status)`);
    
    console.log('promo_codes table created successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
