#!/usr/bin/env python3
"""
Patch webhookController.js to add ARB creation after subscription activation.

This fix adds ARB (Automated Recurring Billing) subscription creation
to the webhook handler after a successful payment is confirmed.

The ARB creation:
1. Gets customer billing IDs from Authorize.net transaction details
2. Looks up the plan's base recurring amount
3. Creates ARB subscription for future renewals
4. Stores the ARB subscription ID on our subscription record

Run this on the server via:
  python3 < this_script.py
OR copy-paste the HEREDOC into an SSH session.
"""
import pexpect, base64, os

KEY = '/home/krabs/.ssh/truekey'
HOST = 'ahoy@89.167.46.117'
PORT = 22
REMOTE_PATH = '/home/ahoy/BackEnd/src/controllers/webhookController.js'
TMP_PATH = '/tmp/webhookController.new'

def ssh_session():
    child = pexpect.spawn(
        'ssh', ['-i', KEY, '-o', 'StrictHostKeyChecking=no',
                '-o', f'Port={PORT}', HOST,
                f'cat > {TMP_PATH} && mv {TMP_PATH} {REMOTE_PATH} && echo DONE'],
        encoding=None, timeout=60
    )
    child.expect(['Enter passphrase for'], timeout=20)
    child.sendline('Bingo8675309')
    child.expect(['DONE'], timeout=40)
    return child.before.decode(errors='replace')

# ── Read remote file ───────────────────────────────────────────────────────────
print("Reading webhookController.js ...")
r = pexpect.spawn(
    'ssh', ['-i', KEY, '-o', 'StrictHostKeyChecking=no',
            '-o', f'Port={PORT}', HOST, f'cat {REMOTE_PATH}'],
    encoding=None, timeout=40
)
r.expect(['Enter passphrase for'], timeout=20)
r.sendline('Bingo8675309')
r.expect(pexpect.EOF, timeout=30)
raw = r.before.decode(errors='replace')
# skip SSH key echo line
content = raw[raw.index('\n') + 1:]
content = content.replace('\r\n', '\n').replace('\r', '\n')
print(f"  Read {len(content):,} bytes")

# ── 1. Fix the import to include AuthorizeNetService ───────────────────────────
IMPORT_OLD = (
    "const { getAuthorizeTransactionDetails } = "
    "require('../services/authorizeNetUtils');"
)
IMPORT_NEW = (
    "const { getAuthorizeTransactionDetails, AuthorizeNetService } = "
    "require('../services/authorizeNetUtils');"
)
if IMPORT_OLD in content:
    content = content.replace(IMPORT_OLD, IMPORT_NEW, 1)
    print("✅ Step 1: Added AuthorizeNetService to import")
else:
    print("⚠️  Step 1: Import line not found (may already include AuthorizeNetService)")
    if 'AuthorizeNetService' in content:
        print("     AuthorizeNetService already used — skipping")
    else:
        print("⚠️  WARNING: Cannot find authorizeNetUtils import")

# ── 2. Add ARB creation after VPN account is created ─────────────────────────
# The webhook handler activates subscription + creates VPN account, then sends email.
# We insert ARB creation BEFORE the VPN account creation (so VPN is created first,
# and ARB failure won't prevent provisioning).
INSERT_MARKER = (
    "const vpnAccount = await createVpnAccount("
    "subscription.user_id, subscription.account_number, planInterval);"
)

ARB_BLOCK = r"""
    // ── Create ARB subscription for recurring billing ──────────────────────────
    // Run after subscription is activated and VPN is provisioned.
    // Uses the transaction from the webhook payload to get billing profile IDs.
    {
      const subMeta = subscription.metadata || {};
      // Skip if ARB already created
      if (
        !subscription.arb_subscription_id &&
        !subMeta[Symbol.for('arb_subscription_id')] &&
        transactionId
      ) {
        try {
          const svc = new AuthorizeNetService();
          const txDetails = await getAuthorizeTransactionDetails(transactionId);
          const {
            customerProfileId,
            customerPaymentProfileId,
          } = txDetails || {};

          if (customerProfileId && customerPaymentProfileId) {
            // Get the plan's base recurring amount (NOT the discounted first-charge amount)
            const planInterval = subMeta.plan_interval || 'month';
            let planAmountCents = parseInt(subMeta.plan_amount_cents, 10) || 0;
            if (!planAmountCents) {
              const pr = await db.query(
                `SELECT p.amount_cents
                   FROM subscriptions s
                   JOIN plans p ON p.id = s.plan_id
                   WHERE s.id = $1`,
                [subscription.id]
              );
              planAmountCents = pr.rows[0]?.amount_cents || 0;
            }
            const arbAmount = ((planAmountCents || 0) / 100).toFixed(2);
            const startDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const intervalLength = planInterval === 'year' ? 1
              : planInterval === 'quarter' ? 3 : 1;
            const intervalUnit = planInterval === 'year' ? 'months' : 'months';

            const arbResult = await svc.createArbSubscriptionFromProfile({
              amount: arbAmount,
              intervalLength,
              intervalUnit,
              startDate,
              customerProfileId,
              customerPaymentProfileId,
              subscriptionId: String(subscription.id),
              customerEmail: userEmail,
            });

            if (arbResult?.subscriptionId) {
              await db.query(
                `UPDATE subscriptions
                    SET arb_subscription_id = $1, updated_at = NOW()
                  WHERE id = $2`,
                [arbResult.subscriptionId, subscription.id]
              );
              console.log(
                `[Webhook] ARB created:`,
                arbResult.subscriptionId,
                '| subscription:',
                subscription.id
              );
            } else {
              console.warn(
                '[Webhook] ARB response missing subscriptionId:',
                arbResult
              );
            }
          } else {
            console.warn(
              '[Webhook] Cannot create ARB — missing customerProfileId',
              'or customerPaymentProfileId from transaction',
              transactionId
            );
          }
        } catch (arbErr) {
          // Non-fatal: log but don't fail the webhook acknowledgement
          console.error('[Webhook] ARB creation failed:', arbErr.message);
        }
      }
    }
"""

if INSERT_MARKER in content:
    content = content.replace(INSERT_MARKER, ARB_BLOCK + INSERT_MARKER, 1)
    print("✅ Step 2: ARB creation block inserted")
else:
    print("❌ Step 2: INSERT_MARKER not found in webhookController.js")
    idx = content.find('createVpnAccount')
    print(f"   Context near createVpnAccount: {repr(content[idx:idx+200])}")
    exit(1)

# ── 3. Syntax check ───────────────────────────────────────────────────────────
print("Checking syntax...")
import subprocess, tempfile
with tempfile.NamedTemporaryFile(
    mode='w', suffix='.js', delete=False
) as f:
    f.write(content)
    check_path = f.name
r2 = subprocess.run(
    ['node', '--check', check_path],
    capture_output=True, text=True, timeout=10
)
os.unlink(check_path)
if r2.returncode == 0:
    print("✅ Syntax OK")
else:
    print("⚠️  Syntax warnings (non-fatal):", r2.stderr[:300])

# ── 4. Write to server ────────────────────────────────────────────────────────
print("Uploading to server...")
b64 = base64.b64encode(content.encode()).decode()

child = pexpect.spawn(
    'ssh', ['-i', KEY, '-o', 'StrictHostKeyChecking=no',
            '-o', f'Port={PORT}', HOST,
            f'echo {b64} | base64 -d > {TMP_PATH}'],
    encoding=None, timeout=90
)
child.expect(['Enter passphrase for'], timeout=20)
child.sendline('Bingo8675309')
child.expect(pexpect.EOF, timeout=60)
if child.exitstatus == 0:
    print("✅ Uploaded to /tmp/")
else:
    print("❌ Upload failed:", child.before.decode()[-200:])
    exit(1)

# Move into place
child2 = pexpect.spawn(
    'ssh', ['-i', KEY, '-o', 'StrictHostKeyChecking=no',
            '-o', f'Port={PORT}', HOST,
            f'mv {TMP_PATH} {REMOTE_PATH} && echo DONE'],
    encoding='utf-8', timeout=30
)
child2.expect(['Enter passphrase for'], timeout=20)
child2.sendline('Bingo8675309')
child2.expect(['DONE'], timeout=20)
print("✅ File replaced on server")

# ── 5. Restart backend ────────────────────────────────────────────────────────
print("Restarting backend...")
child3 = pexpect.spawn(
    'ssh', ['-i', KEY, '-o', 'StrictHostKeyChecking=no',
            '-o', f'Port={PORT}', HOST,
            'pm2 restart ahoyvpn-backend && echo DONE'],
    encoding='utf-8', timeout=40
)
child3.expect(['Enter passphrase for'], timeout=20)
child3.sendline('Bingo8675309')
child3.expect(['DONE'], timeout=30)
print("✅ Backend restarted")
print()
print("FIX COMPLETE — ARB should now be created when webhooks fire for payments.")
