import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import '../styles/globals.css';
import Layout from '../components/Layout';
import { checkAndSetAffiliateFromUrl } from '../lib/cookies';

// Mock auth context (TODO: replace with real auth)
export const AuthContext = React.createContext();

export default function App({ Component, pageProps }) {
  const [auth, setAuth] = useState({
    isLoggedIn: false,
    user: null,
    role: 'public', // 'public', 'customer', 'affiliate', 'admin'
    token: null,
  });

  const [isLoading, setIsLoading] = useState(true);

  // CSP Header for security
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self' data:;
    connect-src 'self' https://checkout.plisio.net https://checkout.paymentscloud.com;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self' https://accept.authorize.net https://test.authorize.net;
  `.replace(/\s+/g, ' ').trim();

  useEffect(() => {
    try {
      // Check for affiliate ID in URL and set cookie
      checkAndSetAffiliateFromUrl();
    } catch (err) {
      console.warn('Failed to check affiliate URL:', err);
    }

    try {
      // Check for stored auth token on mount
      const token = localStorage.getItem('authToken');
      const userRole = localStorage.getItem('userRole');
      const userData = localStorage.getItem('userData');

      if (token) {
        setAuth({
          isLoggedIn: true,
          user: userData ? JSON.parse(userData) : null,
          role: userRole || 'customer',
          token,
        });
      }
    } catch (err) {
      console.warn('Failed to access localStorage:', err);
    }

    setIsLoading(false);
  }, []);

  const login = (userData, token, role = 'customer') => {
    try {
      localStorage.setItem('authToken', token);
      localStorage.setItem('userRole', role);
      localStorage.setItem('userData', JSON.stringify(userData));
    } catch (err) {
      console.warn('Failed to save auth to localStorage:', err);
    }
    setAuth({
      isLoggedIn: true,
      user: userData,
      role,
      token,
    });
  };

  const logout = () => {
    try {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userData');
    } catch (err) {
      console.warn('Failed to remove auth from localStorage:', err);
    }
    setAuth({
      isLoggedIn: false,
      user: null,
      role: 'public',
      token: null,
    });
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Head>
        <meta httpEquiv="Content-Security-Policy" content={cspHeader} />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </Head>
      <AuthContext.Provider value={{ ...auth, login, logout }}>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </AuthContext.Provider>
    </>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#121212',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#1E90FF', marginBottom: '1rem' }}><img src="/AhoyMonthly_transparent.png?v=3" alt="AHOY VPN Logo" style={{ height: '2.5em', verticalAlign: 'middle', marginRight: '0.5rem' }} /> AHOY VPN</h1>
        <p style={{ color: '#B0C4DE' }}>Loading...</p>
      </div>
    </div>
  );
}
