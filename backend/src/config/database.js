const { Pool } = require('pg');

// Primary pool for normal app operations
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Affiliate pool for affiliate dashboard queries
const affiliatePool = new Pool({
  connectionString: process.env.DATABASE_AFFILIATE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Admin pool for admin operations (full control)
const adminPool = new Pool({
  connectionString: process.env.DATABASE_ADMIN_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Event handlers for each pool
const setupPool = (pool, label) => {
  pool.on('connect', () => {
    console.log(`📦 Connected to PostgreSQL as ${label}`);
  });
  pool.on('error', (err) => {
    console.error(`❌ PostgreSQL ${label} pool error:`, err);
  });
};

setupPool(pool, 'ahoyvpn_app');
setupPool(affiliatePool, 'ahoyvpn_affiliate');
setupPool(adminPool, 'ahoyvpn_admin');

module.exports = {
  // Main pool for general endpoints
  query: (text, params) => pool.query(text, params),
  pool,
  
  // Affiliate pool for affiliate endpoints
  affiliateQuery: (text, params) => affiliatePool.query(text, params),
  affiliatePool,
  
  // Admin pool for admin endpoints
  adminQuery: (text, params) => adminPool.query(text, params),
  adminPool,
};