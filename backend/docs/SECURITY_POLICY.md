# AhoyVPN Information Security Policy & Incident Response Plan

**Document Version:** 1.0
**Effective Date:** March 26, 2026
**Last Updated:** March 26, 2026
**Owner:** Security Officer
**Classification:** Confidential

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Information Security Policy](#2-information-security-policy)
3. [Incident Response Plan](#3-incident-response-plan)
4. [Business Recovery and Continuity](#4-business-recovery-and-continuity)
5. [Data Backup Processes](#5-data-backup-processes)
6. [Legal Requirements for Reporting Compromises](#6-legal-requirements-for-reporting-compromises)
7. [Critical System Components Coverage](#7-critical-system-components-coverage)
8. [Third-Party Service Providers (TPSPs)](#8-third-party-service-providers-tp-sps)
9. [TPSP Agreements and Due Diligence](#9-tpsp-agreements-and-due-diligence)
10. [TPSP Compliance Monitoring Program](#10-tpsp-compliance-monitoring-program)
11. [Payment Brand Incident Response Procedures](#11-payment-brand-incident-response-procedures)
12. [Appendices](#12-appendices)

---

## 1. Purpose and Scope

### 1.1 Purpose
This document establishes AhoyVPN's information security policy and incident response plan to protect cardholder data, ensure PCI DSS compliance, and maintain business continuity in the event of security incidents.

### 1.2 Scope
This policy applies to:
- All AhoyVPN employees, contractors, and third-party service providers
- All systems, networks, and applications that store, process, or transmit cardholder data
- All payment processing activities
- All customer account data (numeric accounts, passwords, recovery kits)

### 1.3 Compliance Requirements
This policy ensures compliance with:
- PCI DSS Requirements 12.10 and 12.11
- PCI DSS Requirement 12.8 (TPSP management)
- Applicable data protection regulations

---

## 2. Information Security Policy

### 2.1 Security Objectives
- **Confidentiality:** Protect cardholder data and customer information from unauthorized access
- **Integrity:** Ensure data accuracy and prevent unauthorized modification
- **Availability:** Maintain system availability for legitimate business purposes

### 2.2 Security Principles
1. **Least Privilege:** Users and systems have only the minimum access necessary
2. **Defense in Depth:** Multiple layers of security controls
3. **Continuous Monitoring:** Ongoing security monitoring and assessment
4. **Incident Preparedness:** Regular testing and updating of response procedures

### 2.3 Cardholder Data Environment (CDE)
The CDE includes all systems, networks, and applications that store, process, or transmit cardholder data:
- Payment processing systems (Plisio, PaymentsCloud)
- Customer database (PostgreSQL)
- Backend API servers
- Web application servers

### 2.4 Security Controls
- **Network Security:** Firewalls, intrusion detection/prevention, network segmentation
- **Access Control:** Role-based access control, multi-factor authentication
- **Encryption:** TLS 1.2+ for data in transit, encryption for sensitive data at rest
- **Monitoring:** Security logging, alerting, and incident detection
- **Vulnerability Management:** Regular scanning and patching

---

## 3. Incident Response Plan

### 3.1 Incident Response Team

#### 3.1.1 Roles and Responsibilities

| Role | Name/Title | Responsibilities | Contact |
|------|------------|------------------|---------|
| **Incident Response Manager** | Security Officer | Overall coordination, decision-making, escalation | security@ahoyvpn.net |
| **Technical Lead** | Lead Developer | Technical analysis, containment, remediation | dev@ahoyvpn.net |
| **Communications Lead** | Operations Manager | Internal/external communications, notifications | ops@ahoyvpn.net |
| **Legal Counsel** | External Legal Firm | Legal compliance, regulatory notifications | legal@ahoyvpn.net |
| **Executive Sponsor** | CEO/CTO | Executive oversight, business decisions | executive@ahoyvpn.net |

#### 3.1.2 Communication and Contact Strategies

**Internal Communication:**
- Primary: Secure messaging platform (Slack/Teams)
- Secondary: Phone/SMS for urgent incidents
- Tertiary: Email for documentation

**External Communication:**
- Payment Brands: Contact via designated channels (see Section 11)
- Acquirers: Contact via designated channels
- Customers: Via email or platform notifications
- Regulators: Via legal counsel

**Contact Information:**
- Security Hotline: +1-XXX-XXX-XXXX (24/7)
- Email: security@ahoyvpn.net
- Emergency: 911 (for physical security incidents)

### 3.2 Incident Response Procedures

#### 3.2.1 Incident Detection and Reporting

**Detection Methods:**
- Automated security monitoring (IDS/IPS, SIEM)
- User reports (employees, customers)
- Payment brand notifications
- External security researchers

**Reporting Channels:**
- Internal: security@ahoyvpn.net
- External: security@ahoyvpn.net (encrypted)
- Anonymous: SecureDrop (if available)

**Initial Response Time:**
- Critical incidents: 15 minutes
- High incidents: 1 hour
- Medium incidents: 4 hours
- Low incidents: 24 hours

#### 3.2.2 Incident Classification

| Severity | Definition | Examples | Response Time |
|----------|------------|----------|---------------|
| **Critical** | Immediate threat to cardholder data or business operations | Data breach, ransomware, DDoS attack | 15 minutes |
| **High** | Significant risk to security or compliance | Unauthorized access, malware infection | 1 hour |
| **Medium** | Moderate risk requiring investigation | Policy violation, suspicious activity | 4 hours |
| **Low** | Minor issues with minimal risk | Failed login attempts, configuration errors | 24 hours |

#### 3.2.3 Incident Response Phases

**Phase 1: Preparation**
- Maintain incident response toolkit
- Regular training and drills
- Documented procedures
- Contact lists updated

**Phase 2: Identification**
- Gather initial information
- Classify incident severity
- Notify incident response team
- Preserve evidence

**Phase 3: Containment**
- Isolate affected systems
- Block malicious traffic
- Disable compromised accounts
- Prevent data exfiltration

**Phase 4: Eradication**
- Remove malware/intruders
- Patch vulnerabilities
- Reset credentials
- Verify system integrity

**Phase 5: Recovery**
- Restore systems from clean backups
- Monitor for recurrence
- Verify functionality
- Document lessons learned

**Phase 6: Lessons Learned**
- Conduct post-incident review
- Update procedures
- Implement improvements
- Share findings with team

#### 3.2.4 Specific Incident Types

**Data Breach:**
1. Immediately isolate affected systems
2. Preserve forensic evidence
3. Notify legal counsel
4. Determine scope of breach
5. Notify payment brands and acquirers (see Section 11)
6. Notify affected customers (if required by law)
7. Engage forensic investigator

**Ransomware Attack:**
1. Isolate infected systems
2. Do not pay ransom without consulting legal counsel
3. Restore from clean backups
4. Investigate root cause
5. Implement additional protections

**Unauthorized Access:**
1. Disable compromised accounts
2. Reset passwords
3. Investigate access logs
4. Determine data accessed
5. Implement additional access controls

**DDoS Attack:**
1. Activate DDoS mitigation services
2. Notify ISP/hosting provider
3. Monitor traffic patterns
4. Implement rate limiting
5. Document attack for law enforcement

**Insider Threat:**
1. Disable employee access
2. Preserve evidence
3. Conduct investigation
4. Notify legal counsel
5. Implement additional monitoring

### 3.3 Incident Response Documentation

All incidents must be documented in the Incident Response Log, including:
- Date/time of detection
- Incident description and classification
- Actions taken
- Personnel involved
- Resolution details
- Lessons learned

---

## 4. Business Recovery and Continuity

### 4.1 Business Impact Analysis

**Critical Business Functions:**
1. Payment processing
2. Customer account access
3. VPN service delivery
4. Customer support
5. Billing and invoicing

**Recovery Time Objectives (RTO):**
- Payment processing: 4 hours
- Customer account access: 8 hours
- VPN service: 24 hours
- Customer support: 24 hours
- Billing: 48 hours

**Recovery Point Objectives (RPO):**
- Customer data: 24 hours
- Transaction data: 1 hour
- Configuration data: 24 hours

### 4.2 Business Continuity Procedures

**Activation Criteria:**
- Security incident affecting critical systems
- Natural disaster affecting primary data center
- Extended system outage (> 4 hours)
- Loss of key personnel

**Continuity Procedures:**
1. Activate Business Continuity Team
2. Assess impact and scope
3. Implement recovery procedures
4. Communicate with stakeholders
5. Monitor recovery progress
6. Return to normal operations

### 4.3 Disaster Recovery Procedures

**Primary Data Center (Hetzner Cloud):**
- Location: Germany
- Redundancy: Multiple availability zones
- Backup: Daily snapshots

**Recovery Procedures:**
1. Activate backup data center
2. Restore critical systems from backups
3. Update DNS records
4. Verify functionality
5. Monitor for issues

**Failover Testing:**
- Quarterly failover tests
- Document results
- Update procedures as needed

---

## 5. Data Backup Processes

### 5.1 Backup Strategy

**Backup Types:**
- **Full Backups:** Weekly (Sunday 2:00 AM EST)
- **Incremental Backups:** Daily (2:00 AM EST)
- **Transaction Logs:** Continuous (PostgreSQL WAL archiving)

**Backup Retention:**
- Daily backups: 7 days
- Weekly backups: 4 weeks
- Monthly backups: 12 months
- Annual backups: 7 years

### 5.2 Backup Procedures

**Database Backups (PostgreSQL):**
```bash
# Full backup
pg_dump -h localhost -U ahoyvpn ahoyvpn > /backups/full_$(date +%Y%m%d).sql

# Incremental backup (WAL archiving)
# Configured in postgresql.conf
```

**Application Backups:**
- Source code: Git repository (GitHub)
- Configuration files: Encrypted backups
- User uploads: S3-compatible storage with versioning

**Backup Verification:**
- Weekly restore tests
- Checksum verification
- Integrity validation

### 5.3 Backup Storage

**Primary Storage:**
- Local: /backups/ (encrypted)
- Cloud: S3-compatible storage (encrypted)

**Offsite Storage:**
- Geographic separation from primary data center
- Encrypted during transfer and storage
- Access controls in place

### 5.4 Backup Security

**Encryption:**
- AES-256 encryption for all backups
- Encryption keys stored separately from backups
- Key rotation every 90 days

**Access Controls:**
- Role-based access to backups
- Audit logging of backup access
- Regular review of backup permissions

---

## 6. Legal Requirements for Reporting Compromises

### 6.1 Regulatory Framework

**PCI DSS Requirements:**
- Report suspected breaches to payment brands within 72 hours
- Report confirmed breaches to acquirers immediately
- Cooperate with forensic investigations

**Data Protection Regulations:**
- GDPR (if applicable): 72-hour notification to supervisory authority
- State breach notification laws: Vary by jurisdiction
- Industry-specific regulations: As applicable

### 6.2 Reporting Procedures

**Payment Brand Notification:**
- Visa: Report via Visa Global Security Portal
- Mastercard: Report via Mastercard Security Center
- American Express: Report via Amex Security
- Discover: Report via Discover Security

**Acquirer Notification:**
- Contact acquirer's security team immediately
- Provide incident details and scope
- Cooperate with investigation

**Customer Notification:**
- Required if personal data compromised
- Timing: As required by law (varies by jurisdiction)
- Method: Email, mail, or public notice
- Content: Clear, concise, non-technical

### 6.3 Documentation Requirements

**Incident Report Must Include:**
- Date and time of incident
- Nature of incident
- Systems/data affected
- Scope of compromise
- Actions taken
- Remediation plan
- Contact information

---

## 7. Critical System Components Coverage

### 7.1 System Inventory

**Critical Components:**

| System | Function | Owner | Criticality |
|--------|----------|-------|-------------|
| PostgreSQL Database | Customer data storage | Dev Team | Critical |
| Backend API Server | Payment processing, account management | Dev Team | Critical |
| Frontend Web Server | Customer interface | Dev Team | High |
| Payment Processors | Plisio, PaymentsCloud | Finance | Critical |
| Email Service | Customer communications | Ops | High |
| Monitoring Systems | Security monitoring | Security | Critical |

### 7.2 Security Controls by Component

**PostgreSQL Database:**
- Network: Private subnet, no direct internet access
- Access: Role-based, encrypted connections
- Encryption: Data at rest (if supported)
- Monitoring: Query logging, access auditing

**Backend API Server:**
- Network: Behind WAF, rate limiting enabled
- Access: API keys, JWT authentication
- Encryption: TLS 1.2+ for all connections
- Monitoring: Request logging, anomaly detection

**Payment Processors:**
- Network: Direct API connections only
- Access: API keys, HMAC verification
- Encryption: TLS 1.2+ for all connections
- Monitoring: Transaction logging, fraud detection

### 7.3 System Hardening

**Operating System:**
- Regular security updates
- Unnecessary services disabled
- Firewall configured (UFW)
- SSH hardened (key-only, root login disabled)

**Applications:**
- Regular dependency updates
- Security scanning (npm audit, Snyk)
- Code review for security issues
- Input validation and sanitization

---

## 8. Third-Party Service Providers (TPSPs)

### 8.1 TPSP Inventory

**Payment Processors:**

| TPSP | Service | Data Shared | Security Responsibility |
|------|---------|-------------|------------------------|
| **Plisio** | Cryptocurrency payments | Transaction data, wallet addresses | TPSP responsible for payment security |
| **PaymentsCloud** | Fiat payment processing | Cardholder data (PCI DSS scope) | TPSP responsible for PCI DSS compliance |

**Infrastructure Providers:**

| TPSP | Service | Data Shared | Security Responsibility |
|------|---------|-------------|------------------------|
| **Hetzner Cloud** | Hosting/VPS | Server data (encrypted) | TPSP responsible for physical security |
| **PostgreSQL** | Database service | Customer data (encrypted) | Shared responsibility |
| **GitHub** | Code repository | Source code | TPSP responsible for platform security |

**Communication Providers:**

| TPSP | Service | Data Shared | Security Responsibility |
|------|---------|-------------|------------------------|
| **Email Service** | Transactional emails | Customer email addresses | TPSP responsible for email security |
| **Domain Registrar** | DNS management | Domain records | TPSP responsible for DNS security |

### 8.2 TPSP Security Requirements

**All TPSPs must:**
1. Maintain PCI DSS compliance (if handling cardholder data)
2. Implement appropriate security controls
3. Provide security attestations (ROC, AOC)
4. Notify of security incidents affecting our data
5. Cooperate with security assessments

---

## 9. TPSP Agreements and Due Diligence

### 9.1 Written Agreements

**Required Contractual Provisions:**
1. **Security Responsibility Acknowledgment:**
   - TPSP acknowledges responsibility for security of account data
   - TPSP agrees to maintain PCI DSS compliance
   - TPSP agrees to notify of security incidents

2. **Data Protection:**
   - Data encryption requirements
   - Access control requirements
   - Data retention and deletion policies

3. **Audit Rights:**
   - Right to audit TPSP security controls
   - Right to review security attestations
   - Right to request security documentation

4. **Incident Notification:**
   - Notification timeframe (immediate for critical incidents)
   - Notification method (email, phone)
   - Required information to be provided

5. **Termination:**
   - Security breach as cause for termination
   - Data return/deletion requirements
   - Transition assistance

### 9.2 Due Diligence Process

**Pre-Engagement Due Diligence:**
1. **Security Assessment:**
   - Review security policies and procedures
   - Request PCI DSS compliance documentation
   - Review SOC 2 Type II reports (if available)
   - Assess security track record

2. **Contract Review:**
   - Verify security provisions in contract
   - Ensure liability and indemnification clauses
   - Review data protection terms

3. **Technical Assessment:**
   - Review security architecture
   - Assess encryption implementation
   - Evaluate access controls

4. **Risk Assessment:**
   - Identify potential risks
   - Evaluate risk mitigation measures
   - Document risk acceptance

### 9.3 TPSP Agreement Management

**Documentation:**
- Maintain signed agreements in secure repository
- Track agreement expiration dates
- Document due diligence findings
- Maintain security attestations

**Review Schedule:**
- Annual review of all TPSP agreements
- Review upon contract renewal
- Review upon security incident

---

## 10. TPSP Compliance Monitoring Program

### 10.1 Monitoring Objectives

- Ensure TPSPs maintain PCI DSS compliance
- Identify security risks from TPSP relationships
- Maintain current compliance status information
- Ensure timely remediation of security issues

### 10.2 Monitoring Schedule

**Annual Monitoring:**
- Review PCI DSS compliance status of all TPSPs
- Request updated security attestations
- Review security incident history
- Assess ongoing risk

**Quarterly Monitoring:**
- Review TPSP security updates
- Monitor for security advisories
- Assess changes in TPSP services

**Continuous Monitoring:**
- Subscribe to TPSP security notifications
- Monitor for security incidents affecting TPSPs
- Track TPSP compliance status changes

### 10.3 Compliance Status Tracking

**TPSP Compliance Matrix:**

| TPSP | PCI DSS Managed By | Last Review | Next Review | Status |
|------|-------------------|-------------|-------------|--------|
| Plisio | TPSP (Level 1) | 2026-03-01 | 2027-03-01 | ✅ Compliant |
| PaymentsCloud | TPSP (Level 1) | 2026-03-01 | 2027-03-01 | ✅ Compliant |
| Hetzner Cloud | Shared | 2026-03-01 | 2027-03-01 | ✅ Compliant |
| PostgreSQL | Shared | 2026-03-01 | 2027-03-01 | ✅ Compliant |

**Responsibility Matrix:**

| PCI DSS Requirement | AhoyVPN | TPSP | Shared |
|---------------------|---------|------|--------|
| Network Security | ✅ | | |
| Access Control | ✅ | | |
| Encryption | | ✅ | |
| Monitoring | ✅ | | |
| Vulnerability Management | ✅ | | |
| Incident Response | ✅ | | |
| Policy Development | ✅ | | |

### 10.4 Remediation Process

**Identified Issues:**
1. Document issue and risk
2. Notify TPSP of issue
3. Agree on remediation timeline
4. Track remediation progress
5. Verify issue resolution

**Escalation:**
- If TPSP fails to remediate: Escalate to management
- If critical issue: Consider contract termination
- If compliance issue: Suspend data sharing

---

## 11. Payment Brand Incident Response Procedures

### 11.1 Visa Global Security Portal

**Contact:**
- Website: https://visa.com/security
- Phone: 1-800-847-2911 (24/7)
- Email: security@visa.com

**Reporting Requirements:**
- Report within 72 hours of suspected breach
- Provide incident details and scope
- Cooperate with forensic investigation
- Implement recommended remediation

**Required Information:**
- Merchant ID
- Incident date and time
- Systems affected
- Data compromised
- Actions taken
- Contact information

### 11.2 Mastercard Security Center

**Contact:**
- Website: https://mastercard.com/security
- Phone: 1-800-627-8372 (24/7)
- Email: security@mastercard.com

**Reporting Requirements:**
- Report within 72 hours of suspected breach
- Provide incident details and scope
- Cooperate with forensic investigation
- Implement recommended remediation

### 11.3 American Express Security

**Contact:**
- Website: https://americanexpress.com/security
- Phone: 1-800-528-4800 (24/7)
- Email: security@aexp.com

**Reporting Requirements:**
- Report within 72 hours of suspected breach
- Provide incident details and scope
- Cooperate with forensic investigation

### 11.4 Discover Security

**Contact:**
- Website: https://discover.com/security
- Phone: 1-800-347-7444 (24/7)
- Email: security@discover.com

**Reporting Requirements:**
- Report within 72 hours of suspected breach
- Provide incident details and scope
- Cooperate with forensic investigation

### 11.5 Acquirer Notification

**Primary Acquirer:** [To be determined based on payment processor]

**Notification Requirements:**
- Immediate notification for confirmed breaches
- Provide incident details and scope
- Cooperate with investigation
- Implement remediation measures

---

## 12. Appendices

### Appendix A: Incident Response Contact List

**Internal Contacts:**
- Security Officer: security@ahoyvpn.net
- Lead Developer: dev@ahoyvpn.net
- Operations Manager: ops@ahoyvpn.net
- Executive Sponsor: executive@ahoyvpn.net

**External Contacts:**
- Legal Counsel: [To be determined]
- Forensic Investigator: [To be determined]
- Payment Brands: See Section 11
- Acquirer: [To be determined]

### Appendix B: Incident Response Toolkit

**Tools and Resources:**
- Forensic imaging tools
- Network monitoring tools
- Log analysis tools
- Communication templates
- Legal notification templates

### Appendix C: Training Requirements

**Annual Training:**
- All employees: Security awareness training
- Incident response team: Incident response procedures
- Developers: Secure coding practices

**Quarterly Drills:**
- Incident response tabletop exercises
- Business continuity drills
- Backup restoration tests

### Appendix D: Document Control

**Version History:**
- Version 1.0: March 26, 2026 - Initial release

**Review Schedule:**
- Annual review: March 26 each year
- Update as needed based on incidents or regulatory changes

**Approval:**
- Security Officer: [Signature/Date]
- Executive Sponsor: [Signature/Date]

---

**Document Classification:** Confidential
**Distribution:** Restricted to authorized personnel
**Retention:** 7 years from effective date
