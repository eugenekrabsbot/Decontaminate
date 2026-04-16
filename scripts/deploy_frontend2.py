#!/usr/bin/env python3
"""Deploy frontend to server via tarball + SSH."""
import pexpect, subprocess, os

KEY = '/home/krabs/.ssh/truekey'
HOST = 'ahoy@89.167.46.117'

# Step 1: create tarball
print("Creating tarball...")
result = subprocess.run(
    ['tar', '-czf', '/tmp/ahoyvpn_frontend.tar.gz', '-C',
     '/home/krabs/.openclaw/workspace/ahoyvpn-frontend/out', '.'],
    capture_output=True
)
if result.returncode != 0:
    print("tar failed:", result.stderr)
    exit(1)
print("Tarball size:", os.path.getsize('/tmp/ahoyvpn_frontend.tar.gz'))

# Step 2: upload via scp
print("Uploading tarball...")
child = pexpect.spawn('scp', ['-o', 'StrictHostKeyChecking=no', '-i', KEY,
    '/tmp/ahoyvpn_frontend.tar.gz', f'{HOST}:/tmp/'], timeout=120)
child.expect(['Enter passphrase'], timeout=30)
child.sendline('Bingo8675309')
child.expect(pexpect.EOF, timeout=90)
upload_out = child.before.decode()
print("SCP upload:", upload_out[-200:] if upload_out else "no output")
if child.exitstatus != 0:
    print("SCP exit status:", child.exitstatus)

# Step 3: extract on server
print("Extracting on server...")
child2 = pexpect.spawn('ssh', ['-i', KEY, '-o', 'StrictHostKeyChecking=no', HOST,
    "cd /var/www/ahoyvpn.net/html && tar -xzf /tmp/ahoyvpn_frontend.tar.gz && rm /tmp/ahoyvpn_frontend.tar.gz && echo DONE"],
    timeout=60)
child2.expect(['Enter passphrase'], timeout=30)
child2.sendline('Bingo8675309')
child2.expect(['DONE'], timeout=45)
print("Extract:", child2.before.decode()[-200:])
print("SUCCESS!")
