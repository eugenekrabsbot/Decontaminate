# AHOYVPN — One-Time Check Everything
> **Purpose:** Full verification of every checkable item across all 6 priorities.
> **Standard:** 100% pass required before production deployment.
> **Run on:** Staging environment (never on production without explicit green light).
> **Time est.:** 45–60 minutes full run. Selective sections can run independently.

---

## HOW TO RUN

Each phase below is independent. Run sections as needed:

```
PHASE 1 → Core Flows (auth, checkout, payment, affiliate)
PHASE 2 → Admin Panel (metrics, customer/affiliate management, payouts)
PHASE 3 → Edge Cases & Failure Modes
PHASE 4 → Frontend State & UI
PHASE 5 → Database Schema Integrity
PHASE 6 → Infrastructure & Ops (PM2, nginx, cron, SSL)
PHASE 7 → Known Bugs Verification (regression check)
PHASE 8 → Payment & VPN API Integration Verification
PHASE 9 → Security & Input Validation
PHASE 10 → Commission Math Verification
```

---

## PHASE 1: Core Flows

### 1.1 Auth System

- [ ] **Customer registration** → `POST /api/auth/register` with valid payload → 201, returns `{token, user}`
  - Test: 12+ char password accepted, shorter rejected with 400
  - Test: Duplicate email → 400 `{error: 'User already exists'}`
  - Test: Creates trialing subscription (7 days) in DB
  - Test: No welcome email sent (by design — no email verification)

- [ ] **Customer login** → `POST /api/auth/login` with `{account_number, password}` → 200, sets JWT cookie
  - Test: CSRF cookie set alongside JWT (`accessToken` httpOnly cookie)
  - Test: Wrong password → 401, no cookie set
  - Test: Non-existent account → 401

- [ ] **Affiliate login** → `POST /api/auth/affiliate/login` with `{username, password}` → 200, separate JWT
  - Test: CSRF cookie set
  - Test: Wrong credentials → 401

- [ ] **Admin login** → `POST /api/auth/admin/login` with `{username, password}` → 200, admin JWT
  - Test: CSRF cookie set
  - Test: Wrong credentials → 401

- [ ] **Logout** → `POST /api/auth/customer/logout` → clears cookie, returns `{'status': 'ok'}`
  - Test: Same for affiliate and admin logout endpoints

- [ ] **Password reset flow** → `POST /api/auth/forgot-password` with `{email}` → 200
  - Test: Email IS sent (not console.log anymore — PAID FIX REQUIRED)
  - Test: Token stored in `password_reset_tokens` table (SHA-256 hash)
  - Test: `POST /api/auth/reset-password` with valid token → password updated, token marked used
  - Test: Expired token (>1hr) → 400 error
  - Test: Used token → 400 error

### 1.2 Checkout & Payment Flow

- [ ] **Plan listing** → `GET /api/payment/plans` → 200, 4 plans with correct pricing
  - Expected: monthly=$5.99, quarterly=$16.99, semi-annual=$31.99, annual=$59.99

- [ ] **Checkout initiation (crypto)** → `POST /api/payment/checkout` with:
  ```json
  { "planId": "<uuid>", "paymentMethod": "crypto", "cryptoCurrency": "BTC" }
  ```
  - Test: Returns `{flow: 'crypto', invoice: {plisioInvoiceId, invoiceUrl, qrCodeUrl}}`
  - Test: Invoice created in Plisio (call `GET /api/payment/invoice/:id/status`)

- [ ] **Checkout initiation (card)** → `POST /api/payment/checkout` with:
  ```json
  { "planId": "<uuid>", "paymentMethod": "card" }
  ```
  - Test: Returns `{flow: 'authorize_net', redirectUrl}` (Accept Hosted redirect URL)

- [ ] **Affiliate discount at checkout** → `POST /api/payment/checkout` with `{planId, paymentMethod: 'crypto', affiliateId: 'MRBOSSNIGGA'}`
  - Test: Response `baseAmountCents` is reduced by `discount_cents` (case-insensitive match)
  - Test: Tax calculated on discounted amount (not pre-discount)
  - Test: Invalid/non-existent affiliate code → discount=0, no error thrown

- [ ] **Tax calculation (ZipTax)** → Checkout with `{country: 'US', stateOrProvince: 'PA', postalCode: '15417'}`
  - Test: `taxRate` returned in response (non-zero for valid US zip)
  - Test: `taxAmountCents` = `Math.round(baseAmountCents * taxRate)`

### 1.3 Payment Webhooks

- [ ] **Plisio webhook** → `POST /api/webhooks/plisio` with completed invoice payload
  - Test: Subscription activated (trialing → active)
  - Test: VPN account created via VPNResellersService
  - Test: `sendAccountCreatedEmail` called (if user has email)
  - Test: Commission credited to affiliate via `applyAffiliateCommissionIfEligible`
  - Test: Payment row created with `payment_method = 'plisio'`
  - Test: Duplicate webhook → 200 `{status: 'ignored'}` (replay protection)

- [ ] **Authorize.net relay** → `POST /api/payment/authorize/relay` with `responseCode=1`
  - Test: Subscription activated
  - Test: VPN account created
  - Test: ARB subscription created for month/quarter plans
  - Test: Commission credited
  - Test: Duplicate relay → redirected to success (idempotency, no double-charge)
  - Test: `responseCode != 1` → redirected to `/checkout?payment=cancel`

- [ ] **PaymentsCloud webhook** → `POST /api/webhooks/paymentscloud` with `payment.succeeded`
  - Test: Looks up user by `account_number` from metadata
  - Test: Subscription activated
  - Test: VPN account created
  - Test: Commission credited
  - Test: Replay protection (duplicate ignored)

### 1.4 Affiliate System

- [ ] **Create affiliate link with discount** → Login as affiliate, `POST /api/affiliate/links`
  - Test: Returns `{code, url, clicks: 0, discount_cents}` — correct structure
  - Test: `url` is `https://ahoyvpn.net/affiliate/CODE` (not `[object Object]`)
  - Test: Duplicate code → 400 `{error: 'Code already exists'}`
  - Test: Link appears in `GET /api/affiliate/links`

- [ ] **Copy link button** → On affiliate dashboard
  - Test: Clipboard contains valid URL (not `[object Object]`)
  - Test: `link.url` used, not `link` object itself

- [ ] **Affiliate cookie at checkout** → Visit `/affiliate/MRBOSSNIGGA` (or any valid code)
  - Test: `affiliateId` or `affiliate_code` cookie set in browser
  - Test: Checkout page auto-populates from cookie (not blank)
  - Test: Manual entry of affiliate code also works

- [ ] **Commission calculation** → After payment webhook fires
  - Test: Commission = 10% of `(amountCents - $1.20 operating cost)`, minimum $0.75
  - Test: Commission credited to correct affiliate (case-insensitive username lookup)
  - Test: Commission held 30 days before available for payout

- [ ] **Commission case mismatch (REGRESSION)** → Affiliate with mixed-case username (e.g., "MrBossNigga") gets commission credited
  - Test: `WHERE UPPER(username) = UPPER($1)` used in `applyAffiliateCommissionIfEligible`
  - Test: referral_code (uppercase) matches UPPERCASE affiliate username

- [ ] **Payout request** → `POST /api/affiliate/payout/request` with amount
  - Test: Below $10 → 400 with correct message (message references `Ahoyvpn@ahoyvpn.net`, NOT `william@ahoyvpn.com`)
  - Test: Above $10 → 200, creates `payout_requests` row with `status: 'pending'`
  - Test: Payout email says `Ahoyvpn@ahoyvpn.net` (backend, not `william@ahoyvpn.com`)

---

## PHASE 2: Admin Panel

- [ ] **Admin login** → `POST /api/auth/admin/login` → JWT + CSRF cookie
- [ ] **Metrics endpoint** → `GET /api/admin/metrics`
  - Returns: `{totalAffiliates, activeSubscriptions, totalCustomers, pendingPayouts, ...}`
  - Not 403 (access level mismatch — this was a known bug)
- [ ] **Customer list** → `GET /api/admin/customers` → paginated customer list
- [ ] **Suspend customer** → `POST /api/admin/customers/:id/suspend` → `is_active = false`
- [ ] **Delete customer** → `POST /api/admin/customers/:id/delete`
- [ ] **Affiliate list** → `GET /api/admin/affiliates` → affiliate list with commission rate
- [ ] **Approve payout** → `POST /api/admin/payouts/:id/approve`
  - Sets `payout_requests.status = 'approved'`
  - Creates `transactions` row with type='payout'
- [ ] **Reject payout** → `POST /api/admin/payouts/:id/reject`
- [ ] **Referral tracking** → `GET /api/admin/referral-tracking`
- [ ] **Tax summary** → `GET /api/admin/tax-summary`
- [ ] **Tax CSV export** → `POST /api/admin/tax/export-csv` → CSV download

---

## PHASE 3: Edge Cases & Failure Modes

- [ ] **Expired Plisio invoice** → After 45 minutes, invoice marked `'timeout_no_payment'`
  - Frontend stops polling at 45 min
- [ ] **Webhook first-success-wins** → If subscription already active from prior webhook, subsequent webhook is no-op
- [ ] **CSRF validation** → Mutating endpoint without `X-CSRF-Token` header → 403
  - GET/HEAD/OPTIONS exempt
- [ ] **Session expiry** → Access token expires after 15 min, refresh token after 7 days
- [ ] **2FA** → Login with TOTP-enabled account → `{requires2fa: true, tempToken}` response
- [ ] **Recovery kit** → `POST /api/customer/auth/reset-with-recovery` with valid kit → password reset works

---

## PHASE 4: Frontend State & UI

### Customer Pages
- [ ] **Register page** → Renders, submits to `/api/auth/register`, handles success/error
- [ ] **Login page** → Renders, submits to `/api/auth/login`, stores JWT cookie
- [ ] **Checkout page** → Auth required, 4-step flow, affiliate cookie auto-reads
  - Step 1: Plan selection
  - Step 2: Payment method (crypto/card)
  - Step 3: Tax info (ZipTax applied)
  - Step 4: Confirmation
- [ ] **Payment success** → `?payment=success` shows credentials inline (polls `/me` until VPN username appears)
- [ ] **Dashboard** → Shows subscription status + VPN credentials (or pending if not provisioned)
- [ ] **Downloads page** → Shows VPN client download links (currently 501 for config download — known bug)

### Affiliate Pages
- [ ] **Affiliate login** → Separate login page at `/affiliate`
- [ ] **Affiliate dashboard** → 5 tabs (overview/links/referrals/transactions/payout)
  - Copy button → valid URL string
  - Links table → shows `discount_cents` for all links
- [ ] **Create link flow** → Creates link + returns complete data (not partial object)

### Admin Pages
- [ ] **Ahoyman login** → Admin login page
- [ ] **Ahoyman dashboard** → Admin panel with metrics, customer/affiliate management
  - `/auth/ahoyman/metrics` called on load (not `/admin/metrics`)
  - Error interceptor → routes to `/ahoyman` React route (not `.html`)
- [ ] **KPIs endpoint** → `GET /api/admin/kpis` → returns 200 (was 403 — verify fix)

---

## PHASE 5: Database Schema Integrity

- [ ] **users table** — all required columns present, no orphaned records
- [ ] **subscriptions** — correct status transitions (trialing → active → cancelled/expired)
- [ ] **affiliates** — mixed-case usernames stored correctly
- [ ] **affiliate_links** — `url` field is constructed server-side and stored correctly
- [ ] **transactions** — commission rows credited with correct `affiliate_id` and `amount_cents`
- [ ] **referrals** — attribution by `referral_link_id` (not by code string)
- [ ] **payout_requests** — status transitions: pending → approved/rejected
- [ ] **vpn_accounts** — `purewl_*` columns store VPNResellers credentials (misleading but working)
- [ ] **promo_codes** — 11 orphaned codes (acceptable, not critical)
- [ ] **No N+1 queries** — affiliate metrics, admin lists use efficient joins

---

## PHASE 6: Infrastructure & Ops

- [ ] **PM2 process** → `pm2 list` shows `ahoyvpn-backend` online, memory < 500MB, restart count stable (not climbing)
- [ ] **PM2 autorestart** → enabled for unexpected exits, disabled for expected
- [ ] **Nginx** → `systemctl status nginx` → active (running)
- [ ] **Nginx HTTPS redirect** → HTTP → HTTPS redirect working
- [ ] **SSL cert** → `/api/payment/plans` serves over HTTPS, cert not expired
- [ ] **SSL cert expiry** → ahoyvpn.net expires Jun 3, 2026 (renewal cron in place)
- [ ] **Webhook SSL** → webhook.ahoyvpn.net cert expires Jun 27, 2026
- [ ] **Cron: backup** → `0 */3 * * *` runs `backup_users.js` every 3 hours, pushes to GitHub
- [ ] **Cron: cleanup** → Hourly cleanup jobs running (expired accounts, abandoned checkouts)
- [ ] **Cron: invoice polling** → Every 5 min, polls Plisio invoices and ARB subscriptions

---

## PHASE 7: Known Bugs Verification (Regression Check)

These were fixed on April 14 — verify they are NOT broken by any new changes:

- [ ] **adminMetrics duplicate** → `api/client.js` has single `adminMetrics` definition pointing to `/auth/ahoyman/metrics` (not `/admin/metrics`)
- [ ] **Error interceptor routes** → Routes to React routes (`/ahoyman`), not static HTML (`/ahoyman.html`)
- [ ] **Payout email backend** → `affiliateDashboardController.js` and `affiliateController.js` say `Ahoyvpn@ahoyvpn.net` (not `william@ahoyvpn.com`)
- [ ] **Commission case sensitivity** → `applyAffiliateCommissionIfEligible` uses `WHERE UPPER(username) = UPPER($1)`
- [ ] **Affiliate link copy** → Clipboard gets `link.url` string, not the link object
- [ ] **handleCreateCustomCode** → Calls `getAffiliateLinks()` after creation to get complete data
- [ ] **actionLoading scope** → AffiliatesTab has its own `actionLoading` state (not shared from parent)

---

## PHASE 8: Payment & VPN API Integration Verification

### Plisio
- [ ] Invoice creation → `POST https://plisio.net/api/v1/invoices` returns valid invoice
- [ ] Webhook signature → HMAC-SHA256 verification working
- [ ] Idempotency → Duplicate webhook returns `{status: 'ignored'}`
- [ ] Invoice status polling → `GET /api/payment/invoice/:id/status` returns correct status

### Authorize.net
- [ ] Accept Hosted redirect → Card checkout redirects to valid Authorize.net hosted page
- [ ] Relay response → Successful payment returns to `/checkout?payment=success`
- [ ] ARB creation → Monthly/quarterly plans create ARB subscription at Authorize.net
- [ ] Idempotency → Duplicate relay does not double-create VPN account

### PaymentsCloud
- [ ] Webhook → `payment.succeeded` event activates subscription
- [ ] Metadata lookup → User found by `account_number` in metadata

### ZipTax
- [ ] Tax rate lookup → Valid US zip returns combined rate (e.g., PA 15417 → ~6%)
- [ ] Invalid zip → Returns error or zero rate (graceful)
- [ ] Non-US → Returns 0% tax rate (no error)

### VPNResellers
- [ ] **VPN config download** → `GET /api/vpn/config/wireguard` returns valid WireGuard config (NOT 501)
- [ ] **VPN config OpenVPN** → `GET /api/vpn/config/openvpn` returns valid .ovpn file (NOT 501)
- [ ] **Server list** → `GET /api/vpn/servers` returns server list (NOT 501)
- [ ] **Account created on payment** → After webhook, `vpn_accounts` table has row for user

---

## PHASE 9: Security & Input Validation

- [ ] **SQL injection** → All user inputs parameterized (no string concatenation in queries)
- [ ] **XSS** → No reflected user input in responses without encoding
- [ ] **CSRF** → All mutating endpoints require `X-CSRF-Token` header
- [ ] **Auth bypass** → Unauthenticated requests to protected endpoints → 401
- [ ] **Input validation** → Joi schema validation on all POST/PUT endpoints
  - Invalid payloads → 400 with descriptive error
- [ ] **Rate limiting** → No brute force possible on login (5 failures → 15 min lockout)
- [ ] **Sensitive data export** → password_hash, totp_secret, purewl_password NEVER exported
- [ ] **Webhook signature** → Plisio, PaymentsCloud, Authorize.net signatures verified

---

## PHASE 10: Commission Math Verification

**Formula:** Commission = `(amountCents - operatingCostCents) * 0.10`, minimum $0.75

- [ ] **$5.99 monthly plan** → Commission = `(599 - 120) * 0.10 = $0.479` → capped at **$0.75**
- [ ] **$59.99 annual plan** → Commission = `(5999 - 120) * 0.10 = $5.879` → **$5.88** (no cap)
- [ ] **Sales tax excluded** → Commission calculated on net (after discount), not gross
  - $5.99 plan with 10% affiliate discount → base = $5.39, commission = `($5.39 - $1.20) * 0.10 = $0.419` → capped at **$0.75**
- [ ] **Operating cost per user** → `$1.20` from `OPERATING_COST_PER_USER` env var (not hardcoded)
- [ ] **Commission credited once per payment** → No double-credit on duplicate webhook
- [ ] **Affiliate can't self-refer** → If affiliate code used on affiliate's own signup, no commission credited (optional enhancement — not currently implemented)

---

## RESULTS LOG

After running, fill in:

```
DATE: _______________
STAGING URL: _______________

PHASE 1 — Core Flows:     ___/___ passed
PHASE 2 — Admin Panel:    ___/___ passed
PHASE 3 — Edge Cases:     ___/___ passed
PHASE 4 — Frontend State: ___/___ passed
PHASE 5 — DB Schema:      ___/___ passed
PHASE 6 — Infrastructure: ___/___ passed
PHASE 7 — Known Bugs:     ___/___ passed (REGRESSION)
PHASE 8 — API Integration:___/___ passed
PHASE 9 — Security:        ___/___ passed
PHASE 10 — Commission Math:___/___ passed

OVERALL: ___/___ = ___%

FAILURES:
1. ___________________________
2. ___________________________
3. ___________________________

PRODUCTION READY: YES / NO
```