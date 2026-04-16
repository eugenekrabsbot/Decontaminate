#!/usr/bin/env node

require('dotenv').config({ path: '.env' });
const argon2 = require('argon2');
const { Pool } = require('pg');

async function setupAdmin() {
  const username = 'BobbyHill';
  const password = 'L0veMyK1ttyCats@bb';
  
  console.log('Setting up admin user:', username);
  
  // Create a pool using the same DATABASE_URL as the app
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  
  try {
    // Hash password
    const passwordHash = await argon2.hash(password);
    
    // Check if admin already exists
    const existing = await pool.query(
      'SELECT id FROM admin_users WHERE username = $1',
      [username]
    );
    
    if (existing.rows.length > 0) {
      // Update existing admin
      await pool.query(
        'UPDATE admin_users SET password_hash = $1, is_active = true, role = $2 WHERE username = $3',
        [passwordHash, 'super_admin', username]
      );
      console.log('✓ Updated existing admin user');
    } else {
      // Insert new admin
      await pool.query(
        `INSERT INTO admin_users (username, password_hash, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, true, NOW(), NOW())`,
        [username, passwordHash, 'super_admin']
      );
      console.log('✓ Created new admin user');
    }
    
    // Verify
    const verify = await pool.query(
      'SELECT username, role, is_active FROM admin_users WHERE username = $1',
      [username]
    );
    
    if (verify.rows.length > 0) {
      console.log('\n✅ Admin user configured:');
      console.log('   Username:', verify.rows[0].username);
      console.log('   Role:', verify.rows[0].role);
      console.log('   Active:', verify.rows[0].is_active);
      console.log('\nYou can now log in at /admin.html');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up admin:', error);
    await pool.end();
    process.exit(1);
  }
}

setupAdmin();