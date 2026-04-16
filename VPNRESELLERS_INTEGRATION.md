# VPNresellers Integration Guide

**Created:** March 5, 2026, 2:53 AM EST  
**Provider:** VPNresellers.com (White-Label VPN)  
**Status:** Selected for AhoyVPN backend integration

---

## Value Propositions

### Core Benefits
1. **Absolute Zero-Log Policy** - No connection logs, no traffic logs, no IP logs
2. **Unblock Georestricted Content** - Access region-locked services globally
3. **IP Protection on Streaming** - Hide real IP from streaming services (Netflix, Disney+, etc.)
4. **Remote Worker Support** - Stable connections for traveling professionals
5. **Hotel WiFi Speed Bypass** - Circumvent throttling on public/hotel internet

### Target Use Cases

**1. Digital Nomads & Remote Workers**
- Problem: Hotel WiFi throttling, unstable connections
- Solution: VPN tunnel provides stable, fast connection
- Use case: Video calls, file transfers, cloud work from anywhere

**2. Content Streamers**
- Problem: Streaming services block by region
- Solution: Change apparent location
- Use case: Netflix, Disney+, Hulu access from abroad

**3. Privacy-Conscious Users**
- Problem: ISP logging, data collection
- Solution: Zero-log VPN provider
- Use case: Everyday browsing, privacy protection

**4. Georestricted Content Access**
- Problem: Regional content locks
- Solution: VPN routes through unrestricted region
- Use case: News, sports, entertainment access

---

## VPNresellers API Integration

### Account Creation Flow (Backend)

**After payment confirmed (Plisio/PaymentsCloud webhook):**

```
1. Create AHOY VPN user record (numeric ID + hashed password)
2. Create subscription record (plan, status=active, next_billing_date)
3. Call VPNresellers API to create white-label account
   - Endpoint: https://vpnresellers.com/api/v1/clients
   - Request: {
       email: auto-generated (optional),
       username: user_id (numeric),
       password: auto-generated strong password,
       plan_id: map AHOY plan to VPNresellers plan
     }
4. Store returned VPNresellers account ID in subscription record
5. Return to frontend: numeric_username, numeric_password, recovery_kit
```

### VPNresellers Account Linking

**Store mapping:**
```
subscription record:
  user_id → numeric AHOY user ID (8 digits)
  vpnresellers_account_id → returned from VPNresellers API
  vpnresellers_username → may differ from AHOY numeric ID
  vpnresellers_password → secure password for VPN apps
```

### Plan Mapping (AHOY → VPNresellers)

**AHOY Plans → VPNresellers Plans**
```
monthly ($9.99) → 30-day plan
quarterly ($24.99) → 90-day plan
semi_annual ($44.99) → 180-day plan
annual ($79.99) → 365-day plan
```

**Note:** Coordinate with VPNresellers reseller account to get plan IDs mapping.

### VPNresellers Features to Highlight

**In Frontend Copy:**

- "**No-Log VPN** - We don't track your connections, browsing, or IP address"
- "**Unblock Anywhere** - Access region-locked content from any location"
- "**Protect Your Streaming** - Hide your real IP from Netflix, Disney+, and other services"
- "**Stable for Remote Work** - Reliable connections for video calls and file transfers"
- "**Bypass Throttling** - Fast speeds on hotel and public WiFi networks"

**In Privacy Policy:**
- Emphasize zero-log commitment
- Explain data minimization (no email, numeric ID only)
- Clarify that AHOY stores minimal user data (only numeric ID + hashed password)
- Explain VPNresellers connection handling (tunneled traffic not logged)

**In FAQ:**
- "What data do you keep?" → Numeric ID + password only, no activity logs
- "Can I unblock Netflix?" → Yes, VPNresellers provides regional access
- "Is it safe for streaming?" → Yes, your real IP is hidden
- "Can I use it for remote work?" → Yes, stable connection for video/files
- "Will it slow my internet?" → No, VPNresellers uses optimized servers

---

## Customer Dashboard Integration

### After Account Creation

**Display to User:**
```
VPN Account Details
├─ Username: [numeric_username]
├─ Password: [numeric_password]
├─ Download VPN Client
│  ├─ Windows
│  ├─ macOS
│  ├─ iOS
│  └─ Android
├─ VPN Configuration
│  ├─ Protocol (OpenVPN, WireGuard, IKEv2)
│  ├─ Server List (50+ locations)
│  └─ Auto-Connect (enable/disable)
└─ Connection Status
   ├─ Connected/Disconnected
   ├─ Current Location
   └─ Real IP Hidden ✓
```

### Account Management

**Customer Dashboard Features:**
- Download VPN app links (Windows, Mac, iOS, Android)
- Server location selection (50+ countries)
- Connection status indicator
- Change VPN password (separate from AHOY login)
- View renewal date
- Upgrade/downgrade plan
- Cancel subscription

---

## Server Locations (VPNresellers)

**Typical coverage:**
- 50+ countries
- 200+ server locations
- Multiple protocols: OpenVPN UDP/TCP, WireGuard, IKEv2
- High-speed optimized
- P2P friendly (for remote work file transfer)

**Frontend should display:**
- Flag icon + country name
- City (if available)
- Server load %
- Ping time (ms)

---

## VPNresellers API Endpoints (For Backend)

### Create Account
```
POST https://vpnresellers.com/api/v1/clients/add
Headers:
  Authorization: Bearer {API_KEY}
  Content-Type: application/json

Body:
{
  "email": "optional@example.com",
  "username": "12345678",
  "password": "strong-password",
  "plan_id": "30" // or 90, 180, 365
}

Response:
{
  "client_id": "67890",
  "username": "12345678",
  "status": "active",
  "expiration_date": "2026-04-05",
  "connection_token": "abc123"
}
```

### Retrieve Account
```
GET https://vpnresellers.com/api/v1/clients/{client_id}
Headers:
  Authorization: Bearer {API_KEY}

Response:
{
  "client_id": "67890",
  "username": "12345678",
  "status": "active",
  "expiration_date": "2026-04-05",
  "data_used": "2.5GB",
  "data_limit": "1000GB"
}
```

### Extend Account (Renewal)
```
POST https://vpnresellers.com/api/v1/clients/{client_id}/extend
Headers:
  Authorization: Bearer {API_KEY}

Body:
{
  "plan_id": "30",
  "extend_days": 30
}

Response:
{
  "client_id": "67890",
  "new_expiration_date": "2026-05-05",
  "status": "active"
}
```

### Reset Password
```
POST https://vpnresellers.com/api/v1/clients/{client_id}/reset_password
Headers:
  Authorization: Bearer {API_KEY}

Body:
{
  "new_password": "new-strong-password"
}

Response:
{
  "success": true,
  "message": "Password reset"
}
```

---

## Subscription Renewal Flow

### At next_billing_date:

**Backend Cron Job (Daily 2 AM):**
```
1. Find subscriptions where next_billing_date == today
2. For each subscription:
   a. Charge payment via Plisio (if crypto) or PaymentsCloud (if fiat)
   b. If payment successful:
      - Update subscription.next_billing_date = today + plan_days
      - Call VPNresellers API to extend account
      - Store new expiration in subscription record
   c. If payment failed:
      - Update subscription.status = suspended
      - Notify user (email or in-app alert)
3. Log renewal status
```

---

## VPNresellers API Key Management

### Environment Variables (Backend)
```
VPNRESELLERS_API_KEY=<key>
VPNRESELLERS_API_URL=https://vpnresellers.com/api/v1
VPNRESELLERS_RESELLER_ID=<your_reseller_id>
```

### Security
- Store API key in environment, never in code
- Use HTTPS for all API calls
- Validate API responses (check status codes)
- Log API errors (not user data)
- Rotate API key periodically

---

## Error Handling

### If VPNresellers API Fails

**Scenario 1: Payment succeeded, but VPN account creation failed**
```
1. Create user/subscription record in AHOY database
2. Mark subscription.status = "pending_vpn_account"
3. Queue async job to retry VPNresellers API
4. Email user: "Account created, VPN provisioning in progress..."
5. Once VPN account created, mark status = "active"
```

**Scenario 2: Account renewal fails at VPNresellers**
```
1. Keep subscription.status = "active" (grace period)
2. Notify user: "Renewal pending, check your VPN connection"
3. Retry renewal 3x over 24 hours
4. If still fails, mark status = "suspended"
```

**Scenario 3: VPNresellers API timeout**
```
1. Implement exponential backoff (1s, 2s, 4s, 8s)
2. Retry up to 5 times
3. If all retries fail, log error + notify admin
4. Customer can contact support
```

---

## Testing Checklist (Before Production)

### Unit Tests
- [ ] Plan mapping (AHOY → VPNresellers)
- [ ] Account creation request formatting
- [ ] Password generation (strong, random)
- [ ] API response parsing

### Integration Tests
- [ ] Create account via VPNresellers API (sandbox)
- [ ] Retrieve account details
- [ ] Reset password
- [ ] Extend account (renewal)
- [ ] Error handling (API failures, timeouts)

### End-to-End Tests
- [ ] Complete checkout flow → VPN account created
- [ ] User login to AHOY → can view VPN credentials
- [ ] Download VPN app → connect successfully
- [ ] Subscription renewal → VPN account extended
- [ ] Cancel subscription → VPN account deactivated

### Manual Testing
- [ ] Connect to VPN via downloaded app
- [ ] Verify real IP is hidden
- [ ] Test streaming (Netflix, etc.)
- [ ] Verify no-log policy (check logs)
- [ ] Test connection stability

---

## Messaging & Copy (Frontend)

### Homepage
"Your IP is your identity online. Hide it with AHOY VPN.
- **Absolute Zero Logs** - No connection tracking, no activity records
- **Unblock Anywhere** - Access region-locked content from any location
- **Protect Your Streaming** - Watch Netflix, Disney+, and others from anywhere
- **Stable for Work** - Reliable VPN for remote work and traveling
- **Beat Throttling** - Fast speeds on hotel and public WiFi"

### Checkout Page
"You're about to secure your online privacy with AHOY VPN.
- Powered by VPNresellers (zero-log provider)
- 50+ countries, 200+ server locations
- OpenVPN, WireGuard, IKEv2 protocols
- 7-day activation (no email required)"

### Dashboard
"Your VPN Account
- VPN Username: [numeric_id]
- VPN Password: [****]
- Servers: 50+ countries
- Data Limit: Unlimited
- Renewal: [date]
- Status: Active ✓"

---

## Affiliate Messaging

### For Affiliates (Promoting AHOY VPN)
"Share AHOY VPN and earn 10% commission on every subscription.
- **Zero-log VPN** - Privacy-first provider
- **No email required** - Instant account with numeric ID
- **Unblock content** - Help friends access region-locked services
- **Protect IP** - Hide identity on streaming services
- **Stable for work** - Perfect for remote workers traveling

Your referral link: [unique_code]
Share with friends, colleagues, and travelers."

---

## Future Enhancements (Post-Launch)

1. **VPN Configuration Export** - Allow users to download VPN config files
2. **Multi-Device Login** - Support 2-5 simultaneous connections (plan-dependent)
3. **Kill Switch** - Disconnect if VPN drops (app feature)
4. **Split Tunneling** - Route specific apps through VPN only
5. **Server Recommendations** - Auto-select fastest/best server for use case
6. **Data Usage Tracking** - Show current month's VPN data usage
7. **Billing History** - Invoice downloads, payment receipts
8. **API for VPN Config** - Allow power users to fetch VPN config programmatically

---

## VPNresellers Relationship

**Status:** White-label partnership  
**API Access:** [TBD - obtain from VPNresellers]  
**Support Contact:** [TBD - add VPNresellers support email]  
**Revenue Share:** [TBD - negotiate with VPNresellers]  

**Next Steps:**
1. Confirm VPNresellers API key and reseller ID
2. Get exact plan ID mappings
3. Test API endpoints in sandbox
4. Implement backend integration
5. Deploy to production

---

**Last Updated:** March 5, 2026, 2:53 AM EST  
**Status:** Ready for backend integration (API endpoint documentation needed from VPNresellers)
