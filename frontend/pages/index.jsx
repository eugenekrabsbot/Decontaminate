import Link from 'next/link';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section style={styles.hero}>
        <h1 style={styles.heroTitle}>AHOY VPN</h1>
        <p style={styles.heroSubtitle}>
          Privacy-first VPN service. Zero logs. No tracking. No compromises.
        </p>
        <p style={styles.heroDescription}>
          Secure your internet connection with military-grade encryption.
          Browse privately. Mask your location. Protect your data.
        </p>
        <div style={styles.heroCTA}>
          <Link href="/login">
            <a style={styles.heroCTAButton}>Login</a>
          </Link>
          <Link href="/register">
            <a style={styles.heroCTAButtonSecondary}>Register</a>
          </Link>
        </div>
      </section>

      {/* Why AHOY VPN Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Why Choose AHOY VPN?</h2>
        <div style={styles.reasonsGrid}>
          <ReasonCard icon="🔒" title="Privacy First" description="Zero-knowledge architecture. We can't see your data." />
          <ReasonCard icon="🚀" title="Lightning Fast" description="Optimized servers for maximum speed." />
          <ReasonCard icon="🌍" title="Global Network" description="Connect to 50+ server locations worldwide." />
          <ReasonCard icon="📱" title="All Devices" description="Works on desktop, mobile, and tablets." />
        </div>
      </section>

      {/* Pricing Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Simple, Transparent Pricing</h2>
        <p style={styles.sectionSubtitle}>
          Choose the plan that fits your needs. All plans include full access to our global network and premium features.
        </p>
        <div style={styles.pricingGrid}>
          <div style={styles.pricingCard}>
            <h3 style={styles.pricingTitle}>Monthly</h3>
            <div style={styles.pricingPrice}>$5.99<span style={styles.pricingPeriod}>/month</span></div>
            <div style={styles.pricingDescription}>Billed monthly</div>
          </div>
          <div style={styles.pricingCard}>
            <h3 style={styles.pricingTitle}>Quarterly</h3>
            <div style={styles.pricingPrice}>$16.99</div>
            <div style={styles.pricingDescription}>($5.66/month) · Billed every 3 months</div>
          </div>
          <div style={styles.pricingCard}>
            <h3 style={styles.pricingTitle}>Semi‑Annual</h3>
            <div style={styles.pricingPrice}>$31.99</div>
            <div style={styles.pricingDescription}>($5.33/month) · Billed every 6 months · Crypto only</div>
          </div>
          <div style={styles.pricingCard}>
            <h3 style={styles.pricingTitle}>Annual</h3>
            <div style={styles.pricingPrice}>$59.99</div>
            <div style={styles.pricingDescription}>($5.00/month) · Billed yearly · Crypto only</div>
          </div>
        </div>
        <div style={styles.paymentInfo}>
          <h4>Accepted Payment Methods</h4>
          <p>Credit/Debit Cards (Visa, Mastercard, American Express) for Monthly & Quarterly plans. Cryptocurrency (via Plisio) for all plans.</p>
          <p style={styles.paymentNote}>
            <strong>Note:</strong> Checkout is available after account creation. Browse plans here, then register to purchase.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Premium Features</h2>
        <div style={styles.featuresGrid}>
          <FeatureItem title="No Logs" description="We don't log your activity. Ever." />
          <FeatureItem title="No Tracking" description="Your online privacy is our priority." />
          <FeatureItem title="Numeric Authentication" description="Privacy-focused account system. No email required." />
          <FeatureItem title="Recovery Kits" description="Secure account recovery without storing personal data." />
          <FeatureItem title="10 Simultaneous Connections" description="Use on up to 10 devices at once." />
        </div>
      </section>

      {/* How It Works Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>How It Works</h2>
        <div style={styles.stepsGrid}>
          <div style={styles.step}>
            <div style={styles.stepNumber}>1</div>
            <h3>Register</h3>
            <p>Create your account with numeric credentials. No email required.</p>
          </div>
          <div style={styles.step}>
            <div style={styles.stepNumber}>2</div>
            <h3>Login</h3>
            <p>Access your dashboard with your numeric username and password.</p>
          </div>
          <div style={styles.step}>
            <div style={styles.stepNumber}>3</div>
            <h3>Purchase</h3>
            <p>Choose a plan and complete payment in your dashboard.</p>
          </div>
          <div style={styles.step}>
            <div style={styles.stepNumber}>4</div>
            <h3>Connect</h3>
            <p>Download the VPN client and connect to secure servers.</p>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section style={styles.disclaimer}>
        <Card>
          <h3 style={{ marginBottom: '1rem' }}>Important Information</h3>
          <p style={{ marginBottom: '0.5rem' }}>
            By using AHOY VPN, you agree to our Terms of Service and Privacy Policy.
          </p>
          <p style={{ marginBottom: 0 }}>
            All payments are processed securely through our payment partners.
          </p>
        </Card>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <p>&copy; 2026 AHOY VPN. All rights reserved.</p>
        <div style={styles.footerLinks}>
          <Link href="/tos">Terms of Service</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/faq">FAQ</Link>
        </div>
      </footer>
    </div>
  );
}

// Components
function ReasonCard({ icon, title, description }) {
  return (
    <Card style={styles.reasonCard}>
      <div style={styles.reasonIcon}>{icon}</div>
      <h3 style={styles.reasonTitle}>{title}</h3>
      <p style={styles.reasonDescription}>{description}</p>
    </Card>
  );
}

function FeatureItem({ title, description }) {
  return (
    <div style={styles.featureItem}>
      <h4 style={styles.featureTitle}>{title}</h4>
      <p style={styles.featureDescription}>{description}</p>
    </div>
  );
}

// Styles
const styles = {
  hero: {
    textAlign: 'center',
    padding: '4rem 2rem',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    color: 'white',
  },
  heroTitle: {
    fontSize: '3rem',
    marginBottom: '1rem',
    fontWeight: 'bold',
  },
  heroSubtitle: {
    fontSize: '1.5rem',
    marginBottom: '1rem',
    opacity: 0.9,
  },
  heroDescription: {
    fontSize: '1.1rem',
    marginBottom: '2rem',
    opacity: 0.8,
    maxWidth: '600px',
    margin: '0 auto 2rem',
  },
  heroCTA: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
  },
  heroCTAButton: {
    display: 'inline-block',
    padding: '1rem 2rem',
    background: '#1E90FF',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    transition: 'background 0.3s',
  },
  heroCTAButtonSecondary: {
    display: 'inline-block',
    padding: '1rem 2rem',
    background: 'transparent',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    border: '2px solid white',
    transition: 'background 0.3s',
  },
  section: {
    padding: '3rem 2rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  sectionTitle: {
    textAlign: 'center',
    fontSize: '2rem',
    marginBottom: '1rem',
  },
  sectionSubtitle: {
    textAlign: 'center',
    marginBottom: '2rem',
    opacity: 0.8,
  },
  reasonsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1.5rem',
  },
  reasonCard: {
    textAlign: 'center',
    padding: '2rem',
  },
  reasonIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  reasonTitle: {
    fontSize: '1.25rem',
    marginBottom: '0.5rem',
  },
  reasonDescription: {
    opacity: 0.8,
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1.5rem',
  },
  featureItem: {
    textAlign: 'center',
  },
  featureTitle: {
    fontSize: '1.1rem',
    marginBottom: '0.5rem',
  },
  featureDescription: {
    fontSize: '0.9rem',
    opacity: 0.8,
  },
  pricingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '2rem',
    marginTop: '2rem',
  },
  pricingCard: {
    background: '#252525',
    border: '1px solid #333333',
    borderRadius: '12px',
    padding: '2rem',
    textAlign: 'center',
    transition: 'transform 0.2s, border-color 0.2s',
  },
  pricingTitle: {
    fontSize: '1.5rem',
    marginBottom: '1rem',
    color: '#F0F4F8',
  },
  pricingPrice: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#1E90FF',
    marginBottom: '0.5rem',
  },
  pricingPeriod: {
    fontSize: '1rem',
    color: '#B0C4DE',
    fontWeight: 'normal',
  },
  pricingDescription: {
    color: '#B0C4DE',
    fontSize: '0.9rem',
  },
  paymentInfo: {
    marginTop: '3rem',
    padding: '2rem',
    background: 'rgba(30, 144, 255, 0.05)',
    border: '1px solid rgba(30, 144, 255, 0.2)',
    borderRadius: '12px',
    textAlign: 'center',
  },
  paymentNote: {
    marginTop: '1rem',
    fontSize: '0.9rem',
    color: '#B0C4DE',
  },
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '2rem',
    marginTop: '2rem',
  },
  step: {
    textAlign: 'center',
  },
  stepNumber: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    background: '#4CAF50',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    margin: '0 auto 1rem',
  },
  disclaimer: {
    padding: '2rem',
    background: '#f5f5f5',
  },
  footer: {
    textAlign: 'center',
    padding: '2rem',
    background: '#1a1a2e',
    color: 'white',
  },
  footerLinks: {
    marginTop: '1rem',
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
  },
};
