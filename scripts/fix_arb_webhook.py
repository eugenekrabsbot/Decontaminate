#!/usr/bin/env python3
"""Fix webhookController.js: add ARB creation + fix imports."""
import pexpect, base64

KEY = '/home/krabs/.ssh/truekey'
HOST = 'ahoy@89.167.46.117'
REMOTE = '/home/ahoy/BackEnd/src/controllers/webhookController.js'
TMP = '/tmp/webhookController_fixed.js'

def ssh_run(cmd, timeout=25):
    child = pexpect.spawn('/usr/bin/ssh',
        ['-i', KEY, '-o', 'StrictHostKeyChecking=no', '-o', 'ControlMaster=no', HOST, cmd],
        encoding='utf-8', timeout=timeout)
    try:
        child.expect(['Enter passphrase'], timeout=12)
        child.sendline('Bingo8675309')
        child.expect(pexpect.EOF, timeout=timeout-8)
    except:
        pass
    return child.before

# 1. Read the file
print("Reading webhookController.js...")
r = ssh_run(f'cat {REMOTE}')
content = r[r.find('\n')+1:].replace('\r\n', '\n').replace('\r', '\n')
print(f"Read {len(content)} bytes")

# 2. Add AuthorizeNetService import if not present
IMPORT_LINE = "const { getAuthorizeTransactionDetails, AuthorizeNetService } = require('../services/authorizeNetUtils');"
if 'AuthorizeNetService' not in content:
    # Replace the existing import line
    old_import = "const { getAuthorizeTransactionDetails } = require('../services/authorizeNetUtils');"
    if old_import in content:
        content = content.replace(old_import, IMPORT_LINE, 1)
        print("✅ Added AuthorizeNetService to import")
    else:
        # Try to find the import line
        idx = content.find("require('../services/authorizeNetUtils')")
        if idx >= 0:
            # Find the full line containing this require
            start = content.rfind('\n', 0, idx) + 1
            end = content.find('\n', idx)
            old_line = content[start:end]
            new_line = "const { getAuthorizeTransactionDetails, AuthorizeNetService } = require('../services/authorizeNetUtils');"
            content = content.replace(old_line, new_line, 1)
            print("✅ Fixed import line")
        else:
            print("⚠️ Could not find authorizeNetUtils import, adding it...")
            # Insert after first require
            first_require_end = content.find('\n', content.find('require('))
            content = content[:first_require_end+1] + "const { getAuthorizeTransactionDetails, AuthorizeNetService } = require('../services/authorizeNetUtils');\n" + content[first_require_end+1:]
else:
    print("✅ AuthorizeNetService already imported")

# 3. Add ARB creation block
INSERT_MARKER = "const vpnAccount = await createVpnAccount(subscription.user_id, subscription.account_number, planInterval);"

ARB_BLOCK = """
    // ── ARB subscription for recurring billing ─────────────────────────────────
    {
      const storedArbId = (subscription.metadata || {})[Symbol.for('arb_subscription_id')] || subscription.arb_subscription_id;
      if (!storedArbId && transactionId) {
        try {
          const svc = new AuthorizeNetService();
          // Get billing details from transaction
          const txDetails = await getAuthorizeTransactionDetails(transactionId);
          const { customerProfileId, customerPaymentProfileId } = txDetails || {};
          if (customerProfileId && customerPaymentProfileId) {
            // Get plan interval
            const meta = subscription.metadata || {};
            const planInterval = meta.plan_interval || 'month';
            const planAmountCents = parseInt(meta.plan_amount_cents, 10) || 0;
            if (!planAmountCents) {
              const pr = await db.query(
                'SELECT p.amount_cents, p.interval_unit FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.id = $1',
                [subscription.id]
              );
              planAmountCents = pr.rows[0]?.amount_cents || 0;
            }
            const arbAmount = ((planAmountCents || 0) / 100).toFixed(2);
            const startStr = new Date().toISOString().split('T')[0];
            const intervalLength = planInterval === 'year' ? 1 : (planInterval === 'quarter' ? 3 : 1);
            const intervalUnit = planInterval === 'year' ? 'months' : 'months';

            const arbResult = await svc.createArbSubscriptionFromProfile({
              amount: arbAmount,
              intervalLength,
              intervalUnit,
              startDate: startStr,
              customerProfileId,
              customerPaymentProfileId,
              subscriptionId: String(subscription.id),
              customerEmail: userEmail
            });
            if (arbResult?.subscriptionId) {
              await db.query(
                'UPDATE subscriptions SET arb_subscription_id = $1, updated_at = NOW() WHERE id = $2',
                [arbResult.subscriptionId, subscription.id]
              );
              console.log('ARB created via webhook:', arbResult.subscriptionId);
            }
          } else {
            console.warn('Cannot create ARB: missing profile IDs for transaction', transactionId);
          }
        } catch (arbErr) {
          console.error('ARB creation failed via webhook:', arbErr.message);
        }
      }
    }
"""

if INSERT_MARKER not in content:
    print("ERROR: Insert marker not found")
    idx = content.find('createVpnAccount')
    print(f"Context: {repr(content[idx:idx+200])}")
    exit(1)

content = content.replace(INSERT_MARKER, ARB_BLOCK + INSERT_MARKER, 1)
print("✅ ARB block inserted")

# 4. Verify syntax
print("Checking syntax...")
import subprocess
with open('/tmp/webhookController_check.js', 'w') as f:
    f.write(content)
result = subprocess.run(['node', '--check', '/tmp/webhookController_check.js'],
    capture_output=True, text=True, timeout=10)
if result.returncode == 0:
    print("✅ Syntax OK")
else:
    print("⚠️ Syntax warning:", result.stderr[:300])

# 5. Upload
print("Uploading...")
b64 = base64.b64encode(content.encode()).decode()
r2 = ssh_run(f'echo {b64} | base64 -d > {TMP} && echo OK', timeout=60)
print("Upload:", r2.strip()[-100:])

# 6. Move to final location
r3 = ssh_run(f'mv {TMP} {REMOTE} && echo DONE', timeout=20)
print("Move:", r3.strip()[-100:])
print("✅ Done!")
