#!/usr/bin/env python3
import json
import os
import sys
import subprocess

def run(cmd):
    return subprocess.check_output(cmd, shell=True, text=True).strip()

secrets_path = os.path.expanduser('~/.openclaw/secrets/ahoyvpn.json')
with open(secrets_path) as f:
    secrets = json.load(f)

# Generate random secrets
jwt_secret = run('openssl rand -hex 32')
refresh_secret = run('openssl rand -hex 32')
db_password = run('openssl rand -hex 12')

# Database connection string
db_url = f"postgresql://ahoyvpn:{db_password}@localhost:5432/ahoyvpn"

env_lines = [
    '# Server',
    'PORT=3000',
    'NODE_ENV=production',
    f'API_BASE_URL=https://ahoyvpn.net',
    'FRONTEND_URL=https://ahoyvpn.net',
    '',
    '# Database',
    f'DATABASE_URL={db_url}',
    'REDIS_URL=redis://localhost:6379',
    '',
    '# JWT',
    f'JWT_SECRET={jwt_secret}',
    'JWT_EXPIRES_IN=15m',
    f'REFRESH_TOKEN_SECRET={refresh_secret}',
    'REFRESH_TOKEN_EXPIRES_IN=7d',
    '',
    '# PureWL (Atom VPN)',
    f'PUREWL_SECRET_KEY={secrets["purewl"]["secretKey"]}',
    'PUREWL_BASE_URL=https://atomapi.com',
    'PUREWL_RESELLER_ID=',
    '',
    '# Stripe',
    f'STRIPE_SECRET_KEY={secrets["stripe"]["secretKey"]}',
    'STRIPE_WEBHOOK_SECRET=whsec_placeholder',
    f'STRIPE_PUBLISHABLE_KEY={secrets["stripe"]["publicKey"]}',
    '',
    '# Plisio (Crypto Payments)',
    f'PLISIO_API_KEY={secrets["plisio"]["apiKey"]}',
    'PLISIO_SHOP_ID=',
    '',
    '# MailerSend (Transactional Email API)',
    f'MAILERSEND_API_KEY={secrets["mailersend"]["secretKey"]}',
    'EMAIL_FROM_TRANSACTIONAL=noreply@ahoyvpn.net',
    'EMAIL_FROM_SUPPORT=ahoyvpn@ahoyvpn.com',
    '',
    '# Affiliate',
    'AFFILIATE_COMMISSION_RATE=0.25',
    'AFFILIATE_MINIMUM_PER_USER=0.75',
    'OPERATING_COST_PER_USER=1.20',
    'FIXED_MONTHLY_COST=6.00',
    '',
    '# Security',
    'CORS_ORIGIN=https://ahoyvpn.net',
    'RATE_LIMIT_WINDOW_MS=900000',
    'RATE_LIMIT_MAX_REQUESTS=100',
]

output = '\n'.join(env_lines)
print(output)

# Also write to file
with open('/tmp/ahoyvpn.env', 'w') as f:
    f.write(output)
print('\n# Written to /tmp/ahoyvpn.env', file=sys.stderr)