# AhoyVPN Completion Checklist

**Last Updated:** March 26, 2026
**Status:** Backend operational, pending deployment and integration tasks

---

## ✅ Completed Tasks

### Backend Development
- [x] Numeric account system implemented
- [x] PCI DSS password compliance implemented
- [x] Database migrations completed
- [x] Seed script with PCI-compliant passwords
- [x] Backend API deployed and running on port 3000
- [x] Security policy and incident response plan documented

### Security
- [x] Firewall configured (UFW)
- [x] SSH hardened (key-only, root login disabled)
- [x] Rootkit detection tools installed (rkhunter, chkrootkit)
- [x] fail2ban installed and running
- [x] Security monitoring scheduled
- [x] Incident response plan documented

---

## 🔄 In Progress / Pending

### 1. Payment Integration (HIGH PRIORITY)

#### Plisio (Cryptocurrency Payments)
- [ ] **Reconfigure Plisio integration**
  - Update API keys in `.env`
  - Test webhook endpoint
  - Verify HMAC signature verification
  - Test payment flow end-to-end
  - **Status:** ⏳ Need to update configuration

#### PaymentsCloud/Authorize.net (Fiat Payments)
- [ ] **Configure PaymentsCloud integration**
  - Set up API credentials
  - Configure payment form
  - Test webhook endpoint
  - Verify PCI DSS compliance
  - **Status:** ⏳ Need to configure

### 2. Infrastructure & Deployment (HIGH PRIORITY)

#### Domain & SSL
- [ ] **Configure domain (ahoyvpn.net)**
  - Point DNS to server IP (89.167.46.117)
  - Set up SSL certificate (Let's Encrypt)
  - Configure reverse proxy (Nginx)
  - **Status:** ⏳ Pending domain configuration

#### Cloudflare Tunnels
- [ ] **Set up Cloudflare Tunnel for backend**
  - Install cloudflared on server
  - Create tunnel for backend API
  - Configure DNS for tunnel
  - **Status:** ⏳ Need to decide on tunnel vs direct access
  - **Note:** Cloudflare Tunnel provides secure access without exposing server IP

#### Frontend Deployment
- [ ] **Deploy frontend to production**
  - Build frontend for production
  - Configure API endpoint to point to backend
  - Deploy to web server
  - **Status:** ⏳ Pending frontend deployment

### 3. Email Service (MEDIUM PRIORITY)

#### Transactional Emails
- [ ] **Set up email service**
  - Choose provider (SendGrid, Postmark, AWS SES)
  - Configure SMTP/API credentials
  - Test email delivery
  - Update `.env` with email configuration
  - **Status:** ⏳ Need to select provider

#### Email Templates
- [ ] **Create email templates**
  - Welcome email
  - Password reset email
  - Payment confirmation email
  - Account recovery email
  - **Status:** ⏳ Pending template creation

### 4. Monitoring & Alerting (MEDIUM PRIORITY)

#### System Monitoring
- [ ] **Set up monitoring**
  - Install monitoring agent (Datadog, New Relic, or custom)
  - Configure alerts for critical issues
  - Set up log aggregation
  - **Status:** ⏳ Need to select monitoring solution

#### Performance Monitoring
- [ ] **Monitor application performance**
  - Response time monitoring
  - Error rate tracking
  - Database performance monitoring
  - **Status:** ⏳ Pending setup

### 5. Testing (MEDIUM PRIORITY)

#### Payment Flow Testing
- [ ] **Test full payment flow**
  - Test Plisio crypto payment
  - Test PaymentsCloud fiat payment
  - Test account creation after payment
  - Test password change flow
  - **Status:** ⏳ Pending testing

#### Security Testing
- [ ] **Conduct security testing**
  - Vulnerability scanning
  - Penetration testing
  - PCI DSS compliance verification
  - **Status:** ⏳ Pending testing

### 6. Documentation (MEDIUM PRIORITY)

#### SAQ A Completion
- [ ] **Complete SAQ A questionnaire**
  - Gather evidence of compliance
  - Complete self-assessment
  - Obtain AOC from payment processors
  - **Status:** ⏳ Pending completion

#### User Documentation
- [ ] **Create user documentation**
  - Customer guide
  - Affiliate guide
  - Admin guide
  - **Status:** ⏳ Pending creation

### 7. Business Setup (LOW PRIORITY)

#### LLC Formation
- [ ] **Complete Pennsylvania LLC formation**
  - File Articles of Organization
  - Obtain EIN
  - Set up business bank account
  - **Status:** ⏳ Waiting for funds ($125 state fee)

#### Registered Agent
- [ ] **Select registered agent service**
  - Research options ($50-150/year)
  - Select service
  - Update LLC formation documents
  - **Status:** ⏳ Pending selection

---

## 📋 Detailed Task Breakdown

### Task 1: Plisio Reconfiguration

**Steps:**
1. Update Plisio API keys in `.env`:
   ```
   PLISIO_API_KEY=your_api_key
   PLISIO_SECRET_KEY=your_secret_key
   ```

2. Test webhook endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/webhooks/plisio \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

3. Verify HMAC signature verification in `paymentController.js`

4. Test payment flow:
   - Create checkout session
   - Complete payment in Plisio
   - Verify webhook receives confirmation
   - Check account is activated

**Estimated Time:** 2-3 hours

### Task 2: PaymentsCloud Configuration

**Steps:**
1. Obtain PaymentsCloud API credentials
2. Configure API client in backend
3. Update checkout flow to support fiat payments
4. Test payment flow end-to-end
5. Verify PCI DSS compliance

**Estimated Time:** 3-4 hours

### Task 3: Domain & SSL Setup

**Steps:**
1. Point DNS A record to 89.167.46.117
2. Install Nginx on server
3. Configure Nginx reverse proxy
4. Install Let's Encrypt SSL certificate
5. Test HTTPS access

**Estimated Time:** 2-3 hours

### Task 4: Cloudflare Tunnel Setup

**Steps:**
1. Install cloudflared on server
2. Authenticate with Cloudflare account
3. Create tunnel for backend API
4. Configure DNS for tunnel
5. Test secure access

**Estimated Time:** 1-2 hours

### Task 5: Frontend Deployment

**Steps:**
1. Build frontend for production
2. Configure API endpoint
3. Deploy to web server
4. Test frontend functionality
5. Verify API connectivity

**Estimated Time:** 2-3 hours

### Task 6: Email Service Setup

**Steps:**
1. Select email provider (SendGrid recommended)
2. Create account and obtain API key
3. Install email service SDK
4. Configure email templates
5. Test email delivery

**Estimated Time:** 2-3 hours

### Task 7: Monitoring Setup

**Steps:**
1. Select monitoring solution (Datadog free tier recommended)
2. Install monitoring agent
3. Configure alerts
4. Set up log aggregation
5. Test alerting

**Estimated Time:** 2-3 hours

### Task 8: Payment Flow Testing

**Steps:**
1. Test Plisio crypto payment flow
2. Test PaymentsCloud fiat payment flow
3. Test account creation after payment
4. Test password change flow
5. Test recovery kit flow

**Estimated Time:** 3-4 hours

### Task 9: Security Testing

**Steps:**
1. Run vulnerability scan
2. Conduct penetration test
3. Verify PCI DSS compliance
4. Document findings
5. Remediate issues

**Estimated Time:** 4-6 hours

### Task 10: SAQ A Completion

**Steps:**
1. Gather evidence of compliance
2. Complete SAQ A questionnaire
3. Obtain AOC from payment processors
4. Document compliance
5. Submit to acquirer (if required)

**Estimated Time:** 2-3 hours

---

## 🎯 Priority Order

### Immediate (Next 24-48 hours)
1. Plisio reconfiguration
2. PaymentsCloud configuration
3. Domain & SSL setup
4. Frontend deployment

### Short-term (Next week)
5. Email service setup
6. Payment flow testing
7. Monitoring setup

### Medium-term (Next 2-4 weeks)
8. Security testing
9. SAQ A completion
10. Business setup (LLC formation)

---

## 📝 Notes

### Cloudflare Tunnels Decision
**Option 1: Direct Access**
- Pros: Simpler setup, no Cloudflare dependency
- Cons: Exposes server IP, requires firewall rules

**Option 2: Cloudflare Tunnel**
- Pros: Secure, hides server IP, DDoS protection
- Cons: Additional dependency, Cloudflare account required

**Recommendation:** Use Cloudflare Tunnel for production for better security

### Authorize.net vs PaymentsCloud
- **PaymentsCloud** is the reseller/provider
- **Authorize.net** is the payment gateway
- Both need configuration for fiat payments

### Missing Items
- [ ] Email service provider selection
- [ ] Monitoring solution selection
- [ ] Frontend deployment target
- [ ] Domain registrar configuration

---

## ✅ Success Criteria

### Backend
- [ ] Plisio payments working
- [ ] PaymentsCloud payments working
- [ ] Account creation flow working
- [ ] Password management working
- [ ] Security policies enforced

### Infrastructure
- [ ] Domain configured (ahoyvpn.net)
- [ ] SSL certificate installed
- [ ] Reverse proxy configured
- [ ] Cloudflare Tunnel active (optional)

### Operations
- [ ] Email service operational
- [ ] Monitoring and alerting active
- [ ] Security testing completed
- [ ] SAQ A completed

### Business
- [ ] LLC formed
- [ ] Registered agent selected
- [ ] Payment processor agreements signed

---

**Status:** Backend operational, pending integration and deployment tasks
**Next Action:** Reconfigure Plisio integration and set up domain/SSL
