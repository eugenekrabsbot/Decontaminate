import React from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';

export default function PaymentSuccess() {
  return (
    <Layout title="Payment Successful - AHOY VPN">
      <div style={styles.container}>
        <h1 style={styles.title}>Payment Successful</h1>
        <Card>
          <p style={styles.text}>
            Thank you for supporting AHOY VPN. Your payment has been received and your account will become active as soon
            as the payment confirmation is processed.
          </p>
          <p style={styles.text}>
            Next steps:
          </p>
          <ol style={styles.list}>
            <li>Visit the <Link href="/downloads"><a style={styles.link}>Downloads</a></Link> page.</li>
            <li>Download the AHOY VPN client for your device.</li>
            <li>Sign in using the same account number and password you use on this site.</li>
          </ol>
          <p style={{ ...styles.text, marginTop: '1rem' }}>
            You can always check your subscription status on the{' '}
            <Link href="/dashboard"><a style={styles.link}>Dashboard</a></Link>.
          </p>
        </Card>
      </div>
    </Layout>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    marginBottom: '1.5rem',
  },
  text: {
    fontSize: '0.95rem',
    color: '#E2E8F0',
    marginBottom: '0.75rem',
    lineHeight: 1.6,
  },
  list: {
    margin: '0.5rem 0 0',
    paddingLeft: '1.25rem',
    color: '#E2E8F0',
    fontSize: '0.95rem',
  },
  link: {
    color: '#38BDF8',
    textDecoration: 'underline',
  },
};
