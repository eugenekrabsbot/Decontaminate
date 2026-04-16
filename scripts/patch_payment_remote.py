#!/usr/bin/env python3
"""Patch paymentController.js on the server."""
import subprocess, sys

REMOTE_PATH = '/home/ahoy/BackEnd/src/controllers/paymentController.js'

# Read file
result = subprocess.run(
    ['ssh', '-i', '/home/krabs/.ssh/truekey', '-o', 'StrictHostKeyChecking=no',
     'ahoy@89.167.46.117', f'cat {REMOTE_PATH}'],
    capture_output=True, timeout=30
)
content = result.stdout.decode('utf-8', errors='replace')
content = content[content.find('\n')+1:]

# Normalize to Unix line endings
content = content.replace('\r\n', '\n').replace('\r', '\n')
print(f"Read {len(content)} bytes")

# Fix 1: add discountCents and discountedBaseCents after baseAmountCents in crypto flow
# We need to find the block where these appear together
# The pattern: baseAmountCents: plan.amount_cents, (short form) in the pricing object
OLD1A = ("          baseAmountCents: plan.amount_cents,\n\n"
         "          taxAmountCents,\n\n"
         "          totalAmountCents\n\n"
         "        }\n\n"
         "      });\n\n"
         "    } else if (paymentMethod === 'card'")

NEW1A = ("          baseAmountCents: plan.amount_cents,\n\n"
         "          discountCents: perLinkDiscount || 0,\n\n"
         "          discountedBaseCents,\n\n"
         "          taxAmountCents,\n\n"
         "          totalAmountCents\n\n"
         "        }\n\n"
         "      });\n\n"
         "    } else if (paymentMethod === 'card'")

# Fix 2: card redirect flow
OLD2A = ("            baseAmountCents: plan.amount_cents,\n\n"
         "            taxAmountCents,\n\n"
         "            totalAmountCents\n\n"
         "          }\n\n"
         "        });\n\n"
         "      }")

NEW2A = ("            baseAmountCents: plan.amount_cents,\n\n"
         "            discountCents: perLinkDiscount || 0,\n\n"
         "            discountedBaseCents,\n\n"
         "            taxAmountCents,\n\n"
         "            totalAmountCents\n\n"
         "          }\n\n"
         "        });\n\n"
         "      }")

c1 = content.count(OLD1A)
c2 = content.count(OLD2A)
print(f"Fix1={c1}, Fix2={c2}")

if c1 == 0:
    idx = content.find("baseAmountCents: plan.amount_cents,")
    print(f"Fix1 pattern not found. Context: {repr(content[idx:idx+300])}")
    sys.exit(1)
if c2 == 0:
    idx = content.find("baseAmountCents: plan.amount_cents,", content.find("card")+1 if "card" in content else 0)
    print(f"Fix2 pattern not found. Context: {repr(content[idx:idx+300])}")
    sys.exit(1)

content = content.replace(OLD1A, NEW1A, 1)
content = content.replace(OLD2A, NEW2A, 1)
print("Replacements done")

# Write via cat heredoc on server
# Use python3 on server to write the file
write_script = f'''python3 -c "
import sys
data = sys.stdin.read()
with open('{REMOTE_PATH}', 'w') as f:
    f.write(data)
print('OK')
"'''

result2 = subprocess.run(
    ['ssh', '-i', '/home/krabs/.ssh/truekey', '-o', 'StrictHostKeyChecking=no',
     'ahoy@89.167.46.117', write_script],
    input=content.encode(), capture_output=True, timeout=30
)
print("Write result:", result2.returncode, result2.stdout.decode(), result2.stderr.decode()[-200:])
if result2.returncode != 0:
    sys.exit(1)
print("SUCCESS!")
