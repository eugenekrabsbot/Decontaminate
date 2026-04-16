# AhoyVPN Backend API

Node.js/Express backend for AhoyVPN, integrating with PureWL (Atom VPN) for VPN infrastructure, cryptocurrency payments via Plisio, and PostgreSQL for data.

## Core Principles

✅ **Privacy-First Design**
- No customer email collection for accounts/login
- Accounts use numeric username + numeric password
- On confirmed payment: backend generates numeric username, numeric password, and recovery kit
- Single-use recovery kits that are invalidated and replaced when used

✅ **Payment Security**
- No storage of payment method details (card/bank/crypto wallet)
- Payment handled by third parties (Plisio for crypto, PaymentsCloud for fiat)
- Webhook-based payment confirmation with HMAC signature verification

✅ **Role-Based Access**
- **Customer**: Access to own account, subscription, VPN credentials
- **Affiliate**: Access to affiliate dashboard, promo codes, referral tracking
- **Admin/Management**: Full system access, user management, analytics

✅ **Secure Defaults**
- TLS assumed via reverse proxy
- Least privilege database access
- Comprehensive audit logging
- Rate limiting and security headers

## Features

- User authentication (JWT, 2FA, recovery codes)
- Subscription management (monthly, quarterly, semi‑annual, annual)
- Payment processing (Plisio for cryptocurrency, PaymentsCloud for fiat)
- VPN account provisioning via PureWL API
- Affiliate program (invitation‑only, 25% commission)
- Support ticket system
- Dashboard API for frontend
- GDPR/CCPA compliant data export endpoint

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL with migrations
- **Authentication**: JWT, bcrypt, TOTP
- **Payments**: Plisio (cryptocurrency), PaymentsCloud (fiat)
- **VPN Integration**: PureWL (Atom VPN) API
- **Email**: SMTP (dual‑domain: `@ahoyvpn.net` transactional, `William@ahoyvpn.com` support)

## Architecture

### Account System
- **Numeric Account Number**: 8-digit unique identifier (e.g., `12345678`)
- **Numeric Password**: 8-digit password (e.g., `87654321`)
- **Recovery Kit**: 32-character single-use code, hashed and stored
- **No Email Required**: Email is optional and not used for login

### Payment Flow
1. User selects plan and provides numeric account number
2. Backend creates subscription with `trialing` status
3. User completes payment via Plisio/PaymentsCloud
4. Webhook confirms payment
5. Backend activates subscription and creates VPN account
6. User receives VPN credentials via recovery kit

### Webhook Security
- HMAC signature verification
- IP allowlist (optional)
- Replay protection via nonce/timestamp
- Idempotent processing

## Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

See `.env.example` for all required variables.

## Database Setup

### 1. Install PostgreSQL
```bash
sudo apt install postgresql
```

### 2. Create Database and User
```sql
CREATE DATABASE ahoyvpn;
CREATE USER ahoyvpn WITH PASSWORD 'securepassword';
GRANT ALL PRIVILEGES ON DATABASE ahoyvpn TO ahoyvpn;
```

### 3. Run Migrations
```bash
npm run migrate
```

This will run all migrations in `db/migrations/` in order.

## Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Migrations
```bash
npm run migrate
```

### 3. Seed Database (Development)
```bash
npm run seed
```

This creates:
- Admin user (account: `12345678`, password: `87654321`)
- Affiliate user with code `SAVE20`
- Demo customers with subscriptions
- Sample promo codes

### 4. Start Server
```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

## API Endpoints

### Authentication
| Path | Method | Description |
|------|--------|-------------|
| `/api/auth/register` | POST | Register new numeric account |
| `/api/auth/login` | POST | Login with numeric credentials |
| `/api/auth/recover` | POST | Use recovery kit to reset password |
| `/api/auth/logout` | POST | Logout (protected) |

### Subscriptions
| Path | Method | Description |
|------|--------|-------------|
| `/api/subscription/plans` | GET | List available plans |
| `/api/subscription` | GET | Get current subscription |
| `/api/subscription` | POST | Create new subscription |
| `/api/subscription/pause` | PUT | Pause subscription |
| `/api/subscription/resume` | PUT | Resume subscription |
| `/api/subscription/cancel` | PUT | Cancel subscription |
| `/api/subscription/switch` | PUT | Switch plan |
| `/api/subscription/invoices` | GET | Get payment history |

### Payments
| Path | Method | Description |
|------|--------|-------------|
| `/api/payment/checkout` | POST | Initiate payment (crypto only) |
| `/api/payment/webhook/plisio` | POST | Plisio webhook endpoint |
| `/api/payment/webhook/paymentscloud` | POST | PaymentsCloud webhook endpoint |

### VPN
| Path | Method | Description |
|------|--------|-------------|
| `/api/vpn/servers` | GET | List VPN servers |
| `/api/vpn/config/wireguard` | GET | Get WireGuard config |
| `/api/vpn/config/openvpn` | GET | Get OpenVPN config |
| `/api/vpn/connect` | POST | Connect to VPN |
| `/api/vpn/disconnect` | POST | Disconnect from VPN |

### Affiliate
| Path | Method | Description |
|------|--------|-------------|
| `/api/affiliate/dashboard` | GET | Affiliate dashboard stats |
| `/api/affiliate/promo-codes` | GET | List promo codes |
| `/api/affiliate/promo-codes` | POST | Generate promo code |
| `/api/affiliate/payout-request` | POST | Request payout |

### Admin
| Path | Method | Description |
|------|--------|-------------|
| `/api/admin/stats` | GET | Platform statistics |
| `/api/admin/users` | GET | List users |
| `/api/admin/affiliates` | GET | List affiliates |
| `/api/admin/promo-codes` | GET | List promo codes |
| `/api/admin/promo-codes` | POST | Create promo code |
| `/api/admin/credits` | POST | Issue credits to user |

## Webhook Testing

### Test Plisio Webhook
```bash
npm run webhook:test -- plisio
```

### Test PaymentsCloud Webhook
```bash
npm run webhook:test -- paymentscloud
```

### Manual Webhook Testing
```bash
curl -X POST http://localhost:3000/api/payment/webhook/plisio \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "order_number": "AHOY-1234567890-123",
    "invoice_id": "inv_123",
    "tx_id": "tx_123",
    "currency": "BTC",
    "amount": "9.99",
    "email": "customer@example.com"
  }'
```

## Database Schema

### Core Tables
- `users` - User accounts with numeric credentials
- `recovery_kits` - Single-use recovery kits
- `subscriptions` - User subscriptions
- `payments` - Payment records
- `vpn_accounts` - PureWL VPN credentials

### Affiliate Tables
- `affiliates` - Affiliate accounts
- `affiliate_codes` - Promo codes
- `referrals` - Referral tracking
- `earnings_ledger` - Commission tracking

### Support Tables
- `support_tickets` - Customer support tickets
- `audit_logs` - Security audit logs

## PureWL Integration

The backend uses PureWL (Atom VPN) as the VPN provider. When a user subscribes:

1. A VPN account is created via `/vam/v3/create` with a unique `uuid`.
2. Credentials (`vpnUsername`, `vpnPassword`) are stored encrypted.
3. Client apps use Atom SDK with these credentials.

## Deployment

### Production Deployment
The backend is designed to run on a single server (`89.167.46.117`) alongside the frontend (Nginx).

1. Push code to GitHub.
2. SSH into the server and pull changes.
3. Install dependencies: `npm install --production`.
4. Run migrations: `npm run migrate`.
5. Start with PM2: `pm2 start src/index.js --name ahoyvpn-backend`.

### Docker Deployment
```bash
docker build -t ahoyvpn-backend .
docker run -p 3000:3000 --env-file .env ahoyvpn-backend
```

## Security Checklist

- [ ] HTTPS enforced via reverse proxy
- [ ] JWT secrets rotated regularly
- [ ] Database access restricted to backend only
- [ ] Webhook signatures verified
- [ ] Rate limiting enabled
- [ ] Audit logs reviewed regularly
- [ ] Recovery kits hashed (never stored plaintext)
- [ ] Payment details never stored

## License

Proprietary – © 2026 AhoyVPN.