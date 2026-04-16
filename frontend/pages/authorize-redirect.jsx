import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';

export default function AuthorizeRedirect() {
  const router = useRouter();

  const token = useMemo(() => {
    const t = router.query?.token;
    return Array.isArray(t) ? t[0] : t;
  }, [router.query]);

  const formUrl = useMemo(() => {
    const u = router.query?.formUrl;
    const url = Array.isArray(u) ? u[0] : u;
    return url || 'https://accept.authorize.net/payment/payment';
  }, [router.query]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!token) return;

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = formUrl;

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'token';
    input.value = token;

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }, [router.isReady, token, formUrl]);

  if (!router.isReady) {
    return <p style={{ color: '#B0C4DE', textAlign: 'center', marginTop: '4rem' }}>Preparing secure checkout…</p>;
  }

  if (!token) {
    return <p style={{ color: '#FF6B6B', textAlign: 'center', marginTop: '4rem' }}>Missing payment token. Please return to checkout and try again.</p>;
  }

  return <p style={{ color: '#B0C4DE', textAlign: 'center', marginTop: '4rem' }}>Redirecting to secure payment…</p>;
}
