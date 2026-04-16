#!/usr/bin/env python3
"""Patch paymentController.js to add discountCents + discountedBaseCents to pricing responses."""
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
    return child.before.strip()

# Read the file
print("Reading file...")
r = ssh_run('cat ' + remote_path, timeout=30)
content = r[r.find('\n')+1:].lstrip('\n')
# Normalize CRLF to LF
content = content.replace('\r\n', '\n').replace('\r', '\n')
print(f"Read {len(content)} bytes")

# Fix 1: crypto flow
old1 = ("        pricing: {\n"
        "          currency: plan.currency || 'USD',\n"
        "          baseAmountCents: plan.amount_cents,\n"
        "          taxAmountCents,\n"
        "          totalAmountCents\n"
        "        }\n"
        "      });\n"
        "    } else if (paymentMethod === 'card' || paymentMethod === 'card_redirect')")

new1 = ("        pricing: {\n"
        "          currency: plan.currency || 'USD',\n"
        "          baseAmountCents: plan.amount_cents,\n"
        "          discountCents: perLinkDiscount || 0,\n"
        "          discountedBaseCents,\n"
        "          taxAmountCents,\n"
        "          totalAmountCents\n"
        "        }\n"
        "      });\n"
        "    } else if (paymentMethod === 'card' || paymentMethod === 'card_redirect')")

# Fix 2: card redirect flow
old2 = ("          pricing: {\n"
        "            currency: plan.currency || 'USD',\n"
        "            baseAmountCents: plan.amount_cents,\n"
        "            taxAmountCents,\n"
        "            totalAmountCents\n"
        "          }\n"
        "        });\n"
        "      }")

new2 = ("          pricing: {\n"
        "            currency: plan.currency || 'USD',\n"
        "            baseAmountCents: plan.amount_cents,\n"
        "            discountCents: perLinkDiscount || 0,\n"
        "            discountedBaseCents,\n"
        "            taxAmountCents,\n"
        "            totalAmountCents\n"
        "          }\n"
        "        });\n"
        "      }")

c1 = content.count(old1)
c2 = content.count(old2)
print(f"Fix1 found {c1} times, Fix2 found {c2} times")

if c1 == 0:
    idx = content.find('pricing:')
    snippet = repr(content[idx:idx+500])
    print(f"ERROR: could not find crypto pricing block. First pricing: {snippet}")
    exit(1)

if c2 == 0:
    idx = content.find('pricing:', content.find('card'))
    snippet = repr(content[idx:idx+500])
    print(f"ERROR: could not find card redirect pricing block. Second pricing: {snippet}")
    exit(1)

content = content.replace(old1, new1, 1)
content = content.replace(old2, new2, 1)
print("Replacements done")

# Write via base64
b64 = base64.b64encode(content.encode()).decode()
print(f"Encoded: {len(b64)} bytes")

write_cmd = f'echo {b64} | base64 -d > {tmp_path}'
child2 = pexpect.spawn('/usr/bin/ssh', ['-i', key, '-o', 'StrictHostKeyChecking=no', host, write_cmd], encoding='utf-8', timeout=60)
try:
    child2.expect(['Enter passphrase'], timeout=10)
    child2.sendline('Bingo8675309')
    child2.expect(pexpect.EOF, timeout=50)
except Exception as e:
    print(f"Write error: {e}")
    exit(1)

# Move atomically
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
