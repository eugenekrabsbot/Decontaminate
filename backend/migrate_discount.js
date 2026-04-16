require('dotenv').config();
const db = require('./src/config/database');

async function main() {
  try {
    // Check if column already exists
    const check = await db.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'affiliate_links' AND column_name = 'discount_cents'
    `);
    
    if (check.rows.length > 0) {
      console.log('discount_cents column already exists');
      process.exit(0);
    }
    
    // Try ALTER TABLE directly
    try {
      await db.query('ALTER TABLE affiliate_links ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0');
      console.log('Added discount_cents column via ALTER TABLE');
      process.exit(0);
    } catch (alterErr) {
      console.log('ALTER TABLE failed:', alterErr.message);
    }
    
    // Workaround: create a separate discount table
    await db.query(`
      CREATE TABLE IF NOT EXISTS affiliate_link_discounts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        affiliate_link_id UUID NOT NULL REFERENCES affiliate_links(id) ON DELETE CASCADE,
        discount_cents INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(affiliate_link_id)
      )
    `);
    console.log('Created affiliate_link_discounts table');
    
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  }
}
main();
