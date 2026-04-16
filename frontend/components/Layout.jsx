import React, { useContext } from 'react';
import Link from 'next/link';
import { AuthContext } from '../pages/_app';

export default function Layout({ children }) {
  const auth = useContext(AuthContext);

  return (
    <div style={styles.container}>
      <Header auth={auth} />
      <main style={styles.main}>
        {children}
      </main>
      <Footer />
      <a href="mailto:ahoyvpn@ahoyvpn.net" style={styles.floatingSupportButton}>
        Contact Support
      </a>
    </div>
  );
}

function Header({ auth }) {
  return (
    <>
      <header style={styles.header} className="ahoy-header">
        <div style={styles.headerContent} className="ahoy-headerContent">
          <div style={styles.logo} className="ahoy-logoWrap">
            <Link href="/">
              <a style={styles.logoLink} className="ahoy-logoLink">
                <img src="/AhoyMonthly_transparent.png?v=3" alt="AHOY VPN Logo" style={{ height: '2.5em', verticalAlign: 'middle', marginRight: '0.5rem' }} /> AHOY VPN
              </a>
            </Link>
          </div>

          <nav style={styles.nav} className="ahoy-nav">
            <Link href="/"><a style={styles.navLink}>Home</a></Link>
            <Link href="/faq"><a style={styles.navLink}>FAQ</a></Link>
            <Link href="/downloads"><a style={styles.navLink}>Downloads</a></Link>
            <Link href="/privacy"><a style={styles.navLink}>Privacy</a></Link>
            <Link href="/tos"><a style={styles.navLink}>Terms</a></Link>

            {auth?.isLoggedIn ? (
              <>
                {auth.role === 'customer' && (
                  <Link href="/dashboard"><a style={styles.navLink}>Dashboard</a></Link>
                )}
                {auth.role === 'affiliate' && (
                  <Link href="/affiliate"><a style={styles.navLink}>Affiliate</a></Link>
                )}
                {auth.role === 'admin' && (
                  <Link href="/admin"><a style={styles.navLink}>Admin</a></Link>
                )}
                <button style={styles.logoutBtn} onClick={auth.logout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login"><a style={styles.navLink}>Login</a></Link>
                <Link href="/register"><a style={styles.ctaBtn}>Get Started</a></Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <style jsx>{`
        @media (max-width: 768px) {
          .ahoy-headerContent {
            padding: 0.65rem 0.85rem !important;
            gap: 0.55rem !important;
            flex-direction: column !important;
            align-items: stretch !important;
          }

          .ahoy-logoWrap {
            display: flex;
            justify-content: flex-start;
          }

          .ahoy-logoLink {
            font-size: 1.1rem !important;
          }

          .ahoy-nav {
            justify-content: flex-start !important;
            flex-wrap: nowrap !important;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            gap: 0.5rem !important;
            padding-bottom: 0.1rem;
          }

          .ahoy-nav::-webkit-scrollbar {
            display: none;
          }

          .ahoy-nav a,
          .ahoy-nav button {
            flex: 0 0 auto;
            white-space: nowrap;
            font-size: 0.82rem !important;
            padding: 0.35rem 0.55rem !important;
          }
        }
      `}</style>
    </>
  );
}

function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.footerContent}>
        <div style={styles.footerSection}>
          <h4 style={styles.footerHeading}>AHOY VPN</h4>
          <p style={styles.footerText}>Privacy-first VPN service. No tracking, no logs.</p>
        </div>

        <div style={styles.footerSection}>
          <h4 style={styles.footerHeading}>Legal</h4>
          <Link href="/tos"><a style={styles.footerLink}>Terms of Service</a></Link>
          <Link href="/privacy"><a style={styles.footerLink}>Privacy Policy</a></Link>
          <Link href="/faq"><a style={styles.footerLink}>FAQ</a></Link>
        </div>

        <div style={styles.footerSection}>
          <h4 style={styles.footerHeading}>Support</h4>
          <a href="mailto:ahoyvpn@ahoyvpn.net" style={styles.footerLink}>
            Contact Support
          </a>
        </div>
      </div>

      <div style={styles.footerBottom}>
        <p style={styles.footerText}>
          © 2026 AHOY VPN. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#F0F4F8',
  },

  header: {
    backgroundColor: '#111111',
    borderBottom: '1px solid #444',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },

  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '2rem',
  },

  logo: {
    flex: '0 0 auto',
  },

  logoLink: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#1E90FF',
    textDecoration: 'none',
    transition: 'color 0.3s ease',
  },

  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    flex: 1,
  },

  navLink: {
    color: '#B0C4DE',
    textDecoration: 'none',
    transition: 'color 0.3s ease',
    fontSize: '0.95rem',
    fontWeight: 500,
  },

  ctaBtn: {
    backgroundColor: '#1E90FF',
    color: '#FFFFFF',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'background-color 0.3s ease',
  },

  logoutBtn: {
    backgroundColor: 'transparent',
    color: '#B0C4DE',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    border: '1px solid #3A3A3A',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },

  main: {
    flex: 1,
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    padding: '2rem',
  },

  footer: {
    backgroundColor: '#111111',
    borderTop: '1px solid #444',
    marginTop: '4rem',
    padding: '2rem',
  },

  footerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '2rem',
    marginBottom: '2rem',
  },

  footerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },

  footerHeading: {
    color: '#1E90FF',
    fontSize: '0.95rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },

  footerLink: {
    color: '#B0C4DE',
    textDecoration: 'none',
    fontSize: '0.9rem',
    transition: 'color 0.3s ease',
  },

  footerText: {
    color: '#A0AEC0',
    fontSize: '0.9rem',
  },

  footerBottom: {
    textAlign: 'center',
    borderTop: '1px solid #3A3A3A',
    paddingTop: '1.5rem',
  },
  floatingSupportButton: {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    zIndex: 110,
    backgroundColor: '#1E90FF',
    color: '#fff',
    textDecoration: 'none',
    padding: '0.65rem 0.9rem',
    borderRadius: '999px',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.25)',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
};
