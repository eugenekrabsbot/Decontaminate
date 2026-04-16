# AhoyVPN Payments Integration Reference

**Created:** March 5, 2026, 2:42 AM EST  
**Purpose:** Guide for integrating Plisio (crypto) and PaymentsCloud (fiat) payment processors

---

## Checkout Flow Architecture

### User Journey
```
Homepage (/checkout?plan=monthly)
  ↓
Checkout Page - Step 1: Plan Selection
  ↓ (user selects plan, clicks "Continue to Payment")
Checkout Page - Step 2: Payment Method
  - Choose: Crypto (Plisio) OR Fiat (PaymentsCloud)
  - Optional: Apply affiliate code
  ↓ (clicks "Continue to Payment")
Checkout Page - Step 3: Confirm Payment
  - Show plan summary
  - Payment method disclaimer
  - Mock: Continue to provider
  ↓ (clicks "Continue to [Provider]")
[REAL] Payment Processor (Plisio or PaymentsCloud)
  ↓ (user completes payment)
[WEBHOOK] Payment Processor → Backend
  - Verify payment
  - Create account
  - Generate numeric username/password
  - Generate recovery kit
  ↓
Checkout Page - Step 4: Account Provisioning (Success)
  - Display: numeric username, numeric password
  - Download/Copy: recovery kit
  - Auto-login user
  ↓ (click "Go to Dashboard")
Customer Dashboard (/dashboard)
```

---

## Frontend Implementation Details

### Checkout Page Location
- **File:** `pages/checkout.jsx`
- **Lines:** ~400 LOC

### Current Mock Implementation
```javascript
// api/client.js - initiateCheckout function
initiateCheckout: async (plan, paymentMethod, affiliateCode = null) => {
  // TODO: POST /checkout/initiate
  // Return: { sessionId, redirectUrl, plan }
}

confirmCheckoutSuccess: async (sessionId) => {
  // TODO: POST /checkout/confirm
  // Return: { userId, password, recoveryKit }
}
```

### Payment Method Selection
```javascript
const PAYMENT_METHODS = [
  { id: 'crypto', name: 'Cryptocurrency (Bitcoin)', provider: 'Plisio' },
  { id: 'fiat', name: 'Credit Card (Visa/Mastercard)', provider: 'PaymentsCloud' },
];
```

### State Management (Checkout Page)
- `selectedPlan` - "monthly", "quarterly", "semi-annual", "annual"
- `selectedPayment` - "crypto" or "fiat"
- `affiliateCode` - optional referral code
- `step` - "plan", "payment", "confirm", "success"
- `accountData` - { userId, password, recoveryKit } after success

---

## Backend Integration Points (TODO)

### 1. Initiate Checkout
**Endpoint:** `POST /checkout/initiate`

**Frontend sends:**
```json
{
  "plan": "monthly",           // or quarterly, semi-annual, annual
  "paymentMethod": "crypto",   // or fiat
  "affiliateCode": "AHOY12345" // optional
}
```

**Backend does:**
1. Validate plan and payment method
2. Calculate price (with affiliate discount if applicable)
3. Create checkout session in payment provider
4. Store session metadata (plan, method, affiliate)
5. Return: `{ sessionId, redirectUrl }`

**Backend returns:**
```json
{
  "sessionId": "session_12345",
  "redirectUrl": "https://checkout.plisio.net/..." // or paycloud URL
}
```

### 2. Payment Provider Webhook
**Endpoint:** `POST /webhook/plisio` or `POST /webhook/paycloud`

**Payment provider sends:**
- Transaction ID
- Amount
- Status (completed/pending/failed)
- Metadata (sessionId, plan, affiliate code)

**Backend does:**
1. Verify webhook signature (security)
2. Fetch session from database using metadata
3. If payment confirmed:
   - Generate numeric username (8-digit random)
   - Generate numeric password (8-digit random)
   - Generate recovery kit (unique code)
   - Create user in database
   - Create subscription record (plan, status=active, next_billing_date)
   - If affiliate code: record attribution
   - Store payment processor account ID (for future reference)
4. If payment failed: mark session as failed

### 3. Confirm Checkout
**Endpoint:** `POST /checkout/confirm`

**Frontend sends:**
```json
{
  "sessionId": "session_12345"
}
```

**Backend does:**
1. Fetch completed session
2. Return account data: `{ userId, password, recoveryKit }`

**Backend returns:**
```json
{
  "userId": "12345678",
  "password": "87654321",
  "recoveryKit": "KIT_XXXXXXXXXXXXXXXXXXXXXX"
}
```

---

## Subscription Data Model

### User Record
```javascript
{
  id: BIGINT,                    // numeric user ID (8 digits)
  password_hash: TEXT,           // bcrypt/scrypt hashed
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
  deleted_at: TIMESTAMP          // soft delete
}
```

### Subscription Record
```javascript
{
  user_id: BIGINT,               // foreign key to user
  plan: VARCHAR(20),             // monthly, quarterly, semi-annual, annual
  status: VARCHAR(20),           // active, cancelled, expired
  next_billing_date: DATE,       // when next charge occurs
  payment_provider: VARCHAR(50), // plisio, paycloud
  payment_account_id: VARCHAR,   // provider's transaction/account ID
  affiliate_code_used: VARCHAR,  // nullable, for attribution
  created_at: TIMESTAMP,
  cancelled_at: TIMESTAMP        // when user cancelled
}
```

### Recovery Kit Record
```javascript
{
  user_id: BIGINT,
  kit_code: TEXT,                // single-use recovery kit
  used_at: TIMESTAMP,            // when used (invalidates)
  created_at: TIMESTAMP,
  expires_at: TIMESTAMP          // optional expiry (e.g., 90 days)
}
```

---

## Plan Pricing (Frontend)

```javascript
const PLANS = [
  { id: 'monthly', name: 'Monthly', price: '$9.99', period: '/month' },
  { id: 'quarterly', name: 'Quarterly', price: '$24.99', period: '/3 months' },
  { id: 'semi-annual', name: 'Semi-Annual', price: '$44.99', period: '/6 months' },
  { id: 'annual', name: 'Annual', price: '$79.99', period: '/year' },
];
```

### Backend Mapping Needed
```javascript
const PLAN_PRICES = {
  monthly: 9.99,
  quarterly: 24.99,
  semi_annual: 44.99,
  annual: 79.99
};

// VPNresellers API compatibility
const PLAN_TO_VPNRESELLERS = {
  monthly: { days: 30, vpr_plan_id: '1' },     // TODO: verify IDs
  quarterly: { days: 90, vpr_plan_id: '3' },
  semi_annual: { days: 180, vpr_plan_id: '6' },
  annual: { days: 365, vpr_plan_id: '12' }
};
```

---

## Affiliate System Integration

### Affiliate Code Validation
**During checkout:**
1. User enters code: "AHOY12345"
2. Backend validates code exists in affiliate_codes table
3. If valid: apply any discount (currently 0% - all referrers earn commission, not discount)
4. Store code in subscription record for attribution

### Affiliate Record Attribution
```javascript
{
  affiliate_code: VARCHAR,       // "AHOY12345"
  signups: INT,                  // tracked conversions
  conversions: INT,              // actual active subs
  earnings: DECIMAL,             // calculated as: active_subs * monthly_price * 0.10
  // Earnings breakdown:
  // - Total: sum of all sub values
  // - Pending: earnings for current month (paid on 15th)
  // - Paid: previous months' earnings
}
```

---

## Security Considerations

### Sensitive Data
- **Recovery Kit:** Never stored in logs, never shown without user re-auth
- **Numeric Password:** Hashed with bcrypt/scrypt, never stored plaintext
- **Payment Data:** Handled ONLY by payment processors (Plisio, PaymentsCloud)

### Webhook Security
- Verify webhook signature from payment provider
- Use HTTPS only
- Validate session metadata before creating account
- Rate limit webhook endpoint

### Frontend Security
- HTTPS only (enforced via NGINX)
- HSTS header enabled
- Sensitive data (recovery kit) requires copy/download, not display-only
- Form validation on both client and server

---

## Testing Checklist (Before Production)

### Unit Tests
- [ ] Plan validation (valid plan IDs)
- [ ] Affiliate code lookup
- [ ] Numeric ID generation (randomness, collision-free)
- [ ] Recovery kit generation
- [ ] Password hashing

### Integration Tests
- [ ] Checkout flow end-to-end (mock payment provider)
- [ ] Webhook signature validation
- [ ] Account creation on webhook
- [ ] Subscription record creation
- [ ] Affiliate attribution

### Manual Testing
- [ ] Monthly plan purchase (crypto)
- [ ] Quarterly plan purchase (fiat)
- [ ] Affiliate code application
- [ ] Recovery kit download/copy
- [ ] Login with generated credentials
- [ ] Subscription status display on dashboard

### Payment Provider Tests
- [ ] Plisio sandbox integration
- [ ] PaymentsCloud sandbox integration
- [ ] Webhook delivery (test endpoint)
- [ ] Signature verification

---

## API Error Handling

### Frontend Expects (from mock API)
```javascript
// On error:
{
  error: "invalid_plan",
  message: "Plan not found"
}

// Frontend displays: "Failed to initiate checkout. Please try again."
```

### Backend Should Return
- 400: Invalid plan/payment method
- 402: Payment required (if prepayment validation)
- 500: Server error (create session, webhook processing)

---

## Deployment Configuration

### Environment Variables (Backend)
```
PLISIO_API_KEY=<key>
PLISIO_MERCHANT_ID=<id>
PAYCLOUD_API_KEY=<key>
PAYCLOUD_MERCHANT_ID=<id>
PAYCLOUD_SECRET=<secret>

WEBHOOK_SECRET_PLISIO=<secret>
WEBHOOK_SECRET_PAYCLOUD=<secret>

DATABASE_URL=postgres://...
```

### Environment Variables (Frontend)
```
NEXT_PUBLIC_API_URL=https://api.ahoyvpn.net/api
```

---

## VPNresellers Integration (REQUIRED - Primary VPN Provider)

**Status:** Selected as white-label VPN provider for AHOY VPN

**Integration point:** After payment confirmation webhook, immediately create VPNresellers account

**Flow:**
1. Payment confirmed (Plisio or PaymentsCloud webhook)
2. Create AHOY user + subscription record
3. Call VPNresellers API to create white-label account
4. Store returned VPNresellers account ID in subscription record
5. Return account data to frontend (numeric username, password, recovery kit)
6. Download link directs to VPNresellers apps

**VPNresellers Account Details:**
- API endpoint: https://vpnresellers.com/api/v1/clients/add
- Plan mapping: AHOY monthly/quarterly/semi-annual/annual → 30/90/180/365 day plans
- Returns: client_id, username, status, expiration_date
- Renewal: Extend account on next_billing_date via API

**Key Features to Highlight:**
- Absolute zero-log policy (no connection logs, no traffic logs)
- 50+ countries, 200+ server locations
- Unblock georestricted content (Netflix, Disney+, etc.)
- Protect IP on streaming services
- Stable for remote workers traveling abroad
- Beat hotel WiFi throttling

**Separate Documentation:** See `VPNRESELLERS_INTEGRATION.md` for complete integration guide, API endpoints, error handling, testing checklist, and frontend messaging

---

## References

### Files to Update When Integrating
1. `api/client.js` - Replace mock functions with real API calls
2. Backend `checkout.js` (or routes) - Implement endpoints
3. Backend `webhooks.js` - Implement Plisio + PaymentsCloud webhooks
4. Database migrations - Create user, subscription, recovery_kit, affiliate tables
5. `.env.example` - Document all required environment variables

### Frontend Flow Remains Same
- Checkout page (`pages/checkout.jsx`) - No changes needed after API integration
- Dashboard (`pages/dashboard.jsx`) - No changes needed
- All other pages - No changes needed

### Backend Must Provide
- Same response formats as mock API
- Webhook handling for both providers
- Account creation + subscription management

---

**Last Updated:** March 5, 2026, 2:42 AM EST  
**Status:** Ready for payment processor integration
