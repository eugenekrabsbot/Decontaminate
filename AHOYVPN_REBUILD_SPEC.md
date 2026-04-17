# AhoyVPN — Full System Rebuild Specification
> Complete enough for any agent to rebuild the entire system from scratch.
> Built from codebase analysis + production deployment records.
> Last updated: 2026-04-17

---

## SYSTEM OVERVIEW

**What it is:** Privacy-focused VPN subscription service.
**Stack:** Node.js/Express backend (port 3000) + Next.js static frontend.
**Payment:** Crypto (Plisio) + Card (Authorize.net Accept Hosted).
**VPN Provisioning:** VPNResellers API (NOT PureWL — PureWL is dead code).
**Database:** PostgreSQL — 18 auth/transaction tables.
**Deployment:** PM2 process manager, nginx web server, SSL via Let's Encrypt.
**Email:** SMTP (nodemailer) — configurable via env vars.
**Auth:** JWT + CSRF cookies. Numeric account IDs (8-digit). argon2 password hashing.

---

## ARCHITECTURE

```
User Browser
    │
    ├─ HTTPS ── nginx (port 443)
    │             ├─ /              → /var/www/ahoyvpn.net/html/ (static files)
    │             ├─ /api/*          → backend (port 3000)
    │             ├─ /relay.html     → backend /api/payment/relay-html (POST only)
    │             └─ /webhook/*     → backend (webhook.ahoyvpn.net)
    │
    └─ Port 3000 (backend)
          ├─ PostgreSQL
          ├─ Plisio API (crypto invoices)
          ├─ Authorize.net API (card payments)
          └─ VPNResellers API (VPN account provisioning)
```

**File locations:**
- Backend: `/home/ahoy/BackEnd/` (Node.js, git repo `BackEnd.git`)
- Frontend static: `/var/www/ahoyvpn.net/html/` (Next.js `output: 'export'`)
- Nginx main: `/etc/nginx/sites-available/ahoyvpn.net`
- Nginx webhook: `/etc/nginx/sites-available/webhook.conf`

---

## ENVIRONMENT VARIABLES

All required for production. Copy `.env.example` and fill in.

### Database
```
DATABASE_URL=postgres://user:password@localhost:5432/ahoyvpn
DATABASE_ADMIN_URL=postgres://user:admin_password@localhost:5432/ahoyvpn
DATABASE_AFFILIATE_URL=postgres://user:affiliate_password@localhost:5432/ahoyvpn
DATABASE_SSL=false  # true in production with proper cert
```

### JWT & Auth
```
JWT_SECRET=<random 256-bit hex string>
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=<random 256-bit hex string>
REFRESH_TOKEN_EXPIRES_IN=30d
ADMIN_API_KEY=<random string for admin API auth>
```

### CORS & URLs
```
CORS_ORIGIN=https://ahoyvpn.net
FRONTEND_URL=https://ahoyvpn.net
API_BASE_URL=https://ahoyvpn.net
NODE_ENV=production
PORT=3000
```

### Rate Limiting
```
RATE_LIMIT_WINDOW_MS=900000   # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

### Plisio (Crypto Payments)
```
PLISIO_API_KEY=<from plisio.io dashboard>
```

### Authorize.net (Card Payments)
```
AUTHORIZE_NET_API_LOGIN_ID=<from authorize.net merchant portal>
AUTHORIZE_NET_TRANSACTION_KEY=<from authorize.net merchant portal>
AUTHORIZE_SIGNATURE_KEY=<from authorize.net merchant portal — used for webhook HMAC-SHA512>
```

### VPNResellers (VPN Provisioning)
```
VPN_RESELLERS_API_TOKEN=<from vpnresellers.com API>
VPN_RESELLERS_PLAN_MONTHLY_ID=<plan ID from VPNResellers dashboard>
VPN_RESELLERS_PLAN_QUARTERLY_ID=<plan ID>
VPN_RESELLERS_PLAN_SEMIANNUAL_ID=<plan ID>
VPN_RESELLERS_PLAN_ANNUAL_ID=<plan ID>
```

### VPN Provisioning — Plans
The backend calls VPNResellers to create an account when a subscription is activated. Plan IDs in VPNResellers correspond to these billing periods. When a customer pays:
- Monthly plan → `VPN_RESELLERS_PLAN_MONTHLY_ID` activated
- Quarterly plan → `VPN_RESELLERS_PLAN_QUARTERLY_ID`
- Semi-annual plan → `VPN_RESELLERS_PLAN_SEMIANNUAL_ID`
- Annual plan → `VPN_RESELLERS_PLAN_ANNUAL_ID`

VPNResellers service: `/backend/src/services/vpnResellersService.js`

### SMTP (Transactional Email)
```
SMTP_HOST=<SMTP server hostname>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<username>
SMTP_PASS=<password>
EMAIL_FROM_TRANSACTIONAL=ahoyvpn@ahoyvpn.com
EMAIL_FROM_SUPPORT=support@ahoyvpn.com
```

### Tax Service (ZipTax)
```
ZIPTAX_API_KEY=<from ziptax.com>
```

### Optional / Debug
```
DEBUG_AUTHORIZE_NET=true   # enables verbose webhook logging
DISABLE_CLEANUP=false
DISABLE_PLISIO_POLLING=false
MIN_PAYOUT_CENTS=75   # minimum affiliate payout in cents ($0.75)
OPERATING_COST_PER_USER=0   # not currently used
```

### Deprecated / Dead (do NOT set)
```
PUREWL_BASE_URL, PUREWL_RESELLER_ID, PUREWL_SECRET_KEY
# PureWL/AtomVPN code removed April 9 2026 — do not add back
```

---

## BACKEND STRUCTURE

```
BackEnd/src/
├── index.js              # Express app entry point, port 3000
├── config/
│   └── database.js       # PostgreSQL connection pools (users/admins/affiliates)
├── controllers/
│   ├── authController_csrf.js   # PRIMARY — numeric account_number auth
│   ├── authController.js        # OLD — email-based auth (not used)
│   ├── affiliateController.js   # affiliate links, commissions, payouts
│   ├── paymentController.js     # checkout, plans, relay HTML, Authorize.net utils
│   ├── subscriptionController.js
│   ├── vpnController.js         # VPN config download endpoints
│   ├── webhookController.js     # Plisio, Authorize.net, PaymentsCloud webhooks
│   └── ... (others)
├── routes/
│   ├── paymentRoutes.js         # /api/payment/* — checkout, plans, relay-html
│   ├── authRoutes_csrf.js       # /auth/* — PRIMARY auth routes
│   └── ... (others)
├── services/
│   ├── plisioService.js         # crypto invoice creation, webhook handling
│   ├── vpnResellersService.js   # VPN account provisioning (ACTIVE — NOT PureWL)
│   ├── authorizeNetUtils.js     # Accept Hosted token generation
│   ├── emailService.js          # nodemailer wrapper
│   └── ziptaxService.js         # sales tax lookup by ZIP
├── middleware/
│   ├── authMiddleware_new.js    # JWT + CSRF verification
│   └── securityMiddleware.js    # Helmet CSP, rate limiting, CORS
└── scripts/
    └── backup_users.js          # git-push auth backups every 3h
```

### Start command
```bash
cd /home/ahoy/BackEnd
node src/index.js
# or via PM2:
pm2 start src/index.js --name ahoyvpn-backend
```

---

## DATABASE — POSTGRESQL

### Connection pools (3 separate pools for security isolation)
- `users` pool → `accounts`, `sessions`, `password_history`, `recovery_kits`, `subscriptions`, `transactions`, `vpn_accounts`
- `admin` pool → `admin_users`, `sessions`
- `affiliates` pool → `affiliates`, `sessions`

### Core tables

**accounts** — primary user table
```
id (SERIAL), account_number (VARCHAR(8) UNIQUE), email, password_hash (bcrypt),
numeric_password_hash (argon2), created_at, updated_at, status
```

**subscriptions** — one per user, tracks plan + status
```
id, account_number (FK), plan_id, status (trial/active/cancelled/expired),
created_at, updated_at, will_renew, referrer_code
```

**transactions** — payment records
```
id, account_number (FK), invoice_id, payment_method (plisio/authorize/paymentscloud),
amount_cents, status (pending/completed/failed/refunded), created_at,settled_at,
response_code, subscription_id (FK)
```

**vpn_accounts** — provisioned VPN accounts
```
id, account_number (FK), vpn_username, vpn_password_encrypted, server,
status, created_at, expires_at
```

**affiliates** — separate auth table
```
id, code, email, password_hash (argon2), commission_rate, payout_email,
status, created_at
```

**admin_users** — admin table
```
id, username, password_hash (bcrypt), created_at, last_login
```

---

## PAYMENT FLOWS

### Crypto (Plisio)
1. `POST /api/payment/checkout` with `method=crypto`, `plan_id`, optionally `affiliate_code`
2. Backend calls `POST https://plisio.io/api/v1/invoice` → returns `invoice_id` + QR code URL
3. Frontend shows QR code, polls `GET /api/payment/invoice/:invoice_id/status`
4. Customer pays → Plisio POSTs to `POST /api/payment/webhook/plisio`
5. Webhook activates subscription, calls `createVpnAccount()` via VPNResellers
6. Frontend polls `/api/me` → sees `vpn_username` → shows credentials

### Card (Authorize.net Accept Hosted)
1. `POST /api/payment/checkout` with `method=card`, `plan_id`
2. Backend calls Authorize.net API → gets Accept Hosted redirect URL
3. Customer redirected to `https://accept.authorize.net` iframe (NOT a redirect)
4. Customer enters card details on Authorize.net's hosted page
5. Authorize.net POSTs to Relay URL `https://ahoyvpn.net/relay.html`
6. Relay HTML auto-submits GET to `https://ahoyvpn.net/payment/success?payment=success`
7. Backend receives relay → activates subscription, creates VPN account
8. Customer sees success page with VPN credentials

**Relay URL:** `https://ahoyvpn.net/relay.html` (points to backend `relayHtmlPage`)

**Webhook:** Authorize.net also POSTs `authcapture.created` to `POST /api/payment/webhook/authorize` for settlement confirmation

### Affiliate Commission
- 25% of net revenue per referral
- $0.75 minimum payout
- 30-day hold before crediting
- Cookie: `affiliate_code` (30-day expiry)
- Recovery kit system for affiliate login recovery

---

## AUTHENTICATION

### Customer login
`POST /auth/login`
Body: `{ account_number: "12345678", password: "..." }`
Response: JWT cookie (httpOnly) + CSRF cookie

Account number is 8-digit numeric. Found in welcome email after registration.

### Registration
`POST /auth/register`
Body: `{ email, password (12+ chars) }`
Creates account with 8-digit account_number (assigned), 7-day trial, no email verification.
Password hashed with bcrypt → `password_hash`, argon2 → `numeric_password_hash`.

### Recovery kit (affiliates)
argon2-hashed 6-digit kit codes, 1-hour expiry. Not email-based.

### CSRF protection
- `csurf` middleware on all state-changing routes
- Token sent as cookie `csrf-token` + header `x-csrf-token`
- SameSite strict on JWT cookie

---

## FRONTEND (Next.js static export)

```
frontend/
├── pages/
│   ├── index.jsx           # homepage
│   ├── checkout.jsx         # PRIMARY — payment page (4-step: plan→payment→tax→confirm)
│   ├── login.jsx            # customer login
│   ├── register.jsx        # customer registration
│   ├── dashboard.jsx        # customer dashboard + VPN credentials
│   ├── affiliate.jsx        # affiliate signup
│   ├── affiliate-dashboard.jsx
│   ├── affiliate-agreement.jsx
│   ├── admin.html           # static (not Next.js)
│   ├── ahoyman-dashboard.html
│   └── payment/success.jsx  # post-payment redirect target
├── components/
│   ├── CheckoutForm.jsx     # step 2 (payment method selection + processing)
│   └── ... (others)
└── out/                     # `npm run build` output — deploys to /var/www/ahoyvpn.net/html/
```

**Checkout flow (4 steps):**
1. Select plan (monthly/quarterly/semi-annual/annual + trial flag)
2. Select payment method (card/crypto), enter email
3. Tax calculation (ZipTax by ZIP)
4. Confirmation + payment button

**Subscription agreement checkbox (card only):**
- Appears in checkout form
- Exact text: "I agree that I am signing up for a recurring subscription. I have read and agree to the Terms of Service. I understand that if I am ever locked out of my account, I can email ahoyvpn@ahoyvpn.com with my account number to cancel my subscription."
- Button disabled until checked
- Chargeback protection

**Build command:**
```bash
cd frontend
npm install
npm run build   # outputs to ./out/
```

---

## NGINX CONFIGURATION

### Main site (ahoyvpn.net)
```nginx
server {
    listen 443 ssl http2;
    server_name ahoyvpn.net www.ahoyvpn.net;
    root /var/www/ahoyvpn.net/html;
    index index.html;

    # CSP — allow Authorize.net iframe rendering
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'self' https://accept.authorize.net https://test.authorize.net;";

    # X-Frame-Options for Accept Hosted iframe
    add_header X-Frame-Options "ALLOW-FROM https://accept.authorize.net";

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/ahoyvpn.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ahoyvpn.net/privkey.pem;

    # Static files
    location / {
        try_files $uri $uri/ =404;
    }

    # Relay URL — POST proxy to backend (Authorize.net posts here)
    location = /relay.html {
        proxy_pass http://127.0.0.1:3000/api/payment/relay-html;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### Webhook subdomain (webhook.ahoyvpn.net)
```nginx
server {
    listen 443 ssl http2;
    server_name webhook.ahoyvpn.net;
    ssl_certificate /etc/letsencrypt/live/webhook.ahoyvpn.net/fullchain.pem;

    # All requests proxy to backend — NO static file serving
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
    }
}
```

**Key rule:** `webhook.ahoyvpn.net` cannot serve static files — everything goes to port 3000. The `relay.html` must be served from `ahoyvpn.net/relay.html` (not webhook subdomain).

---

## SSL CERTIFICATES

Let's Encrypt via certbot. Certificates at:
- `/etc/letsencrypt/live/ahoyvpn.net/` (main + www)
- `/etc/letsencrypt/live/webhook.ahoyvpn.net/` (webhook subdomain)

**Renewal:** `sudo certbot renew` — typically via cron.

**webhook.ahoyvpn.net cert expires:** 2026-06-27 — plan DNS-01 renewal before then.

---

## PM2 PROCESS MANAGEMENT

```bash
# Start
pm2 start src/index.js --name ahoyvpn-backend

# Restart after code changes
pm2 restart ahoyvpn-backend

# Logs
pm2 logs ahoyvpn-backend

# Status
pm2 list
pm2 show ahoyvpn-backend
```

Process runs as user `ahoy` (NOT root). Log files: `~/.pm2/logs/`.

---

## CRON JOBS

```
0 */2 * * *  — AhoyVPN monitoring (PM2, nginx, disk, SSL, API health)
0 22 * * *  — Nightly tasks (auth backup push, health checks)
0 12 * * *  — Noon daily (email check, calendar, weather, Moltbook)
0 14 * * *  — Daily security summary (auth log scan, file changes)
0 9 * * *    — Project mapping reminder
```

---

## BACKUP SYSTEM

`backup_users.js` — runs every 3 hours via cron.
- Backs up all auth tables (accounts, admin_users, affiliates, sessions, recovery_kits, transactions, subscriptions) to JSONB snapshots in `user_backups` table
- Also does: `cd /home/ahoy/BackEnd && git add -A && git commit -m "auth backup $(date)" && git push`
- Backup repo: `https://github.com/KeepUsAlive/BackEnd.git`

---

## MONITORING

`ahoyvpn-monitor.sh` (on server at `/home/ahoy/`):
- PM2 process check
- nginx health
- disk/RAM check
- SSL expiry check (warns if <30 days)
- API endpoint health
- Affiliate flow verification
- Webhook delivery check

Fails → Telegram notification to Will.

---

## KEY ENDPOINTS SUMMARY

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Customer login |
| POST | `/auth/ahoyman/login` | Admin login |
| POST | `/auth/affiliate/login` | Affiliate login |
| GET | `/payment/plans` | List plans with prices |
| POST | `/payment/checkout` | Initiate crypto or card payment |
| GET | `/payment/invoice/:id/status` | Poll crypto invoice status |
| POST | `/api/payment/webhook/plisio` | Plisio crypto webhook |
| POST | `/api/payment/webhook/authorize` | Authorize.net card webhook |
| GET/POST | `/api/payment/relay-html` | Authorize.net relay page (serves HTML) |
| GET | `/api/me` | Current user info + VPN credentials |
| POST | `/auth/logout` | Clear session |

---

## ERROR CODES TO KNOW

| Code | Meaning |
|------|---------|
| 550 | Relay URL not responding (Authorize.net can't reach it) |
| 405 | POST to static file (nginx can't handle POST to static) |
| 400 | Webhook signature invalid (wrong HMAC key) |
| 501 | VPN config download not implemented |
| EADDRINUSE | Port 3000 already occupied |
| authcapture.created responseCode=21 | Card authorized but not yet settled |

---

## GOTCHAS (lessons from production)

1. **relay.html is not a real static file** — nginx must proxy POST to backend, static POST returns 405
2. **webhook.ahoyvpn.net cannot serve relay.html** — vhost proxies all to backend, no static serving
3. **AUTHORIZE_SIGNATURE_KEY is ASCII string, not hex** — HMAC-SHA512 must use it as a raw key string, not hex-decoded bytes
4. **authcapture.created fires on auth, not settlement** — `responseCode` is empty at this stage; use invoice number lookup to confirm settlement
5. **PM2 restart count resets on reboot** — don't trust high restart counts as a sign of instability
6. **PureWL is dead** — VPNResellers is the only active VPN provisioning service
7. **CSRF token must be sent as header AND cookie** — Vue/fetch must include `x-csrf-token` header with cookie value
8. **JWT cookie is httpOnly + sameSite=lax** — cannot be read by client JS (by design)
9. **Affiliate cookie `affiliate_code` is case-insensitive** — `normalizeAffiliateCode()` strips special chars
10. **arg2 numeric_password_hash checked FIRST on login** — must update both hash columns together or login breaks

---

*This spec is derived from the live production codebase and the crash-logged lessons of getting it working. Anyone rebuilding from this should be able to spin up a functionally identical system.*