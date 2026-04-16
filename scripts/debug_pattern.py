#!/usr/bin/env python3
"""Patch paymentController.js - improved pattern matching."""
import pexpect, base64

key = '/home/krabs/.ssh/truekey'
host = 'ahoy@89.167.46.117'
remote_path = '/home/ahoy/BackEnd/src/controllers/paymentController.js'
tmp_path = remote_path + '.tmp'

def ssh_run(cmd, timeout=20):
    child = pexpect.spawn('/usr/bin/ssh', ['-i', key, '-o', 'StrictHostKeyChecking=no', host, cmd], encoding='utf-8', timeout=timeout)
    try:
        child.expect(['Enter passphrase'], timeout=10)
        child.sendline('Bingo8675309')
        child.expect(pexpect.EOF, timeout=timeout-5)
    except:
        pass
    return child.before

# Read the file
r = ssh_run('cat ' + remote_path, timeout=30)
# Skip first line (SSH echo)
idx = r.find('\n')
content = r[idx+1:]
# Normalize line endings to Unix LF
content = content.replace('\r\n', '\n').replace('\r', '\n')
print(f"Read {len(content)} bytes")

# Find the two pricing blocks by searching for specific substrings
# Fix 1: crypto flow
OLD1 = "          currency: plan.currency || 'USD',\n          baseAmountCents: plan.amount_cents,\n          taxAmountCents,\n          totalAmountCents\n        }\n      });\n    } else if (paymentMethod === 'card'"
NEW1 = "          currency: plan.currency || 'USD',\n          baseAmountCents: plan.amount_cents,\n          discountCents: perLinkDiscount || 0,\n          discountedBaseCents,\n          taxAmountCents,\n          totalAmountCents\n        }\n      });\n    } else if (paymentMethod === 'card'"

# Fix 2: card redirect flow
OLD2 = "            currency: plan.currency || 'USD',\n            baseAmountCents: plan.amount_cents,\n            taxAmountCents,\n            totalAmountCents\n          }\n        });\n      }"
NEW2 = "            currency: plan.currency || 'USD',\n            baseAmountCents: plan.amount_cents,\n            discountCents: perLinkDiscount || 0,\n            discountedBaseCents,\n            taxAmountCents,\n            totalAmountCents\n          }\n        });\n      }"

c1 = content.count(OLD1)
c2 = content.count(OLD2)
print(f"Fix1 found {c1} times, Fix2 found {c2} times")

if c1 == 0:
    # Find where "currency: plan.currency || 'USD'" appears
    idx = content.find("currency: plan.currency || 'USD'")
    if idx >= 0:
        snippet = repr(content[idx-20:idx+400])
        print(f"Found 'currency: plan.currency' at idx={idx}. Context: {snippet}")
    else:
        print("Could not find pricing currency line at all")

if c2 == 0:
    idx2 = content.find("currency: plan.currency || 'USD'", idx + 1 if c1 > 0 else 0)
    if idx2 >= 0:
        snippet = repr(content[idx2-20:idx2+400])
        print(f"Found second 'currency: plan.currency' at idx={idx2}. Context: {snippet}")
    exit(1)

content = content.replace(OLD1, NEW1, 1)
content = content.replace(OLD2, NEW2, 1)
print("Replacements done")

# Verify changes
nc1 = content.count(NEW1)
nc2 = content.count(NEW2)
print(f"New patterns present: fix1={nc1}, fix2={nc2}")

# Write back
b64 = base64.b64encode(content.encode()).decode()
write_cmd = f'echo {b64} | base64 -d > {tmp_path}'
child2 = pexpect.spawn('/usr/bin/ssh', ['-i', key, '-o', 'StrictHostKeyChecking=no', host, write_cmd], encoding='utf-8', timeout=60)
try:
    child2.expect(['Enter passphrase'], timeout=10)
    child2.sendline('Bingo8675309')
    child2.expect(pexpect.EOF, timeout=50)
except Exception as e:
    print(f"Write error: {e}")
    exit(1)

move_cmd = f'mv {tmp_path} {remote_path} && echo DONE'
child3 = pexpect.spawn('/usr/bin/ssh', ['-i', key, '-o', 'StrictHostKeyChecking=no', host, move_cmd], encoding='utf-8', timeout=15)
try:
    child3.expect(['Enter passphrase'], timeout=10)
    child3.sendline('Bingo8675309')
    child3.expect(['DONE'], timeout=10)
except Exception as e:
    print(f"Move error: {e}")
    exit(1)

print("Patch applied successfully!")
