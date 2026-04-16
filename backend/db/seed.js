require('dotenv').config();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../src/config/database');

const SALT_ROUNDS = 12;

function generateAccountNumber() {
  return String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
}

async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

async function seed() {
  console.log('🌱 Seeding database with PCI DSS compliant passwords...');
  try {
    await db.query('BEGIN');

    // 1. Create admin user in admin_users table (or update if exists)
    console.log('Creating admin user...');
    const adminUsername = 'admin';
    const adminPassword = 'Admin123!'; // PCI DSS compliant password
    const adminPasswordHash = await hashPassword(adminPassword);
    
    // Check if admin already exists
    const existingAdmin = await db.query(
      `SELECT id FROM admin_users WHERE username = $1`,
      [adminUsername]
    );
    
    let adminId;
    if (existingAdmin.rows.length > 0) {
      // Update existing admin password
      adminId = existingAdmin.rows[0].id;
      await db.query(
        `UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [adminPasswordHash, adminId]
      );
      console.log(`✓ Admin updated: ${adminUsername} / ${adminPassword}`);
    } else {
      // Create new admin
      const adminResult = await db.query(
        `INSERT INTO admin_users (id, username, password_hash, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, 'super_admin', true, NOW(), NOW())
         RETURNING id, username`,
        [uuidv4(), adminUsername, adminPasswordHash]
      );
      adminId = adminResult.rows[0].id;
      console.log(`✓ Admin created: ${adminUsername} / ${adminPassword}`);
    }

    // 2. Create affiliate user with user-set password (or update if exists)
    console.log('Creating affiliate user...');
    const affiliateEmail = 'affiliate@ahoyvpn.net';
    const affiliatePassword = 'Affiliate123!'; // PCI DSS compliant password
    const affiliatePasswordHash = await hashPassword(affiliatePassword);
    
    // Check if affiliate already exists
    const existingAffiliate = await db.query(
      `SELECT id, account_number FROM users WHERE email = $1`,
      [affiliateEmail]
    );
    
    let affiliateId, affiliateAccountNumber;
    if (existingAffiliate.rows.length > 0) {
      // Update existing affiliate password
      affiliateId = existingAffiliate.rows[0].id;
      affiliateAccountNumber = existingAffiliate.rows[0].account_number;
      await db.query(
        `UPDATE users SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [affiliatePasswordHash, affiliateId]
      );
      console.log(`✓ Affiliate updated: ${affiliateAccountNumber} / ${affiliatePassword}`);
    } else {
      // Create new affiliate
      affiliateAccountNumber = generateAccountNumber();
      const affiliateResult = await db.query(
        `INSERT INTO users (id, email, password_hash, account_number, numeric_password_hash, 
                            is_numeric_account, is_active, is_affiliate, email_verified, 
                            created_at, updated_at, password_changed_at, force_password_change)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW(), false)
         RETURNING id, account_number`,
        [uuidv4(), affiliateEmail, affiliatePasswordHash, affiliateAccountNumber, 
         affiliatePasswordHash, false, true, true, true]
      );
      affiliateId = affiliateResult.rows[0].id;
      console.log(`✓ Affiliate created: ${affiliateAccountNumber} / ${affiliatePassword}`);
    }

    // 3. Create affiliate record (or update if exists)
    const existingAffiliateRecord = await db.query(
      `SELECT id FROM affiliates WHERE user_id = $1`,
      [affiliateId]
    );
    
    if (existingAffiliateRecord.rows.length === 0) {
      await db.query(
        `INSERT INTO affiliates (id, user_id, code, commission_rate, is_approved, created_at)
         VALUES ($1, $2, $3, 0.25, true, NOW())`,
        [uuidv4(), affiliateId, 'AFF' + affiliateAccountNumber]
      );
    }

    // 4. Create demo customers with numeric accounts (force password change on first login)
    console.log('Creating demo customers...');
    for (let i = 1; i <= 3; i++) {
      const customerEmail = `customer${i}@ahoyvpn.net`;
      const password = 'Customer123!'; // PCI DSS compliant password
      const passwordHash = await hashPassword(password);
      
      // Check if customer already exists
      const existingCustomer = await db.query(
        `SELECT id, account_number FROM users WHERE email = $1`,
        [customerEmail]
      );
      
      let customerId, accountNumber;
      if (existingCustomer.rows.length > 0) {
        // Update existing customer password
        customerId = existingCustomer.rows[0].id;
        accountNumber = existingCustomer.rows[0].account_number;
        await db.query(
          `UPDATE users SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW() WHERE id = $2`,
          [passwordHash, customerId]
        );
        console.log(`✓ Customer ${i} updated: ${accountNumber} / ${password} (requires password change)`);
      } else {
        // Create new customer
        accountNumber = generateAccountNumber();
        const customerResult = await db.query(
          `INSERT INTO users (id, email, password_hash, account_number, numeric_password_hash, 
                              is_numeric_account, is_active, email_verified, created_at, updated_at,
                              password_changed_at, force_password_change)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW(), true)
           RETURNING id, account_number`,
          [uuidv4(), customerEmail, passwordHash, accountNumber, passwordHash, true, true, true]
        );
        customerId = customerResult.rows[0].id;
        console.log(`✓ Customer ${i} created: ${accountNumber} / ${password} (requires password change)`);
      }

      // Create subscription
      await db.query(
        `INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '30 days', NOW(), NOW())`,
        [uuidv4(), customerId, '9e091318-bd9e-4ebd-bb75-0e4bdb1bd905']
      );

      // Create recovery kit (or update if exists)
      const existingKit = await db.query(
        `SELECT id FROM recovery_kits WHERE user_id = $1 AND is_active = true`,
        [customerId]
      );
      
      if (existingKit.rows.length === 0) {
        const kitCode = generateAccountNumber() + generateAccountNumber().substring(0, 4);
        const kitHash = await bcrypt.hash(kitCode, SALT_ROUNDS);
        await db.query(
          `INSERT INTO recovery_kits (user_id, kit_hash, is_active, created_at)
           VALUES ($1, $2, true, NOW())`,
          [customerId, kitHash]
        );
      }
    }

    await db.query('COMMIT');
    console.log('✅ Database seeded successfully with PCI DSS compliant passwords!');
    console.log('\nLogin credentials:');
    console.log('Admin: admin / Admin123!');
    console.log('Affiliate: affiliate@ahoyvpn.net / Affiliate123!');
    console.log('Customers: customer1@ahoyvpn.net, customer2@ahoyvpn.net, customer3@ahoyvpn.net');
    console.log('Note: Customers must change password on first login (PCI DSS requirement)');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
