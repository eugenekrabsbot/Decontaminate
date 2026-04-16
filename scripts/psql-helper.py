#!/usr/bin/env python3
import sys, os, pexpect

key = "/home/krabs/.ssh/truekey"
host = "ahoy@89.167.46.117"

sql = sys.stdin.read().strip()
cmd = "cd /home/ahoy/BackEnd && PGPASSWORD=ahoyvpn_secure_password psql -h localhost -U ahoyvpn -d ahoyvpn -t -c \'" + sql + "\'"

child = pexpect.spawn("/usr/bin/ssh", ["-i", key, "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10", host, cmd], encoding=None)
try:
    child.expect(["Enter passphrase for key"], timeout=10)
    child.sendline("Bingo8675309")
    child.expect(pexpect.EOF, timeout=15)
except:
    pass
output = child.before.decode("utf-8", errors="replace")
lines = output.splitlines()
if len(lines) > 2:
    result = "\n".join(lines[2:]).strip()
elif len(lines) == 2:
    result = lines[1].strip()
else:
    result = output.strip()
print(result)
