#!/usr/bin/env python3
"""Patch paymentController.js to add discountCents to pricing response."""
import pexpect, base64, sys

key = '/home/krabs/.ssh/truekey'
host = 'ahoy@89.167.46.117'
local_path = '/home/krabs/.openclaw/workspace/scripts/paymentController.js.patch'
remote_path = '/home/ahoy/BackEnd/src/controllers/paymentController.js'

def ssh_run(cmd, timeout=20):
    child = pexpect.spawn('/usr/bin/ssh', ['-i', key, '-o', 'StrictHostKeyChecking=no', host, cmd], encoding='utf-8', timeout=timeout)
    try:
        child.expect(['Enter passphrase'], timeout=10)
        child.sendline('Bingo8675309')
        child.expect(pexpect.EOF, timeout=timeout-5)
    except:
        pass
    return child.before

# Read file
print("Reading file...")
r = ssh_run(f'cat {remote_path}', timeout=30)
content = r.strip()
# Skip the first line (SSH echo)
content = content[content.find('\n')+1:].lstrip('\n')
print(f"Read {len(content)} bytes")

# Fix 1: crypto flow - add discountCents and discountedBaseCents
old1 = """        pricing: {
          currency: plan.currency || 'USD',
          baseAmountCents: plan.amount_cents,
          taxAmountCents,
          totalAmountCents
        }
      });
    } else if (paymentMethod === 'card'"""

new1 = """        pricing: {
          currency: plan.currency || 'USD',
          baseAmountCents: plan.amount_cents,
          discountCents: perLinkDiscount || 0,
          discountedBaseCents,
          taxAmountCents,
          totalAmountCents
        }
      });
    } else if (paymentMethod === 'card'"""

# Fix 2: card redirect flow
old2 = """        pricing: {
          currency: plan.currency || 'USD',
          baseAmountCents: plan.amount_cents,
          taxAmountCents,
          totalAmountCents
          }
        });
      }

      // Legacy direct-card"""

new2 = """        pricing: {
          currency: plan.currency || 'USD',
          baseAmountCents: plan.amount_cents,
          discountCents: perLinkDiscount || 0,
          discountedBaseCents,
          taxAmountCents,
          totalAmountCents
          }
        });
      }

      // Legacy direct-card"""

c1 = content.count(old1)
c2 = content.count(old2)
print(f"Fix target 1 found {c1} times, target 2 found {c2} times")

if c1 == 0 or c2 == 0:
    print("ERROR: could not find target blocks")
    sys.exit(1)

content = content.replace(old1, new1, 1)
content = content.replace(old2, new2, 1)
print("Replacements done")

# Verify
c1n = content.count(new1)
c2n = content.count(new2)
print(f"New content: fix1={c1n}, fix2={c2n}")

# Write via base64
b64 = base64.b64encode(content.encode()).decode()
print(f"Encoded: {len(b64)} bytes")

# Write to temp file then move
write_cmd = f'echo {b64} | base64 -d > {remote_path}.new'
child2 = pexpect.spawn('/usr/bin/ssh', ['-i', key, '-o', 'StrictHostKeyChecking=no', host, write_cmd], encoding='utf-8', timeout=40)
try:
    child2.expect(['Enter passphrase'], timeout=10)
    child2.sendline('Bingo8675309')
    child2.expect(pexpect.EOF, timeout=30)
except Exception as e:
    print(f"Write error: {e}")

move_cmd = f'mv {remote_path}.new {remote_path} && echo DONE'
child3 = pexpect.spawn('/usr/bin/ssh', ['-i', key, '-o', 'StrictHostKeyChecking=no', host, move_cmd], encoding='utf-8', timeout=15)
try:
    child3.expect(['Enter passphrase'], timeout=10)
    child3.sendline('Bingo8675309')
    child3.expect(['DONE'], timeout=10)
except Exception as e:
    print(f"Move error: {e}")

print("Done!")
