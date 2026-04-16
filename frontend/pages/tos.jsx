import Card from '../components/ui/Card';

export default function TermsOfService() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Terms of Service</h1>
      <p style={styles.updated}>Last updated: March 13, 2026</p>

      <div style={styles.content}>
        <Section title="1. Acceptance of Terms">
          By accessing and using AHOY VPN, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
        </Section>

        <Section title="2. Service Description">
          AHOY VPN provides virtual private network (VPN) services. Our service encrypts your internet traffic and routes it through our servers to mask your IP address and location.
        </Section>

        <Section title="3. User Responsibilities">
          <ul style={styles.list}>
            <li>You are responsible for maintaining the confidentiality of your numeric username and password.</li>
            <li>You are responsible for all activities that occur under your account.</li>
            <li>You agree not to use AHOY VPN for illegal activities or to violate any laws.</li>
            <li>You agree not to use AHOY VPN to harm, harass, or interfere with other users.</li>
            <li>You agree not to attempt to gain unauthorized access to AHOY VPN's systems.</li>
            <li>You agree not to share credentials for your account with anyone else.</li>
          </ul>
        </Section>

        <Section title="4. Account Termination">
          We reserve the right to terminate any account that violates these terms of service. Upon termination, you forfeit any remaining subscription balance.
        </Section>

        <Section title="5. Payment Terms">
          <ul style={styles.list}>
            <li>Payments are processed by our third party payments providers; you will be redirected to their site to pay when you make a purchase; AHOY VPN does not store payment information.</li>
            <li>Subscriptions renew automatically on the billing date unless cancelled.</li>
            <li>You are responsible for keeping your payment information current.</li>
            <li>All purchases are final.</li>
            <li>No refunds are to be issued.</li>
          </ul>
        </Section>

        <Section title="6. Affiliate Program & Cookies">
          <ul style={styles.list}>
            <li>AHOY VPN uses cookies to track affiliate referrals (30-day expiration).</li>
            <li>Clicking an affiliate link sets a cookie to attribute future purchases.</li>
            <li>Affiliate earnings are calculated based on successful conversions.</li>
            <li>You can clear cookies anytime through your browser settings.</li>
          </ul>
        </Section>

        <Section title="6. Limitation of Liability">
          AHOY VPN is provided "AS IS" without warranties of any kind, express or implied. In no event shall AHOY VPN be liable for any damages arising from the use of this service.
        </Section>

        <Section title="7. Changes to Terms">
          AHOY VPN reserves the right to modify these terms at any time. Changes will be effective immediately upon posting. Your continued use of AHOY VPN constitutes acceptance of the new terms.
        </Section>

        <Section title="8. Contact Us">
          If you have questions about these terms, please contact us at ahoyvpn@ahoyvpn.net
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
