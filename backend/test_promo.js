const PromoService = require('./src/services/promoService');
const promoService = new PromoService();

async function test() {
  console.log('Testing promo codes...');
  
  // Test invalid code
  console.log('\n1. Invalid code:');
  const invalid = await promoService.validatePromoCode('INVALID', 'monthly', 550);
  console.log(invalid);
  
  // Test JIMBO ($0.50 off)
  console.log('\n2. JIMBO (fixed $0.50 off) for monthly plan ($5.50):');
  const jimbo = await promoService.validatePromoCode('JIMBO', 'monthly', 550);
  console.log(jimbo);
  if (jimbo.valid) {
    console.log(`Discount: $${(jimbo.discountCents / 100).toFixed(2)}`);
  }
  
  // Test FREEWILLY (100% off first month, single-use)
  console.log('\n3. FREEWILLY (100% off) for monthly plan ($5.50):');
  const freewilly = await promoService.validatePromoCode('FREEWILLY', 'monthly', 550);
  console.log(freewilly);
  if (freewilly.valid) {
    console.log(`Discount: $${(freewilly.discountCents / 100).toFixed(2)}`);
  }
  
  // Test FREEWILLY usage limit after marking as used (simulate)
  console.log('\n4. Checking FREEWILLY usage limit (max_uses = 1):');
  const db = require('./src/config/database');
  const res = await db.query('SELECT uses_count, max_uses FROM promo_codes WHERE code = $1', ['FREEWILLY']);
  console.log('Current uses_count:', res.rows[0].uses_count, 'max_uses:', res.rows[0].max_uses);
  
  // Close DB pool
  await db.end();
  console.log('\nTest completed.');
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});