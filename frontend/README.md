# AHOY VPN - Frontend

Privacy-first VPN subscription service frontend. Built with React/Next.js.

## Architecture

### Pages & Routes

- `/` - Homepage with plan cards and feature explanation
- `/checkout` - Plan selection, payment method choice, affiliate code input, account provisioning (TODO)
- `/login` - Numeric username/password login (TODO)
- `/recover` - Recovery kit flow (TODO)
- `/dashboard` - Customer subscription status, metrics, actions (TODO)
- `/affiliate` - Affiliate dashboard with referral codes and metrics (TODO)
- `/admin` - Admin dashboard with customer/affiliate management (TODO)
- `/tos` - Terms of Service (TODO)
- `/privacy` - Privacy Policy (TODO)
- `/faq` - Frequently Asked Questions (TODO)

### Components

#### UI Library
- `Button` - Variants: primary, secondary, danger; sizes: sm, md, lg
- `Card` - Container with optional title/subtitle
- Form components (TODO)
- Alert component (TODO)
- Modal component (TODO)
- Tabs component (TODO)

#### Layout
- `Layout` - Main layout with header, nav, footer
- `Header` - Sticky navigation with auth-aware links
- `Footer` - Links to legal pages and support

### API Client

**File:** `api/client.js`

All API calls are mocked with realistic delays (300-500ms). Replace mock functions with real API endpoints when backend is ready.

#### Backend Integration Points (TODO)

```javascript
// Authentication
POST /auth/login - user login
POST /auth/recover - recovery kit flow

// User Management
GET /user - get user profile
POST /user/change-password - change password
POST /user/generate-recovery-kit - generate new recovery kit
POST /user/delete - delete account

// Subscription
GET /subscription - get subscription status
POST /subscription/change-plan - upgrade/downgrade
POST /subscription/cancel - cancel subscription

// Checkout
POST /checkout/initiate - initiate payment session
POST /checkout/confirm - confirm payment and provision account
TODO: Plisio webhook integration (crypto payments)
TODO: PaymentsCloud webhook integration (fiat payments)

// Affiliate
POST /affiliate/generate-code - generate referral code
GET /affiliate/metrics - get affiliate metrics

// Admin
GET /admin/customers/:userId - get customer details
POST /admin/customers/:userId/actions - admin actions (deactivate, reset, etc.)
GET /admin/metrics - get system KPIs
GET /admin/affiliates - search and manage affiliates
```

### Authentication

**Current:** Mock localStorage-based session (token + user data)

**TODO:** Replace with real JWT authentication:
- API returns token on login/recovery
- Axios interceptor adds `Authorization: Bearer <token>` to requests
- Token validation on protected routes
- Redirect to `/login` on 401 unauthorized

### Design System

#### Colors (from `config/colors.js`)

**Dark Mode (Default)**
- Primary BG: `#121212`
- Card BG: `#252525`
- Primary Accent: `#1E90FF` (Blue Sails)
- Secondary Accent: `#20B2AA` (Ocean Waves)
- Text Primary: `#F0F4F8`
- Text Secondary: `#B0C4DE`

**Light Mode** (TODO - toggle available)
- Primary BG: `#FFFFFF`
- Text: `#0A1D37`

#### Responsive Design
- Mobile-first approach
- CSS Grid/Flexbox for layouts
- Breakpoints: auto-fit with `minmax()`

#### Accessibility
- Semantic HTML (button, nav, section, etc.)
- ARIA labels on interactive elements (TODO)
- Keyboard navigation support (TODO)
- High contrast colors (WCAG AA compliant)
- Reduced motion support in CSS

## Setup & Development

### Install Dependencies

```bash
npm install
```

### Run Locally

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Build for Production

```bash
npm run build
npm run start
```

### Environment Variables

Create a `.env.local` file:

```env
# API endpoint (default: http://localhost:3000/api)
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## Project Structure

```
ahoyvpn-frontend/
├── pages/              # Next.js pages (routes)
│   ├── _app.jsx       # Main App wrapper with auth context
│   ├── _document.jsx  # HTML document (TODO)
│   ├── index.jsx      # Homepage
│   ├── checkout.jsx   # Checkout flow (TODO)
│   ├── login.jsx      # Login page (TODO)
│   ├── recover.jsx    # Recovery kit flow (TODO)
│   ├── dashboard.jsx  # Customer dashboard (TODO)
│   ├── affiliate.jsx  # Affiliate dashboard (TODO)
│   ├── admin.jsx      # Admin panel (TODO)
│   ├── tos.jsx        # Terms of Service (TODO)
│   ├── privacy.jsx    # Privacy Policy (TODO)
│   └── faq.jsx        # FAQ page (TODO)
├── components/        # React components
│   ├── Layout.jsx     # Main layout with header/footer
│   ├── ui/            # UI component library
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Form.jsx   # TODO
│   │   ├── Alert.jsx  # TODO
│   │   ├── Modal.jsx  # TODO
│   │   └── Tabs.jsx   # TODO
│   ├── ProtectedRoute.jsx  # TODO - route guard component
│   └── ...
├── api/               # API client wrapper
│   └── client.js      # Mock API client with TODO markers
├── config/            # Configuration
│   └── colors.js      # Color palette
├── hooks/             # Custom React hooks (TODO)
│   ├── useAuth.js
│   └── ...
├── styles/            # Global and component styles
│   └── globals.css
├── public/            # Static assets
│   └── ...
├── lib/               # Utility functions (TODO)
│   └── ...
├── next.config.js     # Next.js configuration
├── package.json
└── README.md
```

## Key Features (TODO)

### Phase 1 ✅ COMPLETE
- [x] Project scaffolding
- [x] Design system (colors, typography)
- [x] Layout component (header, footer, nav)
- [x] Mock API client with TODO markers
- [x] Homepage with plan cards
- [x] Initial routing structure

### Phase 2 IN PROGRESS
- [ ] Public pages (/checkout, /tos, /privacy, /faq)
- [ ] Payment method selection (Crypto/Fiat mock)
- [ ] Account provisioning after checkout
- [ ] Recovery kit download/copy
- [ ] Legal pages content

### Phase 3 NEXT
- [ ] Authentication pages (/login, /recover)
- [ ] Customer dashboard (/dashboard)
  - Subscription status display
  - Change password
  - Generate recovery kit
  - Upgrade/downgrade/cancel
  - Support contact
- [ ] Affiliate dashboard (/affiliate)
  - Referral code generation
  - Metrics and earnings
- [ ] Admin dashboard (/admin)
  - Customer search and management
  - Affiliate management
  - System KPIs

### Phase 4 POLISH
- [ ] Form validation and error handling
- [ ] Loading states and spinners
- [ ] Responsive design refinement
- [ ] Accessibility audit (ARIA, keyboard nav)
- [ ] Security review (CSRF, XSS, sensitive data)
- [ ] Performance optimization (code splitting, images)
- [ ] GitHub push and CI/CD setup

## Security Considerations

### Current (Mock)
- localStorage-based auth (not secure for production)
- Mock API responses (no real auth)

### TODO - Real Implementation
- **NEVER re-show full secrets** without re-authentication (modal + password prompt)
- **Copy-to-clipboard with warnings** and time-limited reveals for sensitive data
- **Form protection:** Debouncing, validation, CSRF tokens (TODO)
- **Token-ready:** Session design ready for JWT + refresh tokens
- **Secure headers:** CSP, X-Frame-Options, X-Content-Type-Options (TODO)
- **Input sanitization:** DOMPurify or similar (TODO)

## Integration Notes

### Payment Providers (TODO)
- **Plisio (Crypto):** Mock redirect to `https://checkout.plisio.net`
  - Webhook: POST `/webhook/plisio` on backend
  - Response: transaction ID, confirmation
- **PaymentsCloud (Fiat):** Mock redirect to `https://checkout.paymentscloud.com`
  - Webhook: POST `/webhook/paymentscloud` on backend
  - Response: transaction ID, confirmation

### VPNresellers API (TODO)
- Get subscription status from VPNresellers API
- Display in customer dashboard
- Link account changes to VPNresellers account management

### Affiliate System (TODO)
- Track referral codes in database
- Calculate earnings based on conversions
- Webhook integration for subscription events

## Notes

- **No email collection:** Privacy-first design; numeric IDs only
- **No payment storage:** All payments handled by third parties
- **Numeric credentials:** Username and password are both numeric
- **Recovery kits:** Single-use, generated per account, downloadable
- **Dark mode default:** Light mode as optional toggle

## Support

For questions or issues, contact: ahoyvpn@ahoyvpn.net

---

**Status:** Phase 1 complete. Frontend scaffold ready for Phase 2 (public pages + checkout).
