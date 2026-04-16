import Card from '../components/ui/Card';

export default function AffiliateAgreement() {
  return (
    <div style={styles.container}>
      <Card>
        <h1 style={styles.title}>AHOY VPN Affiliate Agreement</h1>
        <p style={styles.updated}>Last updated: 04/04/26</p>

        <section style={styles.section}>
          <p>
            Thanks for joining the AHOY VPN affiliate team. This agreement is short and clear. Read it once, and you’ll know exactly how things work.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>1. Joining is simple</h2>
          <p>
            Fill out the application. We’ll approve you fast. Keep your contact and payment info up to date.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>2. Your job (and what not to do)</h2>
          <p>
            You get special links and banners. Use them to send people to AHOY VPN.
          </p>
          <p>
            <strong>Do not ever do these things:</strong>
          </p>
          <ul style={styles.prohibitedList}>
            <li>Send spam (emails, comments, DMs, forums)</li>
            <li>Write fake reviews or lie about the service</li>
            <li>Run ads on our brand name (like “AHOY VPN”) without written permission</li>
            <li>Pay people to sign up (cashback, rewards, etc.)</li>
            <li>Sign up yourself, your mom, or your neighbor using your own link</li>
            <li>Hack the tracking system or stuff cookies</li>
            <li>Pretend to be AHOY VPN</li>
          </ul>
          <p>
            Break these rules? You lose unpaid commissions and your account is closed.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>3. How you make money (recurring commissions)</h2>
          <p>
            You earn a commission when someone:
          </p>
          <ul style={styles.commissionList}>
            <li>Clicks your link</li>
            <li>Buys a plan within 30 days</li>
            <li>Is a brand new customer (never had an account)</li>
            <li>Payment goes through</li>
          </ul>
          <p>
            <strong>Then you keep earning</strong><br />
            You also get a commission every time that customer renews – monthly, quarterly, etc. – for as long as they stay.
          </p>
          <p>
            <strong>Crypto customers:</strong><br />
            Crypto payments don’t auto-renew. The customer has to come back and pay manually. If they re-enter your code each time, you still get paid.
          </p>
          <p>
            Cookie lasts: 30 days.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>4. Commission rates (10% of every payment)</h2>
          <table style={styles.commissionTable}>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Price</th>
                <th>Your cut per payment</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Monthly</td>
                <td>$5.99</td>
                <td>$0.60</td>
              </tr>
              <tr>
                <td>Quarterly</td>
                <td>$16.99</td>
                <td>$1.70</td>
              </tr>
              <tr>
                <td>Semi-Annual</td>
                <td>$31.99</td>
                <td>$3.20</td>
              </tr>
              <tr>
                <td>Annual</td>
                <td>$59.99</td>
                <td>$6.00</td>
              </tr>
            </tbody>
          </table>
          <p>
            <strong>Example – Monthly customer:</strong><br />
            Month 1: you get $0.60. Month 2: another $0.60. And so on.
          </p>
          <p>
            <strong>Example – Annual customer:</strong><br />
            Year 1: you get $6.00. Year 2 (if they renew): another $6.00.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>5. Getting paid</h2>
          <p>
            <strong>Good news – you keep commissions</strong><br />
            We don’t give refunds for partial months. So if a customer cancels early, you keep every cent you already earned.
          </p>
          <p>
            <strong>Two times we don’t pay (or take money back):</strong>
          </p>
          <ul style={styles.paymentList}>
            <li>Chargeback – Customer disputes the charge and wins. We have to take back that commission.</li>
            <li>Fraud – Fake or stolen payment method. No commission.</li>
          </ul>
          <p>
            <strong>Payout timing:</strong>
          </p>
          <ul style={styles.paymentList}>
            <li>Hold period: Commissions sit until the 15th of the next month (to catch fraud).<br />
            Example: January sales pay around February 15th.</li>
            <li>Minimum payout: $50 (saves us both from tiny fees)</li>
            <li>We pay via: CashApp (you provide your $Cashtag)</li>
          </ul>
          <p>
            You must keep your payment info current.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>6. Stay in the loop (Telegram)</h2>
          <p>
            All approved affiliates get added to a private Telegram channel. There you can:
          </p>
          <ul style={styles.telegramList}>
            <li>Ask questions directly to William (that's me)</li>
            <li>Get updates, tips, and new promo materials</li>
            <li>Talk to other affiliates</li>
          </ul>
          <p>
            My direct email: <a href="mailto:ahoyvpn@ahoyvpn.net" style={styles.emailLink}>ahoyvpn@ahoyvpn.net</a><br />
            Use it anytime you need something.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>7. Leaving or being removed</h2>
          <p>
            You can quit anytime. Just tell me on Telegram or email.
          </p>
          <p>
            We can also end this agreement anytime.
          </p>
          <p>
            If it ends:
          </p>
          <ul style={styles.leavingList}>
            <li>Stop using all affiliate links right away</li>
            <li>You still get paid for commissions earned before termination</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>8. Changes to this agreement</h2>
          <p>
            We might update this page from time to time. The latest version is always on our website. By staying in the program, you agree to the changes.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>9. US Law applies</h2>
          <p>
            This agreement follows the laws of the United States of America. Any disputes will be handled under US jurisdiction.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Ready to start?</h2>
          <p>
            Once approved, you’ll get:
          </p>
          <ul style={styles.readyList}>
            <li>Your affiliate dashboard (links, banners, live stats)</li>
            <li>An invite to the Telegram channel</li>
            <li>My direct email: <a href="mailto:ahoyvpn@ahoyvpn.net" style={styles.emailLink}>ahoyvpn@ahoyvpn.net</a></li>
          </ul>
          <p style={{ marginTop: '1.5rem', fontStyle: 'italic' }}>
            Let’s grow together.
          </p>
        </section>
      </Card>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '2rem 1rem',
  },

  title: {
    fontSize: '2.5rem',
    color: '#1E90FF',
    marginBottom: '0.5rem',
  },

  updated: {
    color: '#A0AEC0',
    fontSize: '0.9rem',
    marginBottom: '2rem',
    borderBottom: '1px solid #3A3A3A',
    paddingBottom: '1rem',
  },

  section: {
    marginBottom: '2.5rem',
  },

  sectionTitle: {
    color: '#00CED1',
    fontSize: '1.5rem',
    marginBottom: '1rem',
  },

  prohibitedList: {
    color: '#FF6B6B',
    paddingLeft: '1.5rem',
    lineHeight: 1.6,
  },

  commissionList: {
    color: '#B0C4DE',
    paddingLeft: '1.5rem',
    lineHeight: 1.6,
  },

  commissionTable: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '1.5rem',
  },
  'commissionTable th, commissionTable td': {
    border: '1px solid #3A3A3A',
    padding: '0.75rem',
    textAlign: 'left',
  },
  'commissionTable th': {
    backgroundColor: '#252525',
    color: '#1E90FF',
  },
  'commissionTable td': {
    color: '#B0C4DE',
  },

  paymentList: {
    color: '#B0C4DE',
    paddingLeft: '1.5rem',
    lineHeight: 1.6,
  },

  telegramList: {
    color: '#B0C4DE',
    paddingLeft: '1.5rem',
    lineHeight: 1.6,
  },

  leavingList: {
    color: '#B0C4DE',
    paddingLeft: '1.5rem',
    lineHeight: 1.6,
  },

  readyList: {
    color: '#B0C4DE',
    paddingLeft: '1.5rem',
    lineHeight: 1.6,
  },

  emailLink: {
    color: '#1E90FF',
    textDecoration: 'none',
  },
  'emailLink:hover': {
    textDecoration: 'underline',
  },
};