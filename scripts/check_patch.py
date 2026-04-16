#!/usr/bin/env python3
"""Debug and patch paymentController.js."""
import pexpect, base64

key = '/home/krabs/.ssh/truekey'
host = 'ahoy@89.167.46.117'
remote_path = '/home/ahoy/BackEnd/src/controllers/paymentController.js'

def ssh_run(cmd, timeout=20):
    child = pexpect.spawn('/usr/bin/ssh', ['-i', key, '-o', 'StrictHostKeyChecking=no', host, cmd], encoding='utf-8', timeout=timeout)
    try:
        child.expect(['Enter passphrase'], timeout=10)
        child.sendline('Bingo8675309')
        child.expect(pexpect.EOF, timeout=timeout-5)
    except:
        pass
    return child.before.strip()

# Read just the crypto pricing block
r = ssh_run("sed -n '820,840p' " + remote_path)
print("CRYPTO (820-840):")
print(r)
print()
r2 = ssh_run("sed -n '924,942p' " + remote_path)
print("CARD (924-942):")
print(r2)
