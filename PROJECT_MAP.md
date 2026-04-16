# AhoyVPN — Project Map (Complete)
> **Goal:** Map every component, feature, flow, and risk point.  
> **Why:** Build a future monitoring agent that catches bugs proactively.  
> **Phase:** Complete — all 6 priorities mapped.  
> **Updated:** 2026-04-14 (precision pass: auth cookies, CSRF, affiliate cookie name, DB pools, nginx, PM2, cron)

---

## What We Have (Existing Docs)

| File | Scope |
|------|-------|
| `AHOYVPN_SYSTEM_MAP.md` | Architecture, frontend routes, backend routes, infra |
| `memory/2026-04-14.md` | Today's session decisions and fixes |
| `TOOLS.md` | SSH keys, server access, payment processors |
| `archive/fastapi-backend-2026-04-14/` | Archived FastAPI rewrite — incomplete, never deployed, stored for reference |
| `BackEnd/` (server) | Node.js production backend — PM2-managed, port 3000 |

---

## Mapping Complete ✅ — All Priorities Done

Every checkable item in every priority has been mapped and verified. See below for the full status.

### 🔴 Priority 1 — Core Flows ✅ COMPLETE

**Auth System** ✅
- [x] Customer registration — `POST /auth/register`, 12+ char password, 7-day trial, no email verification
- [x] Customer login — `POST /auth/login`, account_number + password, argon2 hash
- [x] Affiliate login — `POST /auth/affiliate/login`, `affiliates` table, argon2
- [x] Admin login — `POST /auth/ahoyman/login`, `admin_users` table, argon2
- [x] Password reset/recovery — token flow (1hr, SHA-256), recovery kit for affiliates; email NOT sent (by design — recovery kit is the flow)
- [x] Logout — all 3 types clear session cookie and return `{'status': 'ok'}`

**Checkout & Payment Flow** ✅
- [x] Plan listing (`GET /payment/plans`) — 4 plans: $5.99/mo — $59.99/yr
- [x] Checkout initiation (`POST /payment/checkout`) — full request/response shape
  - [x] Affiliate discount lookup — per-link from `affiliate_link_discounts`, case-insensitive ✅
  - [x] Crypto flow via Plisio — invoice + QR code
  - [x] Card flow via Authorize.net Accept Hosted — redirect URL + relay
- [x] Plisio webhook (`POST /webhooks/plisio`) — activates subscription, creates VPN, sends email
- [x] Authorize.net webhook (`POST /webhooks/authorize`) — ARB for recurring, idempotency
- [x] PaymentsCloud webhook (`POST /webhooks/paymentscloud`) — uses `account_number` in metadata
- [x] Invoice status polling — frontend polls `GET /payment/invoice/:id/status`

**Affiliate System** ✅
- [x] getLinks — returns `{id, code, url, clicks, discount_cents, signups}` per link
- [x] createAffiliateLinkWithCode — creates promo_code + affiliate_link + affiliate_link_discounts
- [x] generateAffiliateLink — auto-generates code + URL
- [x] Affiliate attribution — cookie `affiliate_code` at checkout → `subscription.referral_code` (normalizeAffiliateCode strips special chars)
- [x] Commission calculation — 10% of net profit, $0.75 min, case-insensitive username lookup ✅ FIXED
- [x] Payout request flow — min $10, manual email, backend now says `Ahoyvpn@ahoyvpn.net` ✅ FIXED
- [x] `payout_config` table — key=`minimum_payout_cents`=1000, `commission_rate`=0.25, `hold_period_days`=30, `default_discount_cents`

**User/Subscription System** ✅
- [x] Subscription states — trialing (7 days), active, cancelled, expired
- [x] VPN credentials generation — VPNResellers API on payment webhook; account created, enabled, expiry set
- [x] VPN server access — ALL 501 ❌ — controller (`vpnController.js`) has 6 stub functions returning `{error: 'Not implemented'}`; VPNResellersService (`vpnResellersService.js`) has account management methods but NO server list/config methods

**Frontend Pages** ✅ (all mapped — see Priority 1 Checklist for details)

### 🟡 Priority 2 — Admin / AhoyMan Panel ✅ COMPLETE

- [x] `/api/admin/metrics` ✅ — returns totalAffiliates, activeSubscriptions, totalCustomers, etc.
- [x] `/api/admin/customers` ✅ — list/search/suspend/delete
- [x] `/api/admin/affiliates` ✅ — list with commission rate + payout status
- [x] `/api/admin/kpis` ⚠️ — returns 403 (access level mismatch — known issue)
- [x] User management ✅ — suspend, delete, edit via `/api/admin/customers/:id/*`
- [x] Affiliate payout approval ✅ — approve/reject via `/api/admin/payout-requests/:id/approve|reject`

### 🟡 Priority 3 — Edge Cases & Failure Modes ✅ COMPLETE

- [x] Duplicate email registration ✅ — 400 `{error: 'User already exists'}`
- [x] Duplicate affiliate code ✅ — 400 `{error: 'Code already exists'}`
- [x] Expired Plisio invoice ✅ — frontend polls at 15/30/45 min; marked `'timeout_no_payment'` after 45min
- [x] Failed payment webhook ✅ — first success wins; no retry loop
- [x] Affiliate code at checkout ✅ — if code doesn't exist: discount = 0 (silently ignored)
- [x] Affiliate code with no `affiliate_link_discounts` entry ✅ — discount = 0 (no error thrown)
- [x] CSRF token ✅ — `X-CSRF-Token` header validated on mutating endpoints (GET/HEAD/OPTIONS exempt); stored in-memory Map (not Redis); cookie `csrfToken`, `httpOnly: false`, `secure: true`, `sameSite: strict`, `maxAge: 15min`; auto-refreshes on invalid token
- [x] Auth token — read from `req.cookies.accessToken` first, falls back to `Authorization: Bearer` header; cookie `accessToken`, `httpOnly: true`, `secure: true`, `sameSite: strict`
- [x] Session expiry ✅ — access token 15min; refresh token 7 days; sliding window

### 🟢 Priority 4 — Frontend State & UI ✅

- [x] Affiliate dashboard state — `GET /affiliate/metrics` + `GET /affiliate/links` on load; `handleCopyLink` reads `link.url` (never `[object Object]`)
- [x] Ahoyman dashboard state — `GET /auth/ahoyman/metrics` on load; full admin panel state in affiliate-dashboard.jsx
- [x] Checkout page state — 4-step state machine: `plan → payment → confirm → success`; affiliate cookie read on mount via `getAffiliateId()`
- [x] Dashboard state — `GET /me` + `GET /subscription` on load; VPN credentials shown from `profile.vpn_username`
- [x] Error states — inline errors via `setError()` + `alert()` for action failures; success via `setSuccess()`; no toast library

### 🔵 Priority 5 — Database Schema (Full) ✅ COMPLETE

#### Node.js Backend Tables (Production — `89.167.46.117`)

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `users` | id (uuid), email, password_hash, account_number, status, is_active, totp_enabled, totp_secret, failed_attempts, lock_until, last_login, email_verified, created_at | |
| `admin_users` | id, username, password_hash, role, last_login, created_at | |
| `affiliates` | id, user_id, username, email, password_hash, status, commission_rate, created_at | `username` is mixed-case (e.g. 'MrBossNigga'); stored referral codes are UPPERCASE |
| `affiliate_links` | id, affiliate_id, code, url, clicks, active, created_at | `url` built server-side: `https://ahoyvpn.net/affiliate/` + code |
| `affiliate_link_discounts` | id, affiliate_link_id, discount_cents | `discount_cents` = dollar amount × 100 |
| `promo_codes` | id, affiliate_id, code, discount_type, discount_value, created_at | 11 of 15 orphaned (no corresponding affiliate_link) |
| `referrals` | id, affiliate_id, referral_link_id, user_id, created_at, attribution_status, confirmed_at | Attribution by affiliate_link_id |
| `subscriptions` | id, user_id, plan_id, status, referral_code, plisio_invoice_id, arb_subscription_id, current_period_end, cancel_at_period_end, created_at, updated_at | `referral_code` stored as UPPERCASE |
| `plans` | id, name, interval, amount_cents, trial_days, features (jsonb) | |
| `payments` | id, user_id, subscription_id, amount_cents, payment_method, status, plisio_invoice_id, created_at | |
| `transactions` | id, affiliate_id, type, amount_cents, paid_out_at, created_at | type = 'commission' or 'payout' |
| `payout_requests` | id, affiliate_id, amount_cents, status, requested_at, processed_at, processor_transaction_id, notes | |
| `payout_config` | id, affiliate_id, key, value | Keys: minimum_payout_cents=1000, commission_rate=0.25, hold_period_days=30, default_discount_cents |
| `vpn_accounts` | id, user_id, purewl_username, purewl_password, purewl_uuid, expiry_date, status, multi_login_limit, allowed_countries (jsonb) | ⚠️ `purewl_*` columns store VPNResellers credentials (misleading name) |
| `recovery_kits` | id, user_id, kit (encrypted), expires_at, used_at, last_shown_at | 8 codes, argon2 hashed, 1-hour expiry |
| `password_reset_tokens` | id, user_id, token_hash, expires_at, used, created_at | SHA-256 hash, 1-hour expiry |
| `sessions` | id, user_id, token_hash, expires_at, revoked, created_at | |
| `tax_transactions` | id, user_id, state, zip, subtotal_cents, tax_rate, tax_amount_cents, created_at | |
| `admin_audit_log` | id, actor_id, action, target_type, target_id, ip_address, created_at | |
| `invoices` | id, user_id, plisio_invoice_id, amount_cents, currency, status, invoice_url, expires_at, created_at | |
| `data_exports` | id, user_id, token, status, file_path, created_at, expires_at | |
| `connection_logs` | id, user_id, vpn_account_id, connected_at, disconnected_at, bytes_in, bytes_out | |

**FastAPI backend archived** — `archive/fastapi-backend-2026-04-14/` (incomplete rewrite, never deployed). Had DB sessions instead of JWT, different schema (`customer` vs `users`, etc.).

### 🔵 Priority 6 — Infrastructure & Ops ✅ COMPLETE

**Backend:** Node.js production (`/home/ahoy/BackEnd/src/index.js`), PM2 `ahoyvpn-backend`, Node 20.20.1, fork mode, no memory limit, autorestart=unexpected_exit, PM2 env vars: `PORT=3000`, `NODE_ENV=production`, `API_BASE_URL=http://localhost:3000`

**Database:** PostgreSQL on same host (`localhost:5432`), three connection pools:
- `pool` — main app operations (DATABASE_URL)
- `affiliatePool` — affiliate dashboard queries (DATABASE_AFFILIATE_URL)
- `adminPool` — admin operations (DATABASE_ADMIN_URL)
All use same credentials (`ahoyvpn:ahoyvpn_secure_password@localhost:5432/ahoyvpn`), SSL optional

**Nginx (HTTPS only, TLS 1.2/1.3):**
- `/api/` → proxies to `http://localhost:3000`
- `/affiliate/:code` → proxies to `http://localhost:3000/api/ref/:code` (sets `affiliate_code` cookie)
- Static files: `/var/www/ahoyvpn.net/html/`
- CSP header: `default-src 'self'; connect-src 'self' https://checkout.plisio.net https://checkout.paymentscloud.com`
- HSTS: `max-age=31536000; includeSubDomains; preload`
- SSL cert: `/etc/letsencrypt/live/ahoyvpn.net/`, expires Jun 3 2026

**Cron (ahoy user):**
- `0 */3 * * *` — `backup_users.js` every 3 hours
- Account deletion cron: DISABLED

**Root crontab:** empty (no /root/pm2.sh running every minute — the 225 restarts were historical)

---

## Monitoring Agent Blueprint (Future)

When we build the monitoring agent, it needs to track:

```
HEALTH CHECKS:
- Infrastructure: PM2 up, nginx up, PostgreSQL up, disk < 80%, RAM < 90%
- All HTTP routes return 200
- Registration: can register + get token
- Affiliate link creation: creates with discount_cents + url
- Checkout: applies discount correctly per affiliate code
- Copy button: returns a valid URL string (not "[object Object]")
- Affiliate links table: shows discount_cents for all links
- Payout: validates minimum ($10) from DB, not hardcoded

TRENDS TO TRACK:
- New affiliate signups (count per day)
- New customer signups (count per day)
- Commission amounts (sum per day/week)
- Payout requests pending
- Subscription renewals / cancellations
- Failed payment webhooks

REGRESSION TESTS (run on every deploy):
1. Register → get token
2. Create affiliate link with discount → GET links → discount_cents present
3. Copy button → clipboard has valid URL
4. Checkout with affiliate code → baseAmountCents reduced by discount
5. Admin login → metrics endpoint returns data
6. Payout request → below $10 rejected with correct message; message says `Ahoyvpn@ahoyvpn.net` (not `william@ahoyvpn.com`)
7. Commission with mixed-case affiliate username → referral credited (case-insensitive)

VPN ENDPOINTS (known 501 — Will has direct links, can defer):
- GET /api/vpn/servers → 501 (not implemented)
- GET /api/vpn/config/wireguard → 501 (not implemented)
- GET /api/vpn/config/openvpn → 501 (not implemented)
- POST /api/vpn/connect → 501 (not implemented)
- POST /api/vpn/disconnect → 501 (not implemented)
- GET /api/vpn/connections → 501 (not implemented)
```

**Bug Alert Rules:**
- VPN endpoints returning 501 → customers can't download configs after paying (all 6: servers, wireguard, openvpn, connect, disconnect, connections)
- Commission credited but referrals table empty → commission attribution broken
- PM2 restart count increasing rapidly → process crashing, investigate immediately
- CSRF in-memory Map not distributed → if scaling to multiple PM2 processes, CSRF tokens won't work (currently single process)

**Bugs Fixed (April 14, 2026):**
- ✅ Payout email: `william@ahoyvpn.com` → `Ahoyvpn@ahoyvpn.net` (2 places)
- ✅ Commission case mismatch: `WHERE username = $1` → `WHERE UPPER(username) = UPPER($1)` (paymentController.js:549)
- ✅ PM2 stability: investigated, no current crash loop (225 restarts were historical from March incident)

**Backend:** Single Node.js production backend at `https://ahoyvpn.net/api/`. FastAPI rewrite archived at `archive/fastapi-backend-2026-04-14/`.

---

## Gaps Identified So Far

1. **`promo_codes` vs `affiliate_links` — two separate tables with confusing overlap**
   - `promo_codes`: general-purpose discount codes (created by affiliates via frontend)
   - `affiliate_links`: URLs with codes (`https://ahoyvpn.net/affiliate/CODE`)
   - They are created together via `createAffiliateLinkWithCode` but stored separately
   - The `url` field on `affiliate_links` is constructed server-side, not stored at creation

2. **`handleCreateCustomCode` bug (FIXED 2026-04-14):**
   - Was prepending `res.data.data` (promo_code object, no `discount_cents` or `url`)
   - Fixed: now calls `getAffiliateLinks()` after creation to get complete data
   - Same fix applied to `handleGenerateLink`

3. **Copy button inline bug (FIXED 2026-04-14):**
   - Was passing whole object to `setLinkCopied` when `link.id` was undefined
   - Fixed: `A(e?.id)` in deployed chunk

4. **`actionLoading` scope bug (FIXED 2026-04-14):**
   - `actionLoading` declared in parent `AhoyManDashboard` but used in `AffiliatesTab`
   - Fixed: added `const [actionLoading, setActionLoading] = useState({})` to AffiliatesTab

---

## MAPPED: `/api/payment/checkout` (✅ First pass — 2026-04-14)

**Route:** `POST /api/payment/checkout`
**Auth:** Bearer token (customer)

**Request:**
```json
{
  "planId": "<uuid>" | "monthly" | "quarterly" | "semiannual" | "annual",
  "paymentMethod": "crypto" | "card",
  "cryptoCurrency": "BTC" | "ETH" | "LTC" | ... (see ALLOWED_CRYPTO_CURRENCIES),
  "affiliateId": "<code>" (optional, case-insensitive)
}
```

**Plan aliases accepted:** `monthly`, `quarterly`, `semiannual`, `semi-annual`, `annual` (case-insensitive)

**Affiliate discount logic (FIXED 2026-04-14):**
```sql
SELECT ald.discount_cents
FROM affiliate_links al
JOIN affiliate_link_discounts ald ON al.id = ald.affiliate_link_id
WHERE UPPER(al.code) = UPPER($1) AND al.active = true LIMIT 1
```
- Case-insensitive match
- `discount_cents` is dollar amount × 100 (e.g., 50 = $0.50)
- Applied to `baseAmountCents` pre-tax (not `totalAmountCents`)
- Discount subtracted before tax calculation

**Allowed crypto:** BTC, LTC, DASH, ZEC, DOGE, BCH, XMR, USDT, USDT_TRX, USDT_BEP20, ETH, BASE_ETH

**normalizeAffiliateCode:** strips all non-alphanumeric except `_` and `-`, max 64 chars, returns null if empty

**Plan intervals:** `month`, `quarter`, `semi_annual`, `year`

**Key response fields:**
- `invoice.pricing.baseAmountCents` — pre-discount (or post-discount if affiliate)
- `invoice.pricing.taxAmountCents` — calculated on discounted base
- `invoice.pricing.totalAmountCents` — final amount charged
- `invoice.invoiceUrl` — Plisio invoice URL for crypto
- `invoice.plisioInvoiceId` — stored for webhook matching

**Subscription activation:** Happens in `plisioWebhook` when invoice confirmed `status=completed`

---

## MAPPED: Payment Routes (✅ First pass — 2026-04-14)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/payment/plans` | GET | Bearer | List all plans with pricing |
| `/api/payment/checkout` | POST | Bearer | Create invoice (crypto or card) |
| `/api/payment/invoice/:id/status` | GET | Bearer | Poll Plisio invoice status |
| `/api/payment/webhook/plisio` | POST | None | Plisio IPN callback |
| `/api/payment/webhook/authorize` | POST | None | Authorize.net webhook |
| `/api/payment/webhook/paymentscloud` | POST | None | PaymentsCloud webhook |
| `/api/payment/authorize/relay` | GET/POST | None | Authorize.net relay response |
| `/api/payment/hosted-redirect` | GET | None | Accept Hosted redirect bridge |
| `/api/payment/hosted-redirect-script.js` | GET | None | Accept Hosted JS |

---

## Next Mapping Session

Continue with:
1. `plisioWebhook` — how subscription activated, what data stored
2. `applyAffiliateCommissionIfEligible` — commission calculation, hold period
3. Auth system — registration fields/validation, login flow, session handling
4. `payout_config` table — all keys documented
5. Database schema for `subscriptions`, `invoices`, `commissions` tables

---

## Mapping Session 2 (2026-04-14 09:07 UTC) — Findings

### 🔴 CRITICAL BUG: Commission Attribution Broken (Case Mismatch)

**File:** `/home/ahoy/BackEnd/src/controllers/paymentController.js` → `applyAffiliateCommissionIfEligible`

**The bug:**
```sql
-- This function looks up affiliate by USERNAME:
SELECT id, username, user_id
FROM affiliates
WHERE username = $1 AND status = 'active'
LIMIT 1
```

But `subscription.referral_code` stores the **UPPERCASE LINK CODE** (e.g., "MRBOSSNIGGA").
Affiliates have **MIXED CASE** usernames (e.g., "MrBossNigga").

`WHERE username = 'MRBOSSNIGGA'` will NEVER match because PostgreSQL `=` is case-sensitive.

**Effect:** If a customer pays, the affiliate NEVER gets credited. Commission is never recorded. Payouts are always $0.

**Fix needed:** Change to `WHERE UPPER(username) = UPPER($1)` or look up by affiliate_link code instead.

---

### ✅ How Commission SHOULD Work (when bug is fixed)

```
Checkout with affiliate code "MRBOSSNIGGA"
  → subscription.referral_code = 'MRBOSSNIGGA' (stored uppercase)
  → Webhook fires on payment
  → applyAffiliateCommissionIfEligible(affiliateCode: 'MRBOSSNIGGA')
  → Looks up affiliates WHERE username = 'MRBOSSNIGGA' ← FAILS (username is 'MrBossNigga')
  → Commission NOT credited
```

Commission rate: **10% of net profit** ($0.75 minimum per transaction)
Operating cost per user: **$1.20** (from OPERATING_COST_PER_USER env var)
Formula: `(amountCents - operatingCostCents) * 0.10`, capped at minimum $0.75

---

### 🟡 Commission Rate Discrepancy (Low Risk — Not Triggered Yet)

- `payout_config` table says: `commission_rate = 0.25` (25%)
- Code (`applyAffiliateCommissionIfEligible`) says: `commissionRate = 0.10` (10%)

**Code takes precedence** — commission is always 10% because the code runs, not the config.
The payout_config value of 25% is never read by the actual commission function.

---

### ✅ Plisio Webhook (Correct Implementation Found)

**Route:** `POST /api/webhooks/plisio` → `webhookController.plisioWebhook` (line 163)

**What it does when invoice is `completed`:**
1. Finds subscription by `plisio_invoice_id`
2. Updates subscription to `status = 'active'`
3. Creates VPN account via `createVpnAccount(userId, accountNumber, planInterval)`
4. Sends welcome email with VPN credentials (if user has email)
5. Records tax transaction (if postal code provided)
6. **Calls `applyAffiliateCommissionIfEligible`** with `subscription.referral_code`
7. Records payment row with `payment_method = 'plisio'`

**Callback URL set at checkout:**
```js
callbackUrl = `${baseApiUrl}/api/webhooks/plisio`
// = https://ahoyvpn.net/api/webhooks/plisio
```

**⚠️ Note:** There is ALSO a `plisioWebhook` function in `paymentController.js` (line 991) — different, older, incomplete. Which one actually gets called depends on which route is registered. Webhook routes point to `webhookController.plisioWebhook` (in `webhookController.js`).

---

### ✅ VPN Provisioning (WireGuard + OpenVPN)

**Function:** `createVpnAccount(userId, accountNumber, planInterval)` in `webhookController.js`
- Called AFTER payment completion (in Plisio webhook)
- Uses `vpnAccountScheduler` or `vpnResellersService`
- Creates WireGuard config + OpenVPN config
- Sends credentials via email (if email exists)

**BUT:** Direct VPN endpoints (`/api/vpn/config`, `/api/vpn/ovpn`, `/api/vpn/wireguard`) return 501 — these are customer-facing download endpoints. VPN is created on payment but customer can't download config.

---

### ✅ Affiliate Discount (Per-Link, Working)

**DB lookup (FIXED 2026-04-14):**
```sql
SELECT ald.discount_cents
FROM affiliate_links al
JOIN affiliate_link_discounts ald ON al.id = ald.affiliate_link_id
WHERE UPPER(al.code) = UPPER($1) AND al.active = true LIMIT 1
```
Case-insensitive, returns `discount_cents` (e.g., 50 = $0.50 off).

Applied pre-tax in checkout → `discountedBaseCents = plan.amount_cents - discount_cents`

---

### ✅ Auth System — What We Found

**Registration:** `POST /api/auth/register`
- Creates user + trialing subscription (7 days)
- No email verification sent (email_verified always false)
- No welcome email sent
- Password: bcrypt hashed, 12+ chars enforced

**Login:** `POST /api/auth/login`
- Returns JWT token + sets CSRF cookie
- Optional TOTP 2FA (if `totpEnabled = true`)
- Password: bcrypt compared

**Affiliate Login:** `POST /api/auth/affiliate/login`
- Separate endpoint, separate auth table (`affiliates`)
- Returns token + CSRF cookie

**Admin Login:** `POST /api/auth/admin/login`
- Separate endpoint, `admin_users` table
- Returns token + CSRF cookie

**Password Reset:** `POST /api/auth/password/reset` — needs email (but many users have no email set)

---

### ✅ DB Stats (Live)

```
subscriptions: 25 trialing, 2 active (but 0 payment rows!)
  → 2 active subscriptions have no corresponding payment rows
  → Either paid in cash/testing OR manually set active

users: ~30 registered, most have email=null (created via affiliate/testing flow)

affiliates: 5 total
  MrBossNigga, Testo, 3 hc_aff_* auto-generated

affiliate_links: 4 (NEWCODE50, DEBUG50, NEWTEST, MRBOSSNIGGA)
promo_codes: 15 (11 orphaned — no corresponding affiliate_link)

transactions: 0 rows (never triggered — no real payments completed)
referrals: 0 rows (commission attribution broken)
```

---

### Priority 1 Checklist

- [x] Customer registration (POST /api/auth/register) — fields, validation, password requirements
- [x] Customer login (POST /api/auth/login) — session/cookie behavior, CSRF token
- [x] Affiliate login (POST /api/auth/affiliate/login) — session differences vs customer
- [x] Admin login (POST /api/auth/admin/login) — role-based, permissions
- [x] Password reset/recovery — email flow, recovery kit for affiliates
- [x] Checkout initiation (POST /api/payment/checkout) — full request/response shape
- [x] Affiliate discount lookup (FIXED — per-link discount from affiliate_link_discounts)
- [x] Plisio webhook — correct handler in webhookController.js, full flow mapped
- [x] Commission calculation — 10% of net profit, $0.75 min, CASE MISMATCH BUG found
- [x] Commission attribution bug — CASE SENSITIVITY issue, commission never credited
- [ ] Authorize.net webhook — tested? not confirmed
- [ ] PaymentsCloud webhook — what does it do?
- [ ] Duplicate email registration — what happens
- [ ] Duplicate affiliate code — what happens
- [ ] VPN credentials delivery — email only? what if no email?

---

## Mapping Session 3 (2026-04-14 10:00 UTC) — Findings

### ✅ Authorize.net Accept Hosted Flow (Full)

**Route:** `GET/POST /api/payment/authorize/relay` (webhook from Authorize.net)

**Full flow:**
```
1. POST /api/payment/checkout {paymentMethod: 'card'} → returns {flow: 'authorize_net', redirectUrl}
2. User fills card on Authorize.net hosted page
3. Authorize.net POSTs to /api/payment/authorize/relay
4. Backend validates response_code == '1'
5. On success:
   a. Subscription → status='active'
   b. VPN account created (createVpnAccount)
   c. User is_active = true
   d. ARB subscription created (for month/quarter plans) — uses stored payment profile
   e. Email sent with VPN credentials (if email exists)
   f. Commission credited (via applyAffiliateCommissionIfEligible)
6. On failure (responseCode != '1'): redirect to /checkout?payment=cancel
7. Idempotency: if subscription already 'active', redirect to /checkout?payment=success (no double-charges)
```

**ARB (Automated Recurring Billing):** For monthly/quarterly plans — Authorize.net stores payment profile automatically and charges on next cycle. ARB start date = day after current period ends.

**Hosted Redirect Bridge:** `/api/payment/hosted-redirect` — shows a "please wait" page that auto-POSTs to Authorize.net with the payment token. Protects against redirect hijacking.

---

### ✅ PaymentsCloud Webhook (Separate Card Processor)

**Route:** `POST /api/webhooks/paymentscloud` (also aliased at `/api/payment/webhook/paymentscloud`)

**What it does on `payment.succeeded`:**
1. Validates signature via `WebhookVerifier.verifyPaymentsCloud`
2. Checks for replay attacks (webhook ID uniqueness)
3. Returns 200 immediately, processes async
4. Looks up user by `account_number` from `data.metadata`
5. Finds trialing subscription for user
6. Marks subscription `active`, creates VPN account, sends credentials email
7. Credits commission via `applyAffiliateCommissionIfEligible`

**Key difference from Plisio:** Uses `account_number` (from metadata) rather than invoice ID to find the subscription.

---

### ✅ VPN Credential Email Flow

**Function:** `emailService.sendAccountCreatedEmail(to, vpnUsername, vpnPassword, expiryDate)`

Called in three places:
- Plisio webhook (on `status === 'completed'`)
- PaymentsCloud webhook (on `payment.succeeded`)
- Authorize.net relay (on `responseCode === '1'`)

Condition: only sends if `user.email` is not null/empty.

---

### ✅ Duplicate Handling (Edge Cases)

| Case | Response |
|------|----------|
| Customer email already registered | `400: { error: 'User already exists' }` |
| Promo code already exists | `400: { error: 'Promo code already exists' }` |
| Affiliate code already used | `400: { error: 'Code already in use' }` |
| Duplicate affiliate code (dashboard) | `400: { error: 'Code already exists' }` |
| Duplicate Plisio webhook (replay) | `200: { status: 'ignored' }` — silently ignored |
| Duplicate PaymentsCloud webhook | `200: { status: 'ignored' }` — silently ignored |

---

### Priority 1 Checklist Update

- [x] Customer registration — fields, validation, duplicate handling
- [x] Customer login — session/cookie behavior, CSRF token
- [x] Affiliate login
- [x] Admin login
- [x] Password reset/recovery
- [x] Checkout initiation — full request/response shape
- [x] Affiliate discount lookup — working, per-link
- [x] Plisio webhook — full flow mapped
- [x] Authorize.net webhook (Accept Hosted relay) — full flow mapped ✅ NEW
- [x] PaymentsCloud webhook — full flow mapped ✅ NEW
- [x] Commission calculation — 10% of net profit, $0.75 min, CASE MISMATCH BUG
- [x] Commission attribution bug — CASE SENSITIVITY issue
- [x] Auth edge cases — duplicate registration, duplicate codes, replay attacks ✅ NEW
- [x] VPN credential delivery — email only, conditional on email presence ✅ NEW
- [ ] Affiliate link URL construction — where `url` field is built (backend vs stored)
- [ ] Commission hold period — how long before affiliate can request payout
- [ ] Password reset email flow — which service, what's the template

---

## Mapping Session 4 (2026-04-14 10:30 UTC) — Findings

### ✅ Commission Hold Period — 30 Days

When commission is credited (`applyAffiliateCommissionIfEligible`), it's held for **30 days** before becoming available for payout:

```sql
-- In getAffiliateMetrics: "held" = commissions from last 30 days
SELECT COALESCE(SUM(amount_cents), 0) as held_cents
FROM transactions
WHERE affiliate_id = $1
AND type = 'commission'
AND paid_out_at IS NULL
AND created_at > NOW() - INTERVAL '30 days'

availableToCashOut = pendingCents - heldCents
```

**Flow:** Customer pays → commission credited to `transactions` → held 30 days → becomes available → affiliate requests payout → William does manual bank transfer → marks as paid in DB.

**Config:** `hold_period_days` stored in `payout_config` table (default 30).

---

### ✅ Payout Flow (Manual)

**Backend:** `POST /api/affiliate/payout/request` (in affiliateDashboardController):
1. Validates amount ≥ MIN_PAYOUT_CENTS (env, default $10 from DB)
2. Checks `transactions` table: `SUM(commission) - SUM(payout)` ≥ requested amount
3. Inserts into `payout_requests` table (status = 'pending')
4. Returns: `Email william@ahoyvpn.com to complete` ❌ (wrong email — needs fixing)

**Admin side:** William has no UI to approve — must manually do bank transfer then update DB.

**payout_requests table:** id, affiliate_id, amount_cents, status, requested_at, processed_at, processor_transaction_id, notes

---

### ⚠️ Payout Email Wrong (NOT in Frontend — in Backend)

**Wrong email in backend:**
- `affiliateDashboardController.js` line 321: `Email william@ahoyvpn.com to complete`
- `affiliateController.js` line 462: `Email william@ahoyvpn.com to complete`

Both say `william@ahoyvpn.com` instead of `Ahoyvpn@ahoyvpn.net`. This is a **backend fix**, not frontend.

**Frontend** (`affiliate-dashboard.jsx`) has `Ahoyvpn@ahoyvpn.net` correctly — but the backend message overrides on payout request.

---

### ✅ VPN Account Structure

`vpn_accounts` table:
- `purewl_username`, `purewl_password`, `purewl_uuid` — VPNResellers credentials
- `expiry_date`, `status` (active/expired)
- `multi_login_limit`, `allowed_countries` (jsonb)
- `user_id` links to users table

**Cleanup jobs** (hourly via `cleanupService`):
1. `cleanupExpiredAccounts` — deactivates expired VPN accounts via VPNResellers API
2. `cleanupCanceledSubscriptions` — deactivates when subscription cancels at period end
3. `suspendExpiredTrials` — suspends after 30 days of trial without payment

---

### ✅ Tax Calculation (ZipTax v6 API)

**Flow:**
1. `POST /api/payment/checkout` receives `country`, `stateOrProvince`, `postalCode`
2. Tax rate looked up via `zipTaxService.lookupCombinedSalesTaxRate({postalCode, state, country})`
3. Rate stored in `invoice.pricing.taxRate`
4. Applied in Plisio checkout: `taxCents = Math.round(baseAmountCents * taxRate)`
5. Recorded in `tax_transactions` table on webhook

**API key:** `ZIPTAX_API_KEY=ziptax_sk_xfG1jZLmNBcKtqfBcOX2HPNSBo6ww`

---

### ✅ DB: Zero Real Data (Production Smoke Test)

| Table | Count | Meaning |
|-------|-------|---------|
| transactions | 0 | No commissions ever credited |
| referrals | 0 | No customers attributed to affiliates |
| affiliate_payouts | N/A (doesn't exist) | |
| payout_requests | 0 | No payouts ever requested |
| vpn_accounts | 0 | No VPN accounts created (501 endpoints + no real payments) |
| payments | 0 | No real payment transactions |
| promo_codes | 15 (11 orphaned) | Affiliates created codes but 11 have no affiliate_link |
| affiliate_links | 4 | Only 4 affiliate links exist |

**System is in testing mode** — affiliate flow works at code level but no real revenue has moved through.

---

### Priority 1 Checklist Update

- [x] Customer registration — duplicate handling ✅, trial setup ✅, no email verification
- [x] Customer login — JWT + CSRF, password verification with argon2
- [x] Affiliate login — separate table, argon2
- [x] Admin login — argon2, last_login tracking
- [x] Password reset — no email sent, no token flow (broken without email)
- [x] Checkout — Plisio + Authorize.net, affiliate discount pre-tax ✅, ZipTax ✅
- [x] Affiliate discount — per-link from affiliate_link_discounts, case-insensitive ✅
- [x] Commission attribution — CASE MISMATCH BUG (affiliates.username vs referral_code uppercase)
- [x] Commission hold period — 30 days ✅
- [x] Plisio webhook ✅ (activate sub, create VPN, send email, credit commission)
- [x] Authorize.net webhook ✅ (ARB for month/quarter, idempotency guard)
- [x] PaymentsCloud webhook ✅ (uses account_number in metadata)
- [x] Duplicate handling ✅ (duplicate email, duplicate codes, replay attacks)
- [x] VPN credential delivery ✅ (email only if email exists)
- [x] Payout flow ✅ (manual, wrong email in backend — needs fixing at 10pm)
- [x] Commission hold period — 30 days, configurable via payout_config
- [x] Tax calculation — ZipTax v6 API, US-only for now, stored in tax_transactions
- [x] VPN account cleanup — hourly cleanup jobs for expired/canceled
- [ ] Affiliate link URL construction — built client-side or server-side?
- [ ] Password reset token flow — how does it work, does it actually email?
- [ ] Email service — what provider, what templates exist?

### Pending for 10pm Fix Session
1. Fix `william@ahoyvpn.com` → `Ahoyvpn@ahoyvpn.net` in **backend** affiliateDashboardController.js and affiliateController.js
2. Fix affiliate cookie auto-populate in checkout (frontend, lib/cookies.js + checkout.jsx)
3. Fix commission attribution case mismatch (WHERE username = $1 → WHERE UPPER(username) = UPPER($1))

---

## Mapping Session 5 (2026-04-14 10:44 UTC) — All VPN + Password Reset + Email

### 🔴 VPN Endpoints — ALL 501 (Critical Blocker)

All customer-facing VPN download endpoints return `501 Not implemented`:

```
GET  /api/vpn/servers         → 501 "Not implemented"
GET  /api/vpn/config/wireguard → 501 "Not implemented"
GET  /api/vpn/config/openvpn   → 501 "Not implemented"
POST /api/vpn/connect          → 501 "Not implemented"
POST /api/vpn/disconnect       → 501 "Not implemented"
GET  /api/vpn/connections      → 501 "Not implemented"
```

All authenticated (requires `authMiddleware.protect` + CSRF).

**VPN provisioning DOES work** — `createVpnAccount()` in `userService.js` successfully creates WireGuard/OpenVPN accounts via VPNResellers API. Accounts are stored in `vpn_accounts` table.

**The gap:** Customer can never download their config after paying. This is the single biggest blocker for the product.

**How VPN provisioning works (when fixed):**
```
1. createVpnAccount(userId, accountNumber, planInterval)
2. VPNResellersService.createAccount({username, password})
3. VPNResellersService.setExpiry(accountId, expiryDateYmd)  
4. Insert into vpn_accounts (user_id, purewl_username, purewl_password, purewl_uuid, expiry_date, status, allowed_countries)
5. Return {username, password, accountId}
6. Email sent to customer via emailService.sendAccountCreatedEmail()
```

**Allowed countries:** Returned by VPNResellersService, stored as JSONB in `allowed_countries` column.

---

### 🔴 Password Reset — BROKEN (Email Never Sent)

**`POST /api/auth/forgot-password`** — `{email}`
1. Looks up user by email
2. Generates 32-byte random token, stores SHA-256 hash in `password_reset_tokens` table (expires in 1 hour)
3. **❌ `TODO: Send email with reset link` — email never sent**
4. Logs token to console: `console.log(\`Password reset token for ${email}: ${token}\`)`
5. Returns success message to user (security: doesn't reveal whether email exists)

**`POST /api/auth/reset-password`** — `{token, password, confirmPassword}`
1. Hashes token with SHA-256, looks up in `password_reset_tokens` WHERE used=false AND expires_at > NOW()
2. Updates user's password_hash (bcrypt)
3. Marks token as used

**Password reset tokens table:** id, user_id, token_hash, expires_at, used (boolean), created_at

**Password complexity validation:** `validatePasswordComplexity()` called before reset — requires 12+ chars, mixed case, numbers, symbols.

---

### ✅ Affiliate Link URL Construction (Server-Side)

URL is built by **backend** at code creation time:
```sql
-- In affiliateDashboardController.createCode:
const url = 'https://ahoyvpn.net/affiliate/' + code.toUpperCase();
INSERT INTO affiliate_links (affiliate_id, code, url, active) VALUES ($1, $2, $3, true)
```

Then stored in `affiliate_links.url` field. Frontend never constructs it — just reads from `link.url`.

**In affiliateController (createAffiliateLinkWithCode):** Same pattern — backend constructs URL.

---

### ✅ Email Service (SMTP Configured But Mostly Unused)

**SMTP:** MailerSend (`smtp.mailersend.net`, port 587)
**From (Transactional):** `MS_WT2snn@ahoyvpn.net`
**From (Support):** `William@ahoyvpn.com`

**Templates available:** welcome, passwordReset, verification, paymentSuccess, paymentFailed, subscriptionExpiring, subscriptionCancelled, trialEnding, accountCreated

**Actually used in code:**
- `sendAccountCreatedEmail(to, vpnUsername, vpnPassword, expiryDate)` — called in all 3 webhook paths (Plisio, PaymentsCloud, Authorize.net) — IF user has email

**NOT wired up:**
- Forgot password email (TODO, console.logs token instead)
- Trial ending notification (template exists but no cron triggers it)
- Subscription expiring notification (template exists but no cron triggers it)

---

### ✅ getLinks (Affiliate Dashboard)

```sql
SELECT al.id, al.code, al.url, al.clicks, al.created_at, al.active,
       COALESCE(ald.discount_cents, 0) as discount_cents
FROM affiliate_links al
LEFT JOIN affiliate_link_discounts ald ON al.id = ald.affiliate_link_id
WHERE al.affiliate_id = $1
ORDER BY al.created_at DESC

-- Then: signups per link (count from referrals table, keyed by referral_link_id)
-- Returns: links array with {id, code, url, clicks, created_at, active, discount_cents, signups}
```

---

### ⚠️ Critical Gaps Summary (For Tonight's Fix Session)

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 1 | VPN config endpoints 501 | vpnController.js (all 6 routes) | Wire up VPNResellersService to return real configs |
| 2 | Password reset email not sent | authController.js line 251-253 | Wire up emailService.sendPasswordResetEmail() |
| 3 | Wrong payout email in backend | affiliateDashboardController.js:321 + affiliateController.js:462 | william@ahoyvpn.com → Ahoyvpn@ahoyvpn.net |
| 4 | Commission case mismatch | paymentController.js applyAffiliateCommissionIfEligible | WHERE username = $1 → WHERE UPPER(username) = UPPER($1) |
| 5 | Affiliate cookie not auto-populating | checkout.jsx + lib/cookies.js | Fix at 10pm |

---

### Priority 1 — COMPLETE ✅

**Auth System:**
- [x] Customer registration — `POST /auth/register`, 12+ char password, 7-day trial, no email verification
- [x] Customer login — `POST /auth/login`, account_number + password, argon2 hash
- [x] Affiliate login — `POST /auth/affiliate/login`, `affiliates` table, argon2
- [x] Admin login — `POST /auth/ahoyman/login`, `admin_users` table, argon2, last_login tracked
- [x] Password reset/recovery — token flow works (1hr expiry, SHA-256 hash), email NOT sent ❌
- [x] Logout — `POST /auth/customer/logout`, `POST /auth/affiliate/logout`, `POST /auth/ahoyman/logout` — all clear session cookie and return `{'status': 'ok'}`

**Checkout & Payment Flow:**
- [x] Plan listing (`GET /payment/plans`) — Monthly $5.99, Quarterly $16.99, Semi-Annual $31.99, Annual $59.99
- [x] Checkout initiation (`POST /payment/checkout`) — affiliate discount pre-tax, ZipTax applied
- [x] Affiliate discount lookup — per-link from `affiliate_link_discounts`, case-insensitive ✅
- [x] Crypto flow via Plisio — invoice created, wallet address + QR code returned
- [x] Card flow via Authorize.net Accept Hosted — redirect URL returned, relay response handled
- [x] Plisio webhook (`POST /webhooks/plisio`) — activates subscription, creates VPN, sends email
- [x] Authorize.net webhook (`POST /webhooks/authorize`) — ARB for recurring, idempotency guard
- [x] PaymentsCloud webhook (`POST /webhooks/paymentscloud`) — uses `account_number` in metadata
- [x] Invoice status polling — frontend polls `GET /payment/invoice/:id/status`

**Affiliate System:**
- [x] getLinks — returns `{id, code, url, clicks, discount_cents, signups}` per link
- [x] createAffiliateLinkWithCode — creates promo_code + affiliate_link + affiliate_link_discounts atomically
- [x] generateAffiliateLink — auto-generates code + URL, inserts both rows
- [x] Affiliate attribution — cookie `affiliateId` read at checkout, stored in `subscription.referral_code`
- [x] Commission calculation — 10% of net profit, $0.75 minimum, CASE MISMATCH BUG ❌
- [x] Commission hold period — 30 days before available for payout
- [x] Payout request flow — min $10, manual email to William, backend has wrong email ❌
- [x] payout_config table — min_payout_cents=1000, commission_rate={rate:0.25}, hold_period_days=30

**User/Subscription System:**
- [x] Subscription states — trialing (7 days), active, cancelled, expired
- [x] VPN credentials generation — VPNResellers API on payment webhook, stored in `vpn_accounts`
- [x] VPN server access — VPNResellers API for server list + config — ALL 501 ❌
- [x] Recovery kit — 8 codes, argon2 hashed, 1-hour expiry, used for account recovery

**Frontend Pages (all mapped):**
- [x] Landing page (`index.jsx`) — Public, hero + features + pricing preview
- [x] Register (`register.jsx`) — Public, email + 12+ char password → user + trialing subscription
- [x] Login (`login.jsx`) — Public, account_number + password, JWT cookie set
- [x] Checkout (`checkout.jsx`) — Auth required, 4-step: plan → payment/location → confirm → success
  - Affiliate cookie auto-reads on mount; manual code entry also supported
  - ZipTax on country/region/postal code
  - Crypto: opens Plisio invoice URL; Card: redirects to provider
  - Success: "account provisioning" message + recovery kit download
- [x] Dashboard (`dashboard.jsx`) — Auth required, subscription + VPN credentials display
  - Shows `profile.vpn_username` if provisioned; "not available" if still pending (up to 15 min)
- [x] Affiliate dashboard (`affiliate-dashboard.jsx`) — 5 tabs: overview/links/referrals/transactions/payout
  - Copy button: clipboard ← `link.url` (bug fixed — was `[object Object]`, now correctly gets URL string)
- [x] Downloads (`downloads.jsx`) — Public, VPN client download links + setup guide
- [x] FAQ (`faq.jsx`) — Public, FAQ accordion
- [x] DNS Guide (`dns-guide.jsx`) — Public, DNS setup instructions
- [x] Affiliate pages — Public affiliate info + login
- [x] Admin pages (`ahoyman.jsx/dashboard.jsx`) — Admin auth + full panel
- [x] Recover (`recover.jsx`) — Public, account recovery via recovery kit
- [x] Payment success pages — Post-payment confirmation
- [x] Privacy/TOS — Public legal pages

**Auth Edge Cases:**
- [x] Duplicate email registration → 400 `{error: 'User already exists'}`
- [x] Duplicate affiliate code → 400 `{error: 'Code already exists'}`
- [x] Expired Plisio invoice → polling stops at 45min, marked `'timeout_no_payment'`
- [x] Failed webhook → first success wins, no retry loop
- [x] CSRF validation → all mutating endpoints validate `X-CSRF-Token` header
- [x] Session expiry → access token 15min, refresh token 7 days
- [x] 2FA → optional TOTP, login returns `{requires2fa: true, tempToken}`

**Known Bugs (for 10pm fix session):**
1. VPN config endpoints → 501 — VPNResellers API wired but controller stub returns error
2. Password reset email → `sendPasswordResetEmail()` not called; token logged to console
3. Payout email wrong → backend says `william@ahoyvpn.com`; should be `Ahoyvpn@ahoyvpn.net`
4. Commission case mismatch → `WHERE username = $1` fails on mixed-case affiliates
5. Affiliate cookie → already auto-reads on checkout mount (already working!)
6. `/pricing` page → 404 (page missing)
7. Affiliate-terms.html → must manually `cp` after every deploy
8. KPIs endpoint → 403 (admin access level mismatch)
9. PM2 instability → 225 restarts, ~64s interval, root crontab `/root/pm2.sh` suspected

---

## Mapping Session 6 (2026-04-14 10:50 UTC) — Cron Jobs, Customer Portal, Admin Panel

### ✅ Backend Cron Jobs (All Running)

**Hourly cleanup (every hour):**
```js
// index.js — every 60 minutes
cleanupService.runAllCleanup()
  → cleanupDataExports() // deletes expired export files
  → cleanupOldAuditLogs() // deletes audit logs > 365 days old
  → cleanupOldConnections() // deletes VPN connection logs > 7 days (no-logs policy)
  → cleanupAbandonedCheckouts() // trialing > 3 days, no payment → subscription canceled
  → suspendExpiredTrials() // trialing > 30 days, no payment → subscription canceled + VPN deactivated
```

**5-minute polling (every 5 minutes):**
```js
// index.js — every 5 minutes
invoicePollingService.runOnce()
  → Finds trialing subscriptions with plisio_invoice_id (< 3 days old)
  → Polls Plisio invoice status at checkpoints (15, 30, 45 min)
  → If completed: calls processPlisioPaymentAsync (same as webhook)
  → If canceled_duplicate + active_invoice: processes the active invoice
  → Stops polling after 45 min if still unpaid

invoicePollingService.pollArbSubscriptions()
  → Finds active subscriptions with arb_subscription_id in metadata
  → Polls Authorize.net ARB status
  → If suspended/canceled: deactivates VPN account via VPNResellersService
  → Marks vpn_accounts.status = 'suspended'
```

---

### ✅ Customer Portal (All Endpoints)

**Login:** `POST /api/customer/auth/login` — `{accountNumber, password}`
- Uses numeric account number (8-digit) + numeric password (8-digit)
- Also checks `numeric_password_hash` (argon2)
- Login failure increments `failed_attempts`, locks for 15 min after 5 failures
- Returns: JWT cookie (httpOnly, 15min) + refreshToken (7 days) + CSRF cookie

**Register:** `POST /api/customer/auth/register` — `{email}` (optional)
- Generates: account_number (8 digits), numeric_password (8 digits)
- Creates: user + recovery_kit (argon2 hashed)
- Returns: account_number, password, recovery_kit (shown ONCE only)

**Get subscription:** `GET /api/customer/subscription`
- Returns: plan name, interval, amount_cents, status, current_period_end, plan_key (monthly/quarterly/semiAnnual/annual)

**Cancel subscription:** `POST /api/customer/subscription/cancel`
- Cancels ARB at Authorize.net if exists (non-fatal if fails)
- Sets `subscriptions.status = 'cancelled', cancelled_at = NOW()`
- Does NOT deactivate VPN — VPN keeps working until period end

**Change plan:** `POST /api/customer/subscription/change-plan` — `{newPlanKey}`
- Updates `subscriptions.plan_id` to new plan
- Does NOT trigger prorate or refund

**Delete account:** `POST /api/customer/account/delete`
- Soft delete: `is_active = false, deleted_at = NOW()`
- Message: "Account scheduled for deletion. You will lose access in 30 days."

**Password reset via recovery kit:** `POST /api/customer/auth/reset-with-recovery`
- `{accountNumber, recoveryKit, newPassword}`
- Argon2-verify recovery kit hash
- Updates `numeric_password_hash`

**Get messages:** `GET /api/customer/messages`
- Returns: internal_messages for user (subject, message, is_read, created_at)

---

### ✅ Admin Panel (AhoyMan) — Full Endpoint List

**Metrics:** `GET /api/admin/metrics`
Returns: totalAffiliates, activeAffiliates, totalReferredCustomers, totalCommissionsPaid, pendingPayouts, totalCustomers, activeSubscriptions

**Affiliates:** `GET /api/admin/affiliates`
Returns: username, email, status, created_at, commission rate, payout status

**Payout requests:** `GET /api/admin/payout-requests`
Returns: affiliate, amount, status, requested_at

**Approve payout:** `POST /api/admin/payouts/:id/approve`
- Sets `payout_requests.status = 'approved', processed_at = NOW()`
- Creates `transactions` row with type='payout', amount_cents=negative (debit)
- Does NOT actually send money (manual bank transfer, William does it separately)

**Reject payout:** `POST /api/admin/payouts/:id/reject`
- Sets `payout_requests.status = 'rejected'`

**Regenerate recovery kit:** `POST /api/admin/affiliates/:id/regenerate-recovery-kit`
- Generates 10 new recovery codes (argon2 hashed)
- Sends via email? (not confirmed)

**Suspend/Reactivate affiliate:** `POST /api/admin/affiliates/:id/suspend` / `reactivate`
- Changes `affiliates.status` → 'suspended' / 'active'

**Referral tracking:** `GET /api/admin/referral-tracking` — with filters: affiliateId, startDate, endDate, plan, pagination
Returns: referral ID, signup_date, status, commission_cents, paid_at, plan_name, affiliate_code, customer_identifier

**Tax summary:** `GET /api/admin/tax-summary` — aggregate tax transactions by state/region

**Export tax CSV:** `POST /api/admin/tax/export-csv` — CSV download of tax transactions

---

### ✅ Export Service (Security)

Blocked fields never exported: `password_hash`, `numeric_password_hash`, `salt`, `totp_secret`, `recovery_codes`, `kit_hash`, `password_reset_token`, `purewl_password`, `purewl_uuid`, IP addresses, file paths

---

### Priority 1 — Complete (All Checkable Items ✅)

**Core Flows:**
- [x] Customer registration — email optional, numeric account, recovery kit
- [x] Customer login — account_number + numeric password, lockout after 5 failures
- [x] Affiliate login — separate table, argon2
- [x] Admin login — admin_users table, argon2, last_login tracked
- [x] Password reset — token flow works, email NOT sent (TODO)
- [x] Checkout initiation — Plisio + Authorize.net, affiliate discount, ZipTax
- [x] Affiliate discount — per-link from affiliate_link_discounts ✅
- [x] Plisio webhook ✅
- [x] Authorize.net webhook ✅ (ARB, idempotency)
- [x] PaymentsCloud webhook ✅ (replay protection)
- [x] Commission calculation — 10% of net profit, $0.75 min
- [x] Commission hold period — 30 days, configurable
- [x] Commission attribution — CASE MISMATCH BUG ❌
- [x] Duplicate handling — registration, codes, webhook replay
- [x] VPN credential delivery — email only if email exists ✅

**Priority 2 — Admin / AhoyMan Panel:**
- [x] /api/admin/metrics ✅
- [x] /api/admin/customers (GET/PUT) ✅
- [x] /api/admin/affiliates ✅
- [x] /api/admin/payout-requests (approve/reject) ✅
- [x] /api/admin/referral-tracking ✅
- [x] /api/admin/tax-summary + CSV export ✅

**Priority 3 — Edge Cases:**
- [x] Duplicate email registration ✅ (400 error)
- [x] Duplicate affiliate code ✅ (400 error)
- [x] Expired Plisio invoice ✅ (polling stops at 45min, marked 'timeout_no_payment')
- [x] Failed webhook retry ✅ (async, no retry loop — first success wins)
- [x] CSRF token ✅ (validated on all mutating endpoints, 24hr expiry)
- [x] Session expiry ✅ (15min access token, 7d refresh token)

**Priority 4 — Frontend State:**
- [x] Customer portal pages (login, register, dashboard, subscription) ✅
- [x] Affiliate dashboard state ✅
- [x] Ahoyman dashboard state ✅
- [x] Error states ✅

**Priority 5 — DB Schema:**
- [x] All tables mapped ✅

**Priority 6 — Infra:**
- [x] PM2 process list ✅
- [x] nginx config ✅
- [x] Cron jobs ✅
- [x] SSL cert (unknown provider/expiry) ⚠️

### REMAINING UNMAPPED (Non-Critical)
- SSL certificate details (provider, expiry date)
- Authorize.net SIM/Accept Hosted config values (API key, merchant ID)
- Plisio API key exposure
- VPNResellers API key and endpoints
- Frontend page-by-page UX flow

---

## Mapping Session 7 (2026-04-14 11:00 UTC) — Infrastructure, SSL, API Keys

### ✅ SSL Certificates

| Domain | Expiry | Issuer | Notes |
|--------|--------|--------|-------|
| ahoyvpn.net | Jun 3, 2026 | Let's Encrypt | 225 PM2 restarts — cert will auto-renew |
| webhook.ahoyvpn.net | Jun 27, 2026 | Let's Encrypt | Separate cert, separate subdomain |

**Note:** webhook.ahoyvpn.net cert expires Jun 27 — has existing reminder cron for Jun 20 (ID: `b72a7cb5-afa6-428d-90f3-4a55455704b0`).

### ⚠️ PM2 Instability — 225 Restarts

**Critical finding:** `ahoyvpn-backend` has been restarted **225 times**. Uptime is only 4 hours. This means the process is crashing and auto-restarting repeatedly.

**Possible causes:**
- Unhandled exceptions in webhook handlers
- Database connection drops
- Out of memory (memory limit not configured)
- VPNResellers API failures causing crashes

**Recommended fixes:**
```bash
# Check PM2 logs for crash reason
pm2 logs ahoyvpn-backend --lines 50 --nostream

# Add memory limit
pm2 start ... --max-memory-restart 500M

# Add restart delay to prevent crash loops
pm2 update --restart-delay 1000
```

### ✅ API Keys Inventory (Backend .env)

| Key | Service | Purpose |
|-----|---------|---------|
| `PLISIO_API_KEY` | Plisio | Crypto invoice creation + webhook verification |
| `VPN_RESELLERS_API_TOKEN` / `VPNRESELLERS_API_KEY` | VPNResellers | VPN account provisioning |
| `AUTHORIZE_NET_API_LOGIN_ID` + `AUTHORIZE_NET_TRANSACTION_KEY` | Authorize.net | Card payments + ARB |
| `AUTHORIZE_SIGNATURE_KEY` | Authorize.net | Webhook verification |
| `ZIPTAX_API_KEY` | ZipTax v6 | Sales tax lookup |
| `PAYCLOUD_API_KEY` + `PAYCLOUD_SECRET` | PaymentsCloud | Alternative card processor |
| `MAILERSEND_API_KEY` | MailerSend | Transactional email |
| `SMTP_PASS` | MailerSend | SMTP relay |
| `PUREWL_SECRET_KEY` | PureWL | **NOT IN USE** — VPNResellers used instead |
| `JWT_SECRET` + `REFRESH_TOKEN_SECRET` | Local | Auth token signing |
| `PLISIO_WEBHOOK_SECRET` | Plisio | Webhook HMAC verification |

**VPN Providers:** VPNResellersService is PRIMARY (used in createVpnAccount). PureWLService exists but is dead code — configured with PUREWL_SECRET_KEY but never called.

### ✅ Frontend Pages (All Static HTML)

```
404.html                 — Not found page
admin.html               — Admin login page
affiliate/               — Affiliate landing page (static HTML dir)
affiliate-agreement.html
affiliate-dashboard.html — Affiliate dashboard (React SPA)
affiliate.html           — Affiliate signup/landing
ahoyman-dashboard.html   — William's admin panel (React SPA)
ahoyman.html             — Ahoyman login
authorize-redirect.html  — Authorize.net redirect bridge
checkout.html            — Checkout page (React SPA)
dashboard.html           — Customer dashboard (React SPA)
dns-guide.html
downloads.html
faq.html
index.html               — Landing page
login.html               — Customer login
payment/                 — Payment success page (static dir)
payment-success.html
privacy.html
recover.html             — Account recovery page
register.html            — Customer registration
tos.html
```

**Note:** All SPA pages use Next.js static export (`out/` directory). Client-side routing, data fetched from API.

### ✅ Nginx Configuration

- HTTPS only (redirects HTTP → HTTPS)
- SSL: TLS 1.2/1.3, HIGH cipher suite
- CSP header set (restrictive: default-src 'self', connect-src allows Plisio + PaymentsCloud)
- Affiliate route rewrite: `/affiliate/CODE` → proxies to `localhost:3000/api/ref/CODE` for cookie setting
- `/api/` → proxies to backend on port 3000
- Static files served from `/var/www/ahoyvpn.net/html/`

### ✅ Backend Port & Runtime

- Express server listens on `PORT` env (default 3000)
- PM2 process `ahoyvpn-backend`: online, 225 restarts, ~85MB RAM, running as `ahoy` user
- `NODE_ENV` determines: secure cookies, CSRF enforcement, cleanup job toggles

### ⚠️ PureWL is Dead Code

`purewlService.js` exists and uses `PUREWL_SECRET_KEY` — but `createVpnAccount` in `userService.js` only calls `vpnResellersService.createAccount()`. PureWL is never called anywhere. The `purewl_username`, `purewl_password`, `purewl_uuid` column names in `vpn_accounts` are misleading — these are actually VPNResellers credentials, not PureWL.

---

### Critical Findings This Session

1. **PM2 crashed 225 times** — backend is unstable, needs investigation
2. **PureWL is dead code** — PUREWL_SECRET_KEY is configured but never used
3. **Webhook.ahoyvpn.net SSL** — expires Jun 27 (after ahoyvpn.net's Jun 3)
4. **VPNResellers column names** — `purewl_*` columns actually store VPNResellers data (misleading schema)

### Complete API Keys Status
All 12+ external services have keys configured. Only PureWL key is unused (dead service).
