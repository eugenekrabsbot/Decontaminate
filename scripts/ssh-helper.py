#!/usr/bin/env python3
"""SSH helper — reads command from stdin, executes via SSH with key passphrase."""
import sys, pexpect

key = '/home/krabs/.ssh/truekey'
host = 'ahoy@89.167.46.117'

cmd = sys.stdin.read().strip()

child = pexpect.spawn(
    '/usr/bin/ssh',
    ['-i', key, '-o', 'StrictHostKeyChecking=no', '-o', f'ConnectTimeout=10', f'{host}', cmd],
    encoding=None  # get bytes
)
child.expect(['Enter passphrase for key', pexpect.EOF], timeout=10)
child.sendline('Bingo8675309')
child.expect(pexpect.EOF, timeout=15)
print(child.before.decode('utf-8', errors='replace'), end='', flush=True)
