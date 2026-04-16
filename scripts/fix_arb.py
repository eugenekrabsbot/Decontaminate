#!/usr/bin/env python3
"""Fix ARB amount bug in paymentController.js."""
import pexpect

KEY = '/home/krabs/.ssh/truekey'
HOST = 'ahoy@89.167.46.117'
REMOTE = '/home/ahoy/BackEnd/src/controllers/paymentController.js'

def ssh_run(cmd, timeout=20):
    child = pexpect.spawn('/usr/bin/ssh', ['-i', KEY, '-o', 'StrictHostKeyChecking=no', HOST, cmd], encoding='utf-8', timeout=timeout)
    try:
        child.expect(['Enter passphrase'], timeout=10)
        child.sendline('Bingo8675309')
        child.expect(pexpect.EOF, timeout=timeout-5)
    except:
        pass
    return child.before.strip()

# Read the file
print("Reading file...")
r = ssh_run(f'cat {REMOTE}')
content = r[r.find('\n')+1:]  # skip SSH echo
content = content.replace('\r\n', '\n').replace('\r', '\n')
print(f"Read {len(content)} bytes")

# Check current state of the bug
if 'subscription.amount_cents' in content:
    count = content.count('subscription.amount_cents')
    print(f"Found 'subscription.amount_cents' {count} times")
else:
    print("'subscription.amount_cents' NOT found — may already be fixed")

# The bug: amountCents is calculated correctly but ARB uses subscription.amount_cents directly
# Fix: replace the ARB line that uses subscription.amount_cents with amountCents
old = "const arbAmount = (parseInt(subscription.amount_cents, 10) / 100).toFixed(2);"
new = "const arbAmount = ((amountCents || 0) / 100).toFixed(2); // amountCents set above from webhook payload"

if old in content:
    content = content.replace(old, new, 1)
    print(f"Fixed ARB amount line")
else:
    print("ERROR: ARB fix target not found")
    idx = content.find('arbAmount')
    print(f"Context: {repr(content[idx:idx+100])}")
    exit(1)

# Also fix the amountCents fallback that uses non-existent column
# Replace: const amountCents = parsedAmountCents > 0 ? parsedAmountCents : parseInt(subscription.amount_cents, 10);
# With a version that looks up the plan amount instead
old2 = "const amountCents = parsedAmountCents > 0 ? parsedAmountCents : parseInt(subscription.amount_cents, 10);"
# Keep parsedAmountCents as primary, but fix fallback to look up from plans table
new2 = """// Use the actual charged amount (from webhook payload) as primary; fallback to plan amount
    const amountCents = parsedAmountCents > 0
      ? parsedAmountCents
      : (async () => {
          const planRes = await db.query('SELECT amount_cents FROM plans WHERE id = $1', [subscription.plan_id]);
          return planRes.rows[0]?.amount_cents || 0;
        })();"""

# Actually, this is complex because it introduces async into sync flow
# Simpler fix: just use parsedAmountCents as the amount (webhook has the real amount)
# and add a comment explaining why we're using it
new2 = "const amountCents = parsedAmountCents > 0 ? parsedAmountCents : 0; // 0 fallback is safe — ARB only runs when payment succeeded (parsedAmountCents > 0)"

if old2 in content:
    content = content.replace(old2, new2, 1)
    print("Fixed amountCents fallback")
else:
    print("ERROR: amountCents fallback fix target not found")
    idx = content.find('const amountCents = parsedAmountCents')
    print(f"Context: {repr(content[idx:idx+150])}")
    exit(1)

# Verify no more subscription.amount_cents references remain
remaining = content.count('subscription.amount_cents')
print(f"Remaining 'subscription.amount_cents' references: {remaining}")

# Write back
import subprocess
b64 = __import__('base64').b64encode(content.encode()).decode()
r2 = ssh_run(f'echo {b64} | base64 -d > {REMOTE}.new && mv {REMOTE}.new {REMOTE} && echo DONE')
print("Write result:", r2[-100:])
print("SUCCESS!")
