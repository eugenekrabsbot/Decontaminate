# AhoyVPN Incident Response Quick Reference

**Emergency Contact:** security@ahoyvpn.net | +1-XXX-XXX-XXXX (24/7)

---

## Immediate Actions for Security Incidents

### Step 1: Identify and Classify
- **Critical:** Data breach, ransomware, DDoS → Respond within 15 minutes
- **High:** Unauthorized access, malware → Respond within 1 hour
- **Medium:** Policy violations → Respond within 4 hours
- **Low:** Minor issues → Respond within 24 hours

### Step 2: Contain
1. Isolate affected systems
2. Block malicious traffic
3. Disable compromised accounts
4. Preserve evidence

### Step 3: Notify
**Internal:**
- Security Officer: security@ahoyvpn.net
- Lead Developer: dev@ahoyvpn.net
- Executive Sponsor: executive@ahoyvpn.net

**External (if confirmed breach):**
- Payment Brands: Within 72 hours
- Acquirer: Immediately
- Legal Counsel: Immediately

### Step 4: Investigate
- Gather logs and evidence
- Determine scope of incident
- Identify root cause
- Document findings

### Step 5: Remediate
- Remove malware/intruders
- Patch vulnerabilities
- Reset credentials
- Verify system integrity

### Step 6: Recover
- Restore from clean backups
- Monitor for recurrence
- Verify functionality
- Document lessons learned

---

## Payment Brand Contact Information

| Brand | Phone | Website | Email |
|-------|-------|---------|-------|
| Visa | 1-800-847-2911 | visa.com/security | security@visa.com |
| Mastercard | 1-800-627-8372 | mastercard.com/security | security@mastercard.com |
| American Express | 1-800-528-4800 | americanexpress.com/security | security@aexp.com |
| Discover | 1-800-347-7444 | discover.com/security | security@discover.com |

---

## TPSP Emergency Contacts

| TPSP | Service | Emergency Contact |
|------|---------|-------------------|
| Plisio | Crypto payments | support@plisio.com |
| PaymentsCloud | Fiat payments | support@paymentscloud.com |
| Hetzner Cloud | Hosting | support@hetzner.com |

---

## Critical System Recovery Procedures

### Database Recovery (PostgreSQL)
1. Stop application services
2. Restore from latest backup
3. Verify data integrity
4. Restart services
5. Monitor for issues

### Backend API Recovery
1. Stop affected instances
2. Restore from clean backup
3. Update configuration
4. Restart instances
5. Verify functionality

### Payment Processing Recovery
1. Disable payment processing
2. Notify payment processors
3. Restore from backup
4. Test with small transaction
5. Re-enable processing

---

## Documentation Requirements

**Incident Report Must Include:**
- Date/time of detection
- Incident description and classification
- Systems/data affected
- Scope of compromise
- Actions taken
- Remediation plan
- Contact information

**Retention:** 7 years from incident date

---

## Training and Drills

**Annual:**
- Security awareness training (all employees)
- Incident response procedures (response team)
- Secure coding practices (developers)

**Quarterly:**
- Tabletop exercises (incident response team)
- Business continuity drills
- Backup restoration tests

---

## Document Control

**Version:** 1.0
**Effective Date:** March 26, 2026
**Review Date:** March 26, 2027
**Owner:** Security Officer

---

**Remember:** When in doubt, escalate to Security Officer immediately.
