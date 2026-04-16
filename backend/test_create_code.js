const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn' });

async function testCreate() {
  const client = await pool.connect();
  try {
    console.log('Testing promo code creation...');
    
    // Get an affiliate ID
    const affiliateResult = await client.query('SELECT id FROM affiliates LIMIT 1');
    if (affiliateResult.rows.length === 0) {
      console.log('No affiliates found!');
      return;
    }
    const affiliateId = affiliateResult.rows[0].id;
    console.log('Using affiliate ID:', affiliateId);
    
    // Try to create a promo code
    const promoResult = await client.query(
      `INSERT INTO promo_codes (
        code, description, discount_type, discount_value, max_uses, expires_at,
        applies_to_plan_keys, affiliate_id, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), NOW())
      RETURNING *`,
      [
        'TESTCODE123',
        'Test affiliate code',
        'percent',
        0,
        null,
        null,
        null,
        affiliateId
      ]
    );
    
    console.log('Promo code created successfully!');
    console.log('Result:', promoResult.rows[0]);
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Detail:', err.detail);
  } finally {
    client.release();
    await pool.end();
  }
}

testCreate().catch(console.error);
