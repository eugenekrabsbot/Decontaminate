import Card from '../components/ui/Card';

export default function PrivacyPolicy() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Privacy Policy</h1>
      <p style={styles.updated}>Last updated: March 5, 2026</p>

      <div style={styles.content}>
        <Section title="Privacy-First Philosophy">
          AHOY VPN is built on the principle of privacy-first design. We believe your data is your own. We do not track, log, or store information about your online activities.
        </Section>

        <Section title="1. What We DON'T Collect">
          <ul style={styles.list}>
            <li>❌ Email addresses (accounts use numeric IDs)</li>
            <li>❌ Payment data (processed by third-party providers)</li>
            <li>❌ Browsing history</li>
            <li>❌ IP addresses of connections</li>
            <li>❌ DNS queries</li>
            <li>❌ Personally identifiable information beyond what is needed to operate legally, never stored on our servers, handled by third-party providers.</li>
          </ul>
        </Section>

        <Section title="2. What We Collect (Minimal)">
          <ul style={styles.list}>
            <li>✓ Numeric user ID (for account identification)</li>
            <li>✓ Hashed password (for authentication)</li>
            <li>✓ Subscription status (active/inactive, plan type, billing date)</li>
            <li>✓ Internal account IDs (for system management)</li>
            <li>✓ Affiliate code attribution (if referral code used)</li>
            <li>✓ The bare-minimum billing details: country, province/state, and postal code</li>
          </ul>
        </Section>

        <Section title="3. Numeric Account System">
          Your account is identified by a random 8-digit numeric ID. We do not require email addresses. This protects your identity and prevents tracking across services.
        </Section>

        <Section title="4. Payment Information">
          Payments are processed entirely by Plisio (cryptocurrency) or PaymentsCloud (fiat), and tax data is calculated by ZipTax. AHOY VPN never stores or handles payment card data on our own servers. Your payment information is handled and stored securely by these third-party providers.
          <br /><br />
          We configure all payment gateways to be as non-invasive as possible, but we still recommend entering full card details when paying via fiat to reduce the chances of a transaction being denied or scrutinized and impacting your access to service.
          <br /><br />
          The most anonymous way to pay is through cryptocurrency.
          <br /><br />
          Fiat details may be stored by our payment processor for renewals, and all transactions will ask for country, province/state, and postal code prior to creating the checkout form due to sales tax liabilities.
          <br /><br />
          Details such as cryptocurrency wallet information and tax jurisdiction information may exist briefly on our server while the system uses them, but are promptly disposed of afterward.
          <br /><br />
          Our third-party tax/payment processors may handle data differently, which is why we are transparent about who we work with.
        </Section>

        <Section title="5. Subscription Data">
          We store only what is necessary to manage your subscription:
          <ul style={styles.list}>
            <li>Your numeric ID</li>
            <li>Current plan (Monthly, Quarterly, Semi-Annual, Annual)</li>
            <li>Subscription status (Active, Cancelled, Expired)</li>
            <li>Next billing date</li>
            <li>Account creation date</li>
          </ul>
        </Section>

        <Section title="6. Affiliate Program & Cookie Tracking">
          If you use an affiliate referral link:
          <ul style={styles.list}>
            <li>We set a cookie (30-day expiration) to track which affiliate referred you</li>
            <li>The cookie stores the affiliate ID only - no personal data</li>
            <li>If you make a purchase within 30 days, the affiliate gets credit</li>
            <li>Affiliate earnings are calculated based on subscription conversions</li>
            <li>You can clear affiliate cookies anytime by clearing your browser cookies</li>
          </ul>
          <p style={{ marginTop: '1rem', color: '#B0C4DE' }}>
            <strong>Cookies used for affiliate tracking:</strong>
          </p>
          <ul style={styles.list}>
            <li><code>affiliate_id</code> - Stores the affiliate ID (30-day expiration)</li>
            <li>Persistent storage in browser localStorage as backup</li>
          </ul>
        </Section>

        <Section title="7. No Logs, No Tracking">
          Unlike traditional VPN providers, we do not log:
          <ul style={styles.list}>
            <li>Your IP address</li>
            <li>Connection times or duration</li>
            <li>Data transferred</li>
            <li>Websites visited</li>
            <li>DNS queries</li>
          </ul>
        </Section>

        <Section title="8. Security">
          <ul style={styles.list}>
            <li>Passwords are hashed using bcrypt or scrypt (never stored in plaintext)</li>
            <li>Recovery kits are single-use and never stored</li>
            <li>Sensitive data requires re-authentication before access</li>
            <li>Copy-to-clipboard functions include warnings for sensitive data</li>
          </ul>
        </Section>

        <Section title="9. Third-Party Services">
          We use third-party services for:
          <ul style={styles.list}>
            <li><strong>Tax Calculation:</strong> ZipTax</li>
            <li><strong>Payments:</strong> Plisio (crypto) and PaymentsCloud (fiat) — see their privacy policies</li>
            <li><strong>Hosting & Security:</strong> NGINX (reverse proxy) and Cloudflare (reverse proxy/security)</li>
            <li><strong>Analytics:</strong> Cloudflare Web Analytics (rum.js) — aggregate session data only, no PII stored</li>
          </ul>
          These services may have their own privacy policies independent of ours.
        </Section>

        <Section title="10. Data Retention">
          <ul style={styles.list}>
            <li>Account data is retained as long as your subscription is active</li>
            <li>Upon account deletion, all personal data is removed within 30 days</li>
            <li>Recovery kits are never stored (generated on-demand and single-use)</li>
            <li>Logs are not retained</li>
          </ul>
        </Section>

        <Section title="11. Your Rights">
          You have the right to:
          <ul style={styles.list}>
            <li>Download your account data</li>
            <li>Delete your account and all associated data</li>
            <li>Change your password anytime</li>
            <li>Request a new recovery kit</li>
          </ul>
        </Section>

        <Section title="12. Changes to Privacy Policy">
          We may update this policy at any time. Changes will be posted with an updated "Last updated" date. Continued use of AHOY VPN constitutes acceptance of the new policy.
        </Section>

        <Section title="13. Cookie Disclosure">
          <p>AHOY VPN uses cookies for essential functionality and affiliate tracking:</p>
          <ul style={styles.list}>
            <li><strong>Essential Cookies:</strong> Required for site functionality (no opt-out)</li>
            <li><strong>Affiliate Cookies:</strong> Track referral attribution (30-day expiration)</li>
          </ul>
          <p style={{ marginTop: '1rem' }}>
            We also use Cloudflare Web Analytics (rum.js) which collects aggregate session data — approximate geographic location, device type, browser type, and page performance metrics — without cookies or any personally identifiable information. No individual users are tracked, and the data is owned by AHOY VPN.
          </p>
        </Section>

        <Section title="14. Contact Us">
          Questions about privacy? Email us at ahoyvpn@ahoyvpn.net
        </Section>

        <Section title="15. Enhancing Your Privacy">
          <p>Want to go beyond VPN protection? Learn how to encrypt your DNS traffic to prevent your ISP and network administrators from seeing which websites you visit.</p>
          <p><a href="/dns-guide" style={{ color: '#1E90FF', textDecoration: 'none', fontWeight: '500' }}>View our DNS Encryption Guide →</a></p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <Card title={title} style={{ marginBottom: '1.5rem' }}>
      {typeof children === 'string' ? (
        <p style={{ color: '#B0C4DE', lineHeight: 1.8 }}>{children}</p>
      ) : (
        children
      )}
    </Card>
  );
}

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
  },

  title: {
    fontSize: '2.5rem',
    color: '#1E90FF',
    marginBottom: '0.5rem',
  },

  updated: {
    color: '#A0AEC0',
    marginBottom: '2rem',
    fontSize: '0.9rem',
  },

  content: {
    marginBottom: '2rem',
  },

  list: {
    color: '#B0C4DE',
    lineHeight: 1.8,
    paddingLeft: '1.5rem',
  },
};
