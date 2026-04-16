#!/usr/bin/env python3
"""SQL query helper: runs psql over SSH (csv mode), returns clean result."""
import sys, pexpect, csv, io

key = "/home/krabs/.ssh/truekey"
host = "ahoy@89.167.46.117"

sql = sys.stdin.read().strip()
# Use --csv for predictable output (empty results still output header)
cmd = 'cd /home/ahoy/BackEnd && PGPASSWORD=ahoyvpn_secure_password psql -h localhost -U ahoyvpn -d ahoyvpn --csv -c "{}"'.format(sql.replace('"', '\\"'))

child = pexpect.spawn(
    "/usr/bin/ssh",
    ["-i", key, "-o", "StrictHostKeyChecking=no", host, cmd],
    encoding="utf-8", timeout=25,
)
try:
    child.expect(["Enter passphrase for key"], timeout=10)
    child.sendline("Bingo8675309")
    child.expect(pexpect.EOF, timeout=15)
except Exception:
    pass

output = child.before

# Remove SSH key echo line
lines = []
for raw in output.splitlines():
    s = raw.strip()
    if s.startswith("'") and ": $" in s:
        continue  # skip SSH key echo
    lines.append(s)

# Parse CSV: first row is header, remaining rows are data
if len(lines) < 2:
    print("")
    sys.exit(0)

body = "\n".join(lines[1:])
reader = csv.DictReader(io.StringIO(body))
data_rows = list(reader)

if not data_rows:
    print("")
    sys.exit(0)

header = reader.fieldnames or []
if len(data_rows) == 1 and len(header) == 1:
    print(list(data_rows[0].values())[0])
elif len(data_rows) == 1:
    print("|".join(data_rows[0].get(h, "") for h in header))
else:
    print("\n".join("|".join(row.get(h, "") for h in header) for row in data_rows))
