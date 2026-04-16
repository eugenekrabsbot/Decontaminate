const db = require('./config/database');

// Account deletion cron job
// Runs daily at 2:00 AM to delete accounts that haven't purchased within 30 days

async function deleteOldAccounts() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    
    const result = await db.query(
      `DELETE FROM users 
       WHERE registered_at < $1 
       AND (last_purchase_at IS NULL OR last_purchase_at < $1)
       AND is_active = false
       RETURNING id, account_number, registered_at`,
      [cutoffDate]
    );
    
    if (result.rows.length > 0) {
      console.log(`Deleted ${result.rows.length} old accounts:`);
      result.rows.forEach(row => {
        console.log(`  - Account ${row.account_number} (registered ${row.registered_at})`);
      });
    } else {
      console.log('No old accounts to delete');
    }
  } catch (error) {
    console.error('Account deletion error:', error);
  }
}

// Run immediately if called directly
if (require.main === module) {
  deleteOldAccounts().then(() => {
    console.log('Account deletion job completed');
    process.exit(0);
  });
}

module.exports = { deleteOldAccounts };
