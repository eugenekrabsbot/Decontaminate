#!/usr/bin/env python3
"""Deploy frontend out/ directory to server via scp."""
import pexpect, os, subprocess, tempfile

KEY = '/home/krabs/.ssh/truekey'
HOST = 'ahoy@89.167.46.117'
REMOTE_TARGET = 'ahoy@89.167.46.117:/var/www/ahoyvpn.net/html/'
LOCAL_DIR = '/home/krabs/.openclaw/workspace/ahoyvpn-frontend/out'

# Create tarball of out dir
print("Creating tarball...")
result = subprocess.run(
    ['tar', '-czf', '/tmp/ahoyvpn_frontend.tar.gz', '-C', LOCAL_DIR, '.'],
    capture_output=True
)
if result.returncode != 0:
    print("tar failed:", result.stderr)
    exit(1)

print("Tarball created, size:", os.path.getsize('/tmp/ahoyvpn_frontend.tar.gz'))

# Upload via scp using expect
exp_script = '''set timeout 120
spawn scp -o StrictHostKeyChecking=no -i %s /tmp/ahoyvpn_frontend.tar.gz %s:/tmp/
expect {
  "Enter passphrase" { send "Bingo8675309\\r"; exp_continue }
  "yes/no" { send "yes\\r"; exp_continue }
  eof {}
}
expect eof
''' % (KEY, HOST)

with tempfile.NamedTemporaryFile(mode='w', suffix='.exp', delete=False) as f:
    f.write(exp_script)
    exp_file = f.name

print("Uploading tarball...")
result = subprocess.run(['expect', exp_file], capture_output=True, timeout=120)
os.unlink(exp_file)
if result.returncode != 0:
    print("SCP upload failed:", result.stderr.decode()[-200:])
    exit(1)
print("Uploaded!")

# Extract on server
print("Extracting on server...")
child = pexpect.spawn('/usr/bin/ssh', ['-i', KEY, '-o', 'StrictHostKeyChecking=no', HOST,
    'cd /var/www/ahoyvpn.net/html && tar -xzf /tmp/ahoyvpn_frontend.tar.gz && rm /tmp/ahoyvpn_frontend.tar.gz && echo DONE'],
    encoding='utf-8', timeout=60)
try:
    child.expect(['Enter passphrase'], timeout=10)
    child.sendline('Bingo8675309')
    child.expect(['DONE'], timeout=45)
except Exception as e:
    print("Extract error:", e)
print("Extract output:", child.before.strip()[-200:])
print("SUCCESS!")
