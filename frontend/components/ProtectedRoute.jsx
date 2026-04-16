import { useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AuthContext } from '../pages/_app';
import Card from './ui/Card';
import Button from './ui/Button';

export default function ProtectedRoute({
  children,
  requiredRole = 'customer', // customer, affiliate, admin, or null for any logged-in user
}) {
  const router = useRouter();
  const auth = useContext(AuthContext);

  useEffect(() => {
    if (!auth) return;

    // Not logged in
    if (!auth.isLoggedIn) {
      router.push('/login');
      return;
    }

    // Logged in but wrong role
    if (requiredRole && auth.role !== requiredRole) {
      router.push('/');
      return;
    }
  }, [auth, router, requiredRole]);

  // Loading state
  if (!auth?.isLoggedIn) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <p style={{ color: '#B0C4DE' }}>Checking access...</p>
      </div>
    );
  }

  // Wrong role
  if (requiredRole && auth.role !== requiredRole) {
    return (
      <Card style={{ maxWidth: '500px', margin: '4rem auto', textAlign: 'center' }}>
        <h2 style={{ color: '#FF6B6B', marginBottom: '1rem' }}>Access Denied</h2>
        <p style={{ color: '#B0C4DE', marginBottom: '1.5rem' }}>
          You don't have permission to access this page.
        </p>
        <Button onClick={() => router.push('/')} size="lg">
          Go to Home
        </Button>
      </Card>
    );
  }

  // Authorized
  return children;
}
