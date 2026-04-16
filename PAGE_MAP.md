# AhoyVPN — Page Map & Feature Guide
> For the rebuild team. Each page documented: purpose, features, user flow, and backend API calls.
> **Stack:** Next.js (React SPA), Node.js/Express API backend, PostgreSQL, Plisio + Authorize.net + PaymentsCloud + ZipTax

---

## PUBLIC PAGES (no auth required)

---

### `/` — Landing Page
**Purpose:** Convert visitors into customers. Pirate/anti-corporate brand voice.

**Features:**
- Hero with plan cards (monthly/quarterly/semi-annual/annual)
- Price display with affiliate discount applied inline (cookie-reads `affiliateId`)
- VPN feature highlights
- FAQ section (collapsed accordions)
- Footer with links (privacy, terms, DNS guide, downloads)

**User Flow:** Land → select plan → redirected to `/checkout`

**API Calls:** None (static except affiliate cookie reading)

---

### `/login` — Customer Login
**Purpose:** Returning customer logs in to manage account.

**Features:**
- Login form: numeric account ID + password
- "Forgot account ID?" link → points to recovery info
- "Use Recovery Kit" link → routes to `/recover`
- Auth state stored in `localStorage.accessToken`
- On 401: redirects here; on success: redirects to `/dashboard`

**User Flow:** Login → `/dashboard`

**API Calls:**
- `POST /api/auth/login` → `{ accountNumber, password }`
- Returns: `{ token, user }`
- CSRF cookie set alongside JWT

---

### `/register` — Customer Registration
**Purpose:** New customer creates account. No email required.

**Features:**
- Password-only form (12+ char, complexity validated)
- Backend auto-generates 8-digit numeric account ID
- Creates trialing subscription (7 days, no payment yet)
- On success: auto-logs in + redirects to `/checkout`

**User Flow:** Register → auto-login → `/checkout`

**API Calls:**
- `POST /api/auth/register` → `{ password, confirmPassword }`
- Returns: `{ token, user: { accountNumber, id } }`
- Post-registration: `POST /api/auth/login` called automatically

---

### `/checkout` — Payment (4-step SPA)
**Purpose:** Convert trial user → paying customer. Most complex page.

**Features (4-step state machine):**

**Step 1 — Plan Selection:**
- Shows 4 plans with pricing
- Affiliate discount auto-read from `affiliateId` cookie
- Discount shown inline before tax

**Step 2 — Payment Method:**
- Toggle: Crypto or Card
- Crypto: select currency (BTC, ETH, LTC, etc. via Plisio)
- Card: triggers Authorize.net Accept Hosted redirect

**Step 3 — Tax Info (US only):**
- Country (dropdown), State, Postal Code
- ZipTax API called to get combined sales tax rate
- Tax shown separately, added to total

**Step 4 — Review & Confirm:**
- Shows plan, discount, tax, total
- "Pay Now" button triggers backend checkout

**On success (crypto):** Shows Plisio invoice URL + QR code, polls `GET /api/payment/invoice/:id/status` every 15s for up to 45min. On `completed` → redirect to `/payment/success`.

**On success (card):** Redirected back from Authorize.net → `/payment-success` page.

**On return with `?payment=success`:** Polls `GET /api/me` every 3 seconds for up to 2 minutes, shows VPN credentials inline once `vpn_username` appears.

**User Flow:** Choose plan → Pay → Return → See credentials

**API Calls:**
- `POST /api/payment/checkout` → `{ planId, paymentMethod, affiliateId?, cryptoCurrency?, country?, stateOrProvince?, postalCode? }`
- `GET /api/payment/invoice/:id/status` (polling, crypto only)
- `GET /api/me` (polling after payment success)
- `GET /api/subscription`

---

### `/payment/success` — Payment Success Page
**Purpose:** Fallback/relay page for card payments returning from Authorize.net.

**Features:**
- Static confirmation page
- Links to `/downloads` for VPN clients
- Links to `/dashboard` for credentials
- If query param `?payment=success` detected, polls for VPN credentials (same logic as checkout)

**API Calls:** `GET /api/me`, `GET /api/subscription` (if polling triggered)

---

### `/affiliate/[code]` — Affiliate Link Landing
**Purpose:** Sets affiliate cookie when user visits via affiliate link. Backend route `/api/ref/:code` sets `affiliateId` cookie.

**Features:**
- Reads `code` from URL, shows basic affiliate branding
- Redirects to `/checkout` with cookie already set
- Backend: `GET /api/ref/:code` → sets `affiliateId` cookie (httpOnly: false, secure, sameSite: strict)

**API Calls:** None on frontend — backend sets cookie server-side via nginx proxy

---

### `/affiliate` — Affiliate Login
**Purpose:** Existing affiliates log in to their dashboard.

**Features:**
- Username + password login (separate table from customers)
- Auth stored in `localStorage.affiliateToken`
- On success: redirects to `/affiliate-dashboard`
- "Forgot password?" → recovery code flow

**API Calls:**
- `POST /api/auth/affiliate/login` → `{ username, password }`

---

### `/affiliate-dashboard` — Affiliate Dashboard (5 tabs)
**Purpose:** Affiliates monitor their earnings, create links, request payouts.

**Features (5 tabs):**

**Overview Tab:**
- Metrics: total clicks, signups, earnings, available balance, held (30-day)
- Commission formula: 10% of net profit, $0.75 min, 30-day hold

**Links Tab:**
- Table: code, URL, clicks, discount ($), actions
- "Generate Link" button → auto-creates new link
- "Create Custom Code" → enter code + discount amount
- Copy button → copies `link.url` to clipboard
- Delete link button

**Referrals Tab:**
- Paginated table of referred customers
- Shows: date, username, plan, commission status

**Transactions Tab:**
- Paginated commission history
- Shows: date, amount, status (held/available/paid)

**Payout Tab:**
- Request payout (min $10)
- Shows: pending payout requests, payout history
- Email sent to `Ahoyvpn@ahoyvpn.net` on request

**API Calls:**
- `GET /api/affiliate/metrics`
- `GET /api/affiliate/links`
- `POST /api/affiliate/links`
- `POST /api/affiliate/codes` (create custom code)
- `DELETE /api/affiliate/codes/:id`
- `GET /api/affiliate/referrals?page=N`
- `GET /api/affiliate/transactions?page=N`
- `GET /api/affiliate/payout-requests`
- `POST /api/affiliate/request-payout`

---

### `/downloads` — VPN Client Downloads
**Purpose:** Customer downloads VPN software after paying.

**Features:**
- Platform list: Windows, macOS, Android, iOS
- Download links (links to external VPN client apps)
- Email: `help@ahoyvpn.com` for support

**API Calls:** None (static page)

---

### `/dns-guide` — DNS Configuration Guide
**Purpose:** Help customers configure VPN/DNS on their router/devices.

**Features:**
- Platform step-by-step guides (router, Windows, macOS, Android, iOS)
- Router section: covers most common router firmwares
- Static content page

**API Calls:** None

---

### `/faq` — Frequently Asked Questions
**Purpose:** Answer common customer questions, reduce support load.

**Features:**
- Accordion-style FAQ items
- Topics: account, payment, VPN, privacy, affiliate program

**API Calls:** None

---

### `/privacy` — Privacy Policy
**Static legal page**

### `/tos` — Terms of Service
**Static legal page**

### `/affiliate-agreement` — Affiliate Terms
**Static legal page**

---

### `/recover` — Account Recovery
**Purpose:** Customer with no password resets their account using a recovery kit.

**Features:**
- Step 1: Enter account ID (8-digit numeric)
- Step 2: Enter recovery kit code
- On valid kit: set new password + receive new recovery kit
- Password requires 12+ chars + complexity
- No email required — account identified by numeric ID + recovery kit

**API Calls:**
- `POST /api/auth/customer/recovery/use-kit` → `{ accountNumber, kit, newPassword }`

---

## ADMIN PAGES

---

### `/ahoyman` — Admin Login
**Purpose:** William logs into the management dashboard.

**Features:**
- Username + password
- Auth stored in `localStorage.adminToken`
- On success → `/ahoyman-dashboard`
- 2FA support (if enabled on account)

**API Calls:**
- `POST /api/auth/ahoyman/login` → `{ username, password }`

---

### `/ahoyman-dashboard` — Admin Management Panel (React SPA)
**Purpose:** William manages customers, affiliates, payouts, tax compliance.

**Features (5 tabs):**

**Overview Tab:**
- KPIs: total customers, active subscriptions, affiliates, pending payouts, revenue
- `/api/auth/ahoyman/metrics` (NOT `/api/admin/metrics` — correct endpoint is `/auth/ahoyman/metrics`)

**Customers Tab:**
- Paginated list: search by ID/email/account number
- Actions per customer: view details, suspend, delete
- Subscription status shown

**Affiliates Tab:**
- List all affiliates with: username, email, commission rate, status
- Per-affiliate actions: reset password, regenerate recovery kit, suspend, reactivate
- View affiliate's links and referral count

**Payouts Tab:**
- Pending payout requests
- Approve/Reject buttons (sets `status='approved'` or `'rejected'`)
- Manual payout logging
- Email to William on new request

**Tax Tab:**
- Tax transactions table (state, zip, amount, tax rate, date)
- Summary by state
- CSV export

**Settings Tab:**
- Commission rate, minimum payout, hold period

**API Calls:**
- `GET /api/auth/ahoyman/metrics`
- `GET /api/admin/customers` (paginated)
- `GET /api/admin/customers/search`
- `POST /api/admin/customers/:id/suspend`
- `DELETE /api/admin/customers/:id`
- `GET /api/auth/ahoyman/affiliates`
- `POST /api/auth/ahoyman/affiliates` (create)
- `PUT /api/auth/ahoyman/affiliates/:id/suspend`
- `PUT /api/auth/ahoyman/affiliates/:id/reactivate`
- `POST /api/auth/ahoyman/affiliates/:id/reset-password`
- `POST /api/auth/ahoyman/affiliates/:id/regenerate-kit`
- `GET /api/auth/ahoyman/payout-requests`
- `PUT /api/auth/ahoyman/payout-requests/:id/approve`
- `PUT /api/auth/ahoyman/payout-requests/:id/reject`
- `GET /api/auth/ahoyman/tax-transactions`
- `GET /api/auth/ahoyman/tax-transactions/summary`
- `GET /api/auth/ahoyman/tax-transactions/export/csv`

---

### `/admin` — Customer Admin Panel
**Purpose:** Alternative admin login (separate from ahoyman).

**Features:**
- Login form (role-based auth)
- Customer management interface
- Different from ahoyman — this is the old admin system
- **Note:** Most admin operations use ahoyman endpoints. This page is less developed.

**API Calls:**
- `POST /api/auth/admin/login` (or equivalent)
- Note: Metrics endpoint is `/api/auth/ahoyman/metrics`, not `/api/admin/metrics`

---

## AUTH CONTEXT & STATE

**AuthContext (`_app.jsx`):**
- Stores `user`, `subscription`, `loading` state
- On mount: calls `GET /api/me` + `GET /api/subscription`
- Provides auth state to all child pages

**Token Storage (4 separate namespaces):**
- `localStorage.accessToken` → customer JWT
- `localStorage.affiliateToken` → affiliate JWT
- `localStorage.adminToken` → admin JWT
- `localStorage.authToken` → fallback

**CSRF Protection:**
- Cookie: `csrfToken` (httpOnly: false, secure, sameSite: strict, 15min maxAge)
- Header: `X-CSRF-Token` required on all mutating requests
- Auto-refreshed on 403

**Error Interceptor:**
- 401 → clear all tokens, redirect to appropriate login
- 403 → reject (CSRF failure, do not retry)
- Network error → show inline error

---

## PAYMENT FLOW SUMMARY

```
Customer on /checkout
  ├── Crypto (Plisio)
  │     POST /api/payment/checkout → invoice created at Plisio
  │     → Plisio redirect to invoice page (QR code shown)
  │     → Plisio IPN POST /api/webhooks/plisio (payment confirmed)
  │     → Subscription activated, VPN provisioned, email sent, commission credited
  │     → Frontend polls /api/payment/invoice/:id/status → on completed → /payment-success
  │
  ├── Card (Authorize.net Accept Hosted)
  │     POST /api/payment/checkout → redirectUrl returned (Authorize.net hosted page)
  │     → User enters card on Authorize.net
  │     → Authorize.net POSTs to /api/payment/authorize/relay (responseCode=1)
  │     → Subscription activated, VPN provisioned, ARB created, email sent, commission credited
  │     → Redirect to /payment-success?sessionId=X
  │
  └── PaymentsCloud (alternative card processor)
        Webhook: POST /api/webhooks/paymentscloud (payment.succeeded)
        Looks up user by account_number in metadata
        → Same activation flow
```

---

## KNOWN BUGS TO PRESERVE FIXES FOR

1. **adminMetrics duplicate** — `api/client.js` had two `adminMetrics` definitions; the second overwrote the first. Fixed: single definition pointing to `/auth/ahoyman/metrics`
2. **Error interceptor routes** — must route to React routes (`/ahoyman`), not static HTML (`/ahoyman.html`)
3. **Payout email** — backend must say `Ahoyvpn@ahoyvpn.net`, NOT `william@ahoyvpn.com`
4. **Commission case sensitivity** — `applyAffiliateCommissionIfEligible` uses `WHERE UPPER(username) = UPPER($1)`
5. **Copy button** — clipboard gets `link.url` string, not the link object (stringify fix)
6. **handleCreateCustomCode** — calls `getAffiliateLinks()` after creation to get complete data
7. **actionLoading scope** — AffiliatesTab has its own `actionLoading` state

---

## VPN ENDPOINTS — ALL 501 (Critical — Must Fix)

All customer-facing VPN download endpoints currently return `501 Not implemented`:
- `GET /api/vpn/servers` → 501
- `GET /api/vpn/config/wireguard` → 501
- `GET /api/vpn/config/openvpn` → 501
- `POST /api/vpn/connect` → 501
- `POST /api/vpn/disconnect` → 501
- `GET /api/vpn/connections` → 501

VPN IS provisioned on payment (via VPNResellersService) — customers just can't download configs. This is the biggest product gap.

---

## DATABASE TABLES (auth system)

| Table | Purpose |
|-------|---------|
| `users` | Customers (id, email, password_hash, account_number, status) |
| `admin_users` | William + admin accounts |
| `affiliates` | Affiliate accounts (separate from users) |
| `subscriptions` | Per-user subscription (status: trialing/active/cancelled/expired) |
| `plans` | Plan definitions (monthly/quarterly/semi-annual/annual) |
| `payments` | Payment transaction records |
| `transactions` | Affiliate commissions + payout records |
| `affiliate_links` | Affiliate referral URLs with codes |
| `affiliate_link_discounts` | Per-link discount amounts |
| `payout_requests` | Affiliate payout requests (pending/approved/rejected) |
| `payout_config` | Config: minimum_payout_cents, commission_rate (0.25), hold_period_days (30) |
| `vpn_accounts` | VPN credentials (purewl_username/password/uuid from VPNResellers) |
| `recovery_kits` | Encrypted recovery codes (argon2 hashed, 1hr expiry) |
| `sessions` | JWT session records |
| `sessions` | Refresh tokens |
| `tax_transactions` | ZipTax records (state, zip, amount, tax_rate) |

---

## NOTES FOR REBUILD

1. **No email required** — customers identified by numeric account ID, not email. Password reset uses recovery kit, not email link.
2. **Three separate auth tables** — users, affiliates, admin_users are completely separate. Each has its own login endpoint, JWT, and dashboard.
3. **Affiliate cookie** — set server-side via `/api/ref/:code` nginx proxy rule. Client reads via `getAffiliateId()`.
4. **Static HTML still on server** — production frontend is plain HTML/JS at `/var/www/ahoyvpn.net/html/`. The Next.js frontend (in this repo) is the rebuild target.
5. **SSL** — certs at `/etc/letsencrypt/live/ahoyvpn.net/` (expires Jun 3, 2026).