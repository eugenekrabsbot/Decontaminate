import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { checkAndSetAffiliateFromUrl } from '../../lib/cookies';

export default function AffiliateRedirect() {
  const router = useRouter();
  const { code } = router.query;

  useEffect(() => {
    if (code) {
      // This will set the cookie from the URL if needed
      checkAndSetAffiliateFromUrl();
      // Redirect to home page after a brief delay
      setTimeout(() => {
        router.push('/');
      }, 500);
    }
  }, [code, router]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0A0A0A',
      color: '#B0C4DE',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ color: '#1E90FF', marginBottom: '1rem' }}>
        AHOY VPN Affiliate Redirect
      </h1>
      <p style={{ marginBottom: '2rem' }}>
        Setting up affiliate tracking... You will be redirected shortly.
      </p>
      <div style={{
        width: '50px',
        height: '50px',
        border: '4px solid #3A3A3A',
        borderTopColor: '#1E90FF',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}