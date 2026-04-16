#!/usr/bin/env python3
"""Patch paymentController.js."""
import pexpect, subprocess, os, tempfile

KEY = '/home/krabs/.ssh/truekey'
HOST = 'ahoy@89.167.46.117'
REMOTE_PATH = '/home/ahoy/BackEnd/src/controllers/paymentController.js'
TMP_UPLOAD = '/tmp/paymentController_patched.js'

def ssh_run(cmd, timeout=20):
    child = pexpect.spawn('/usr/bin/ssh', ['-i', KEY, '-o', 'StrictHostKeyChecking=no', HOST, cmd], encoding='utf-8', timeout=timeout)
    try:
        child.expect(['Enter passphrase'], timeout=10)
        child.sendline('Bingo8675309')
        child.expect(pexpect.EOF, timeout=timeout-5)
    except:
        pass
    raw = child.before
    idx = raw.find('\n')
    return raw[idx+1:]

print("Reading remote file...")
content = ssh_run(f'cat {REMOTE_PATH}')
content = content.replace('\r\n', '\n').replace('\r', '\n')
print(f"Read {len(content)} bytes")

# Fix 1: crypto flow
old1 = ("          baseAmountCents: plan.amount_cents,\n\n"
        "          taxAmountCents,\n\n"
        "          totalAmountCents\n\n"
        "        }\n\n"
        "      });\n\n"
        "    } else if (paymentMethod === 'card'")

new1 = ("          baseAmountCents: plan.amount_cents,\n\n"
        "          discountCents: perLinkDiscount || 0,\n\n"
        "          discountedBaseCents,\n\n"
        "          taxAmountCents,\n\n"
        "          totalAmountCents\n\n"
        "        }\n\n"
        "      });\n\n"
        "    } else if (paymentMethod === 'card'")

# Fix 2: card redirect flow
old2 = ("            baseAmountCents: plan.amount_cents,\n\n"
        "            taxAmountCents,\n\n"
        "            totalAmountCents\n\n"
        "          }\n\n"
        "        });\n\n"
        "      }")

new2 = ("            baseAmountCents: plan.amount_cents,\n\n"
        "            discountCents: perLinkDiscount || 0,\n\n"
        "            discountedBaseCents,\n\n"
        "            taxAmountCents,\n\n"
        "            totalAmountCents\n\n"
        "          }\n\n"
        "        });\n\n"
        "      }")

c1 = content.count(old1)
c2 = content.count(old2)
print(f"Fix1={c1}, Fix2={c2}")
if c1 == 0 or c2 == 0:
    print("Pattern not found, adjusting...")
    idx = content.find("baseAmountCents: plan.amount_cents,")
    print(f"baseAmountCents context: {repr(content[idx:idx+400] if idx>=0 else 'N/A')}")
    exit(1)

content = content.replace(old1, new1, 1)
content = content.replace(old2, new2, 1)
print("Patches applied")

# Write local temp
with open(TMP_UPLOAD, 'w') as f:
    f.write(content)

# SCP via expect
script = 'set timeout 30\n'
script += f'spawn scp -o StrictHostKeyChecking=no -i {KEY} {TMP_UPLOAD} ahoy@89.167.46.117:{REMOTE_PATH}\n'
script += 'expect {\n'
script += '  "Enter passphrase" { send "Bingo8675309\\r"; exp_continue }\n'
script += '  "yes/no" { send "yes\\r"; exp_continue }\n'
script += '  eof {}\n'
script += '}\n'
script += 'expect eof\n'

with tempfile.NamedTemporaryFile(mode='w', suffix='.exp', delete=False) as f:
    f.write(script)
    exp_file = f.name

print("Uploading...")
result = subprocess.run(['expect', exp_file], capture_output=True, timeout=30)
os.unlink(exp_file)
if result.returncode != 0:
    print(f"FAIL: {result.stderr.decode()[-300:]}")
    exit(1)
print("SUCCESS!")
