import { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { FormGroup, Input } from '../components/ui/Form';
import api from '../api/client';
import { AuthContext } from './_app';
import { getAffiliateId } from '../lib/cookies';

const PLANS = [
  { id: 'monthly', name: 'Monthly', price: '$5.99', period: '/month + tax', cryptoOnly: false },
  { id: 'quarterly', name: 'Quarterly', price: '$16.99', period: '/3 months + tax', cryptoOnly: false },
  { id: 'semi-annual', name: 'Semi-Annual', price: '$31.99', period: '/6 months + tax', cryptoOnly: true },
  { id: 'annual', name: 'Annual', price: '$59.99', period: '/year + tax', cryptoOnly: true },
];

const PAYMENT_METHODS = [
  { id: 'crypto', name: 'Cryptocurrency', provider: 'Plisio' },
  { id: 'card', name: 'Credit Card (Visa/Mastercard)', provider: 'PaymentsCloud' },
];

// Supported cryptocurrencies (subset of full Plisio support, mapped by code → label)
const CRYPTO_OPTIONS = [
  { code: 'BTC', label: 'Bitcoin' },
  { code: 'LTC', label: 'Litecoin' },
  { code: 'DASH', label: 'Dash' },
  { code: 'ZEC', label: 'Zcash' },
  { code: 'DOGE', label: 'Dogecoin' },
  { code: 'BCH', label: 'Bitcoin Cash' },
  { code: 'XMR', label: 'Monero' },
  { code: 'USDC', label: 'USD Coin (ERC-20)' },
  { code: 'USDC_BEP20', label: 'USDC (BEP-20)' },
  { code: 'USDT', label: 'Tether (ERC-20)' },
  { code: 'USDT_TRX', label: 'Tether (TRC-20)' },
  { code: 'USDT_BEP20', label: 'Tether (BEP-20)' },
  { code: 'TON', label: 'Toncoin' },
  { code: 'APE', label: 'ApeCoin (ERC-20)' },
  { code: 'SOL', label: 'Solana' },
  { code: 'LOVE', label: 'Love Bit (BEP-20)' },
  { code: 'ETH', label: 'Ethereum' },
  { code: 'BASE_ETH', label: 'Ethereum Base' },
  { code: 'ETC', label: 'Ethereum Classic' },
  { code: 'BTTC_TRX', label: 'BitTorrent-Chain (TRC-20)' },
  { code: 'BUSD_BEP20', label: 'Binance USD (BEP-20)' },
  { code: 'BNB', label: 'BNB Chain' },
  { code: 'TRX', label: 'Tron' },
  { code: 'SHIB', label: 'Shiba Inu (ERC-20)' },
];

export default function Checkout() {
  const router = useRouter();
  const auth = useContext(AuthContext);
  const [step, setStep] = useState('plan'); // plan, payment, confirm, success

  // Require login to access checkout
  if (!auth?.isLoggedIn) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Get AHOY VPN</h1>
        <Card>
          <h2 style={styles.stepTitle}>Sign in to continue</h2>
          <p style={{ marginBottom: '1rem', color: '#B0C4DE' }}>
            You need an account to complete checkout. Please log in or register to continue.
          </p>
          <div style={styles.buttonGroup}>
            <Link href="/login">
              <a>
                <Button size="lg">Login</Button>
              </a>
            </Link>
            <Link href="/register">
              <a>
                <Button variant="secondary" size="lg">Register</Button>
              </a>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Plan selection
  const [selectedPlan, setSelectedPlan] = useState(router.query.plan || 'monthly');

  // Payment method
  const [selectedPayment, setSelectedPayment] = useState('crypto');
  const [cryptoCurrency, setCryptoCurrency] = useState('BTC');
  const [invoice, setInvoice] = useState(null);
  const [copiedField, setCopiedField] = useState('');

  // Location & pricing
  const [country, setCountry] = useState('US');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [pricing, setPricing] = useState(null);
  const [redirectUrl, setRedirectUrl] = useState(null);


  // Account provisioning
  const [accountData, setAccountData] = useState(null);
  const [kitCopied, setKitCopied] = useState(false);

  // Affiliate attribution
  const [affiliateId, setAffiliateId] = useState(null);
  const [manualAffiliateCode, setManualAffiliateCode] = useState(getAffiliateId() || '');

  // Subscription agreement
  const [subscriptionAgreementChecked, setSubscriptionAgreementChecked] = useState(false);


  // Loading
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // Check for affiliate cookie on mount (only if no manual code)
  useEffect(() => {
    if (!manualAffiliateCode.trim()) {
      const id = getAffiliateId();
      if (id) {
        setAffiliateId(id);
      }
    }
  }, []);

  // Update affiliateId when manual code changes
  useEffect(() => {
    const trimmed = manualAffiliateCode.trim();
    if (trimmed) {
      setAffiliateId(trimmed);
    } else {
      // If user clears manual code, revert to cookie if any
      const cookieId = getAffiliateId();
      setAffiliateId(cookieId || null);
    }
  }, [manualAffiliateCode]);

  const planData = PLANS.find((p) => p.id === selectedPlan) || PLANS[0];
  const PLAN_DURATION = {
    monthly: 30,
    quarterly: 90,
    'semi-annual': 183,
    annual: 365
  };
  const nextBillingDate = new Date(Date.now() + ((PLAN_DURATION[selectedPlan] || 30) * 24 * 60 * 60 * 1000));
  const isCryptoOnly = Boolean(planData?.cryptoOnly);
  const availablePaymentMethods = isCryptoOnly
    ? PAYMENT_METHODS.filter((method) => method.id === 'crypto')
    : PAYMENT_METHODS;
  const paymentData = availablePaymentMethods.find((p) => p.id === selectedPayment) || availablePaymentMethods[0];

  useEffect(() => {
    if (isCryptoOnly && selectedPayment !== 'crypto') {
      setSelectedPayment('crypto');
    }
  }, [isCryptoOnly, selectedPayment]);

  useEffect(() => {
    if (selectedPayment !== 'crypto') {
      setInvoice(null);
      setStatusMessage('');
    }
  }, [selectedPayment]);

  const handleProceedToPayment = async () => {
    setLoading(true);
    setError('');
    setStatusMessage('');

    // Basic validation for location; we always want country + postal
    if (!country || !postalCode.trim()) {
      setLoading(false);
      setError('Please select your country and enter your postal/ZIP code to continue.');
      return;
    }
    if (country === 'US' && !region) {
      setLoading(false);
      setError('Please select your state before continuing so we can calculate tax.');
      return;
    }

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const returnUrl = origin ? `${origin}/checkout?payment=success` : undefined;
      const cancelUrl = origin ? `${origin}/checkout?payment=cancel` : undefined;
      const options = {
        country,
        stateOrProvince: region,
        postalCode: postalCode.trim(),
      };
      if (selectedPayment === 'crypto') {
        options.cryptoCurrency = cryptoCurrency;
      }
      if (returnUrl) {
        options.returnUrl = returnUrl;
      }
      if (cancelUrl) {
        options.cancelUrl = cancelUrl;
      }

      // Read affiliate ID from state OR cookie at call time (not at render time)
      const effectiveAffiliateId = affiliateId || getAffiliateId() || undefined;

      const response = await api.initiateCheckout(selectedPlan, selectedPayment, effectiveAffiliateId, options);
      const data = response?.data;

      setPricing(data?.pricing || null);

      if (selectedPayment === 'crypto') {
        const invoicePayload = data?.invoice;
        if (!invoicePayload || !invoicePayload.invoiceUrl) {
          setError('Failed to retrieve invoice information.');
          return;
        }
        setInvoice(invoicePayload);
        setStatusMessage(
          'Invoice ready — review the totals below, then continue to payment on Plisio to complete your crypto payment.'
        );
        setStep('confirm');
        return;
      }

      const url = data?.redirectUrl;
      if (url) {
        setRedirectUrl(url);
        setStep('confirm');
        return;
      }

      setError('Unable to start card checkout at the moment.');
      setStep('confirm');
    } catch (err) {
      console.error(err);
      const apiError = err?.response?.data?.error || err?.response?.data?.message;
      if (apiError) {
        setError(apiError);
      } else {
        setError('Failed to initiate checkout. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    setLoading(true);
    setError('');

    try {
      // Mock: confirm payment and get account data
      const response = await api.confirmCheckoutSuccess('mock_session_' + Date.now());
      setAccountData(response.data);
      setStep('success');

      // Auto-login user
      if (auth.login) {
        auth.login({ id: response.data.userId }, 'mock_token_' + Date.now(), 'customer');
      }
    } catch (err) {
      setError('Payment confirmation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKit = () => {
    if (accountData?.recoveryKit) {
      navigator.clipboard.writeText(accountData.recoveryKit);
      setKitCopied(true);
      setTimeout(() => setKitCopied(false), 2000);
    }
  };

  const handleDownloadKit = () => {
    if (accountData?.recoveryKit) {
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(accountData.recoveryKit));
      element.setAttribute('download', `recovery-kit-${accountData.userId}.txt`);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  const handleCopyField = async (value, label) => {
    if (!value || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      setTimeout(() => setCopiedField(''), 2000);
    } catch (err) {
      console.error('Clipboard write failed', err);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Get AHOY VPN</h1>

      {/* Step 1: Plan Selection */}
      {step === 'plan' && (
        <div style={styles.stepContainer}>
          <h2 style={styles.stepTitle}>Choose Your Plan</h2>
          <div style={styles.plansGrid}>
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                style={{
                  ...styles.planOption,
                  ...(selectedPlan === plan.id && styles.planOptionSelected),
                }}
              >
                <h3 style={styles.planName}>{plan.name}</h3>
                <p style={styles.planPrice}>{plan.price}</p>
                <p style={styles.planPeriod}>{plan.period}</p>
                {plan.cryptoOnly && (
                  <span style={styles.cryptoOnlyBadge}>Crypto only</span>
                )}
              </div>
            ))}
          </div>
          <Button
            onClick={() => setStep('payment')}
            style={styles.nextButton}
            size="lg"
          >
            Continue to Payment
          </Button>
        </div>
      )}

      {/* Step 2: Payment Method */}
      {step === 'payment' && (
        <div style={styles.stepContainer}>
          <div style={styles.summary}>
            <Card title="Order Summary">
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>Plan:</strong> {planData.name}
              </p>
              <p style={{ marginBottom: '1rem', fontSize: '1.5rem', color: '#1E90FF' }}>
                {planData.price}
              </p>
              {affiliateId && (
                <p style={{ color: '#00CED1', fontSize: '0.9rem' }}>
                  ✓ Affiliate attribution active
                </p>
              )}
            </Card>
          </div>

          <h2 style={styles.stepTitle}>Billing Location</h2>
          <div style={styles.locationGrid}>
            <div style={styles.locationField}>
              <label style={styles.locationLabel}>Country</label>
              <select
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  // Reset region when switching away from US
                  if (e.target.value !== 'US') {
                    setRegion('');
                  }
                }}
                style={styles.select}
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div style={styles.locationField}>
              <label style={styles.locationLabel}>State / Province</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                style={styles.select}
                disabled={country !== 'US'}
              >
                <option value="">{country === 'US' ? 'Select state' : 'Not required'}</option>
                {country === 'US' && US_STATES.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.locationField}>
              <label style={styles.locationLabel}>Postal / ZIP Code</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                style={styles.input}
                placeholder="e.g. 12345"
                autoComplete="postal-code"
              />
            </div>
            <div style={styles.locationField}>
              <label style={styles.locationLabel}>Affiliate Code (optional)</label>
              <input
                type="text"
                value={manualAffiliateCode}
                onChange={(e) => setManualAffiliateCode(e.target.value)}
                style={styles.input}
                placeholder="Enter affiliate code if you have one"
                autoComplete="off"
              />
            </div>
          </div>
          <p style={styles.locationHint}>
            We only use your country, state, and ZIP code to calculate sales tax for this order. This info isn&apos;t
            stored as a full billing address.
          </p>

          <h2 style={{ ...styles.stepTitle, marginTop: '2rem' }}>Payment Method</h2>
          <div style={styles.paymentGrid}>
            {availablePaymentMethods.map((method) => (
              <div
                key={method.id}
                onClick={() => setSelectedPayment(method.id)}
                style={{
                  ...styles.paymentOption,
                  ...(selectedPayment === method.id && styles.paymentOptionSelected),
                }}
              >
                <h3 style={styles.paymentName}>{method.name}</h3>
                <p style={styles.paymentProvider}>via {method.provider}</p>
              </div>
            ))}
          </div>

          {isCryptoOnly && (
            <p style={styles.cryptoOnlyNote}>
              Crypto only for the {planData.name} plan.
            </p>
          )}

          {selectedPayment === 'crypto' && (
            <div style={styles.cryptoSelector}>
              <p style={styles.cryptoSelectorLabel}>
                Cryptocurrency payments are processed by Plisio. You will choose your coin (BTC, ETH, USDC, etc.) on the
                Plisio invoice page.
              </p>
            </div>
          )}

          {statusMessage && <p style={styles.waitNotice}>{statusMessage}</p>}
          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.buttonGroup}>
            <Button variant="secondary" onClick={() => setStep('plan')} disabled={loading}>
              Back
            </Button>
            <Button onClick={handleProceedToPayment} disabled={loading} size="lg">
              {loading ? 'Processing...' : 'Continue to Payment'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm Payment */}
      {step === 'confirm' && (
        <div style={styles.stepContainer}>
          <Card>
            <h2 style={styles.stepTitle}>
              {selectedPayment === 'crypto' ? 'Review Total & Crypto Instructions' : 'Review Total & Continue to Payment'}
            </h2>

            {pricing && (
              <div style={styles.invoiceSummaryBox}>
                <h3 style={styles.invoiceSummaryTitle}>Invoice Summary</h3>
                <p style={styles.invoiceSummaryText}>
                  Your plan price is shown below, along with sales tax based on your location. The total is what will be
                  charged by {paymentData.provider || 'our payment processor'}.
                </p>
                <div style={styles.invoiceSummaryGrid}>
                  <div style={styles.invoiceDetail}>
                    <span>Plan price</span>
                    <strong>
                      ${(pricing.baseAmountCents / 100).toFixed(2)} {pricing.currency || 'USD'}
                    </strong>
                  </div>
                  {pricing.discountCents > 0 && (
                    <>
                      <div style={{ ...styles.invoiceDetail, borderColor: '#27ae60', backgroundColor: '#1A2A1A' }}>
                        <span>Affiliate Discount</span>
                        <strong style={{ color: '#27ae60' }}>
                          -${(pricing.discountCents / 100).toFixed(2)} {pricing.currency || 'USD'}
                        </strong>
                      </div>
                      <div style={styles.invoiceDetail}>
                        <span>Subtotal</span>
                        <strong>
                          ${((pricing.baseAmountCents - pricing.discountCents) / 100).toFixed(2)} {pricing.currency || 'USD'}
                        </strong>
                      </div>
                    </>
                  )}
                  <div style={styles.invoiceDetail}>
                    <span>Sales tax</span>
                    <strong>
                      ${(pricing.taxAmountCents / 100).toFixed(2)} {pricing.currency || 'USD'}
                    </strong>
                  </div>
                  <div style={{ ...styles.invoiceDetail, borderColor: '#00CED1', backgroundColor: '#1A2A3A' }}>
                    <span>Total</span>
                    <strong style={{ color: '#00CED1' }}>
                      ${(pricing.totalAmountCents / 100).toFixed(2)} {pricing.currency || 'USD'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {selectedPayment === 'crypto' && invoice ? (
              <>
                <p style={styles.mutedText}>
                  Send the exact amount below to the wallet address. Plisio will notify us once the invoice is paid.
                </p>

                <div style={styles.invoiceGrid}>
                  <div style={styles.invoiceDetail}>
                    <span>Amount</span>
                    <strong>
                      {pricing
                        ? `${(pricing.totalAmountCents / 100).toFixed(2)} ${pricing.currency || 'USD'}`
                        : `${invoice.amount} ${invoice.currency}`}
                    </strong>
                  </div>
                  {invoice.walletAddress && (
                    <div style={styles.invoiceDetail}>
                      <span>Wallet Address</span>
                      <strong style={styles.wordBreak}>{invoice.walletAddress}</strong>
                      <button
                        type="button"
                        style={styles.copyButton}
                        onClick={() => handleCopyField(invoice.walletAddress || '', 'wallet')}
                      >
                        {copiedField === 'wallet' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}
                  <div style={styles.invoiceDetail}>
                    <span>Invoice ID</span>
                    <strong style={styles.wordBreak}>{invoice.invoiceId}</strong>
                    <button
                      type="button"
                      style={styles.copyButton}
                      onClick={() => handleCopyField(invoice.invoiceId || '', 'invoice')}
                    >
                      {copiedField === 'invoice' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div style={styles.invoiceDetail}>
                    <span>Expires</span>
                    <strong>
                      {invoice.expiresAt ? new Date(invoice.expiresAt).toLocaleString() : '—'}
                    </strong>
                  </div>
                </div>

                {invoice.qrCode && (
                  <div style={styles.qrWrapper}>
                    <img src={invoice.qrCode} alt="Invoice QR code" style={styles.qrCode} />
                  </div>
                )}

                {invoice.invoiceUrl && (
                  <p style={styles.invoiceLink}>
                    <a href={invoice.invoiceUrl} target="_blank" rel="noreferrer">
                      View invoice on Plisio
                    </a>
                  </p>
                )}
              </>
            ) : (
              <>
                <p style={{ marginBottom: '1rem', color: '#B0C4DE' }}>
                  You will be redirected to <strong>{paymentData.provider}</strong> to complete your payment.
                </p>
                <p style={{ marginBottom: '2rem', color: '#A0AEC0', fontSize: '0.9rem' }}>
                  AHOY VPN does not store payment information. All payments are processed securely by {paymentData.provider}.
                </p>
                <div style={styles.providerSummary}>
                  <p style={{ color: '#F0F4F8', marginBottom: '0.5rem' }}>
                    <strong>Plan:</strong> {planData.name} ({planData.price})
                  </p>
                  <p style={{ color: '#F0F4F8' }}>
                    <strong>Payment Method:</strong> {paymentData.name}
                  </p>
                </div>

                  <div style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    backgroundColor: '#1A1A2A',
                    border: '1px solid #3A3A5A',
                    borderRadius: '8px',
                  }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', color: '#B0C4DE', fontSize: '0.9rem', lineHeight: '1.5' }}>
                      <input
                        type="checkbox"
                        checked={subscriptionAgreementChecked}
                        onChange={(e) => setSubscriptionAgreementChecked(e.target.checked)}
                        style={{ marginTop: '0.25rem', width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1E90FF', flexShrink: 0 }}
                      />
                      <span>
                        I agree that I am signing up for a <strong>recurring subscription</strong>. I have read and agree to the{' '}
                        <a href="/terms-of-service" target="_blank" rel="noreferrer" style={{ color: "#1E90FF" }}>Terms of Service</a>. I understand that if I
                        am ever locked out of my account, I can email{' '}
                        <a href="mailto:ahoyvpn@ahoyvpn.com" style={{ color: "#1E90FF" }}>ahoyvpn@ahoyvpn.com</a>{}
                        with my account number to cancel my subscription.
                      </span>
                    </label>
                  </div>
              </>
            )}

            {statusMessage && <p style={styles.waitNotice}>{statusMessage}</p>}
            {error && <p style={styles.error}>{error}</p>}

            <div style={styles.buttonGroup}>
              <Button
                variant="secondary"
                onClick={() => {
                  setStep('payment');
                  setStatusMessage('');
                }}
                disabled={loading}
              >
                Back
              </Button>
              {selectedPayment === 'crypto' ? (
                <Button
                  onClick={() => {
                    if (invoice?.invoiceUrl) {
                      window.location.href = invoice.invoiceUrl;
                    } else {
                      setError('Unable to open crypto invoice at the moment.');
                    }
                  }}
                  disabled={loading}
                  size="lg"
                >
                  {loading ? 'Processing...' : 'Proceed to payment'}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (redirectUrl) {
                      window.location.href = redirectUrl;
                    } else {
                      setError('Unable to start card checkout at the moment.');
                    }
                  }}
                  disabled={loading || !subscriptionAgreementChecked}
                  size="lg"
                >
                  {!subscriptionAgreementChecked
                    ? 'Please agree to the subscription terms above'
                    : loading
                      ? 'Processing...'
                      : `Continue to ${paymentData.provider}`}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Step 4: Success - Account Provisioning */}
      {step === 'success' && accountData && (
        <div style={styles.stepContainer}>
          <Card style={{ backgroundColor: '#1A2A1A', borderColor: '#00CED1' }}>
            <h2 style={{ color: '#00CED1', marginBottom: '0.5rem' }}>🎉 Congratulations!</h2>
            <p style={{ color: '#B0C4DE', marginBottom: '1rem' }}>Your payment is complete and your VPN account is now active.</p>

            <div style={styles.statusPanel}>
              <p><strong>Plan:</strong> {planData.name}</p>
              <p><strong>Invoice:</strong> {planData.price}</p>
              <p><strong>Next Billing:</strong> {nextBillingDate.toLocaleDateString()}</p>
              {affiliateId && (
                <p style={{ color: '#00CED1' }}>Thanks to affiliate <strong>{affiliateId}</strong> for the referral.</p>
              )}
            </div>

            <p style={styles.statusInfo}>
              We are now provisioning your account via our VPN Resellers partner. You will receive an email with your VPN credentials shortly.
            </p>

            <div style={styles.accountDataBox}>
              <h3 style={{ marginBottom: '1rem', color: '#1E90FF' }}>Your Account Details</h3>

              <FormGroup label="Username (Numeric ID)">
                <Input value={accountData.userId} disabled />
                <p style={styles.hint}>This is your numeric username. Keep it safe.</p>
              </FormGroup>

              <FormGroup label="Password (Numeric)">
                <Input type="password" value={accountData.password} disabled />
                <p style={styles.hint}>Your numeric password. Save this securely.</p>
              </FormGroup>

              <div style={{ backgroundColor: '#2A2A2A', padding: '1rem', borderRadius: '4px', marginBottom: '1.5rem', border: '1px solid #3A3A3A' }}>
                <h4 style={{ color: '#FFD93D', marginBottom: '0.5rem' }}>⚠️ Recovery Kit (CRITICAL)</h4>
                <p style={{ color: '#B0C4DE', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  If you lose your password, you'll need this kit to recover your account. Save it in a secure location (encrypted drive, password manager, etc.).
                </p>
                <div style={styles.kitDisplay}>
                  <code style={styles.kitCode}>{accountData.recoveryKit}</code>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <Button onClick={handleCopyKit} variant="secondary" size="sm">
                    {kitCopied ? '✓ Copied' : 'Copy to Clipboard'}
                  </Button>
                  <Button onClick={handleDownloadKit} variant="secondary" size="sm">
                    Download as File
                  </Button>
                </div>
              </div>

              <p style={{ ...styles.hint, color: '#FFD93D', backgroundColor: '#1A2A1A', padding: '0.75rem', borderRadius: '4px' }}>
                <strong>Important:</strong> We will never ask for your recovery kit. Store it securely. Anyone with this kit can recover your account.
              </p>
            </div>

            <div style={styles.buttonGroup}>
              <Link href="/dashboard">
                <a style={styles.linkButton}>
                  <Button size="lg" style={{ width: '100%' }}>
                    Go to Dashboard
                  </Button>
                </a>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
  },

  title: {
    fontSize: '2.5rem',
    color: '#1E90FF',
    marginBottom: '2rem',
    textAlign: 'center',
  },

  stepContainer: {
    marginBottom: '2rem',
  },

  stepTitle: {
    fontSize: '1.5rem',
    color: '#1E90FF',
    marginBottom: '1.5rem',
  },

  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },

  planOption: {
    backgroundColor: '#252525',
    border: '2px solid #3A3A3A',
    borderRadius: '8px',
    padding: '1.5rem',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textAlign: 'center',
  },

  planOptionSelected: {
    backgroundColor: '#1E90FF',
    borderColor: '#1E90FF',
    color: '#FFFFFF',
  },

  planName: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
  },

  planPrice: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '0.25rem',
  },

  planPeriod: {
    fontSize: '0.85rem',
    opacity: 0.7,
  },

  cryptoOnlyBadge: {
    display: 'inline-block',
    marginTop: '0.5rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '999px',
    backgroundColor: '#2A2A2A',
    color: '#FFD93D',
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },

  cryptoOnlyNote: {
    color: '#FFD93D',
    fontSize: '0.9rem',
    marginBottom: '1rem',
  },

  cryptoSelector: {
    marginBottom: '1.5rem',
  },

  cryptoSelectorLabel: {
    color: '#B0C4DE',
    marginBottom: '0.5rem',
    fontSize: '0.9rem',
  },

  cryptoPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },

  cryptoPill: {
    border: '1px solid #3A3A3A',
    backgroundColor: '#1A1A1A',
    color: '#F0F4F8',
    padding: '0.35rem 0.9rem',
    borderRadius: '999px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontWeight: 500,
  },

  cryptoPillActive: {
    borderColor: '#1E90FF',
    backgroundColor: '#1C2C4E',
    color: '#FFFFFF',
  },

  mutedText: {
    color: '#A0AEC0',
    marginBottom: '1rem',
    lineHeight: 1.6,
  },

  invoiceSummaryBox: {
    backgroundColor: '#151821',
    borderRadius: '8px',
    border: '1px solid #2A2F3F',
    padding: '1.25rem',
    marginBottom: '1.5rem',
  },

  invoiceSummaryTitle: {
    fontSize: '1.1rem',
    color: '#E2E8F0',
    marginBottom: '0.5rem',
  },

  invoiceSummaryText: {
    fontSize: '0.9rem',
    color: '#A0AEC0',
    marginBottom: '1rem',
  },

  invoiceSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
  },

  invoiceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
    marginBottom: '1rem',
  },

  invoiceDetail: {
    backgroundColor: '#1E1E1E',
    border: '1px solid #3A3A3A',
    borderRadius: '6px',
    padding: '1rem',
  },

  copyButton: {
    marginTop: '0.5rem',
    backgroundColor: 'transparent',
    border: '1px solid #1E90FF',
    color: '#1E90FF',
    borderRadius: '4px',
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },

  wordBreak: {
    wordBreak: 'break-all',
    display: 'inline-block',
    marginBottom: '0.25rem',
  },

  qrWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1rem',
  },

  qrCode: {
    width: '140px',
    height: '140px',
    borderRadius: '12px',
    border: '1px solid #3A3A3A',
  },

  invoiceLink: {
    marginBottom: '1rem',
    color: '#1E90FF',
    fontSize: '0.9rem',
  },

  providerSummary: {
    marginBottom: '2rem',
  },

  summary: {
    marginBottom: '2rem',
  },

  locationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
    marginBottom: '1rem',
  },

  locationField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },

  locationLabel: {
    fontSize: '0.9rem',
    color: '#B0C4DE',
  },

  select: {
    backgroundColor: '#1A1A1A',
    border: '1px solid #3A3A3A',
    borderRadius: '4px',
    color: '#F0F4F8',
    padding: '0.5rem 0.75rem',
    fontSize: '0.9rem',
  },

  input: {
    backgroundColor: '#1A1A1A',
    border: '1px solid #3A3A3A',
    borderRadius: '4px',
    color: '#F0F4F8',
    padding: '0.5rem 0.75rem',
    fontSize: '0.9rem',
  },

  locationHint: {
    color: '#A0AEC0',
    fontSize: '0.85rem',
    marginBottom: '1.5rem',
  },

  paymentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },

  paymentOption: {
    backgroundColor: '#252525',
    border: '2px solid #3A3A3A',
    borderRadius: '8px',
    padding: '1.5rem',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },

  paymentOptionSelected: {
    backgroundColor: '#1E90FF',
    borderColor: '#1E90FF',
    color: '#FFFFFF',
  },

  paymentName: {
    fontSize: '1rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
  },

  paymentProvider: {
    fontSize: '0.85rem',
    opacity: 0.7,
  },

  affiliateForm: {
    width: '100%',
  },

  affiliateApplied: {
    textAlign: 'center',
  },

  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'space-between',
    marginTop: '2rem',
  },

  waitNotice: {
    color: '#FFD93D',
    marginBottom: '1rem',
    padding: '0.75rem',
    borderRadius: '4px',
    border: '1px solid #3A3A3A',
    backgroundColor: '#131313',
  },

  statusPanel: {
    backgroundColor: '#131E22',
    border: '1px solid #2B2B2B',
    borderRadius: '6px',
    padding: '1rem',
    marginBottom: '1rem',
    color: '#F0F4F8',
    lineHeight: 1.6,
  },

  statusInfo: {
    color: '#A0AEC0',
    fontSize: '0.95rem',
    marginBottom: '1rem',
  },

  nextButton: {
    marginTop: '1rem',
    width: '100%',
  },

  error: {
    color: '#FF6B6B',
    marginBottom: '1rem',
    padding: '0.75rem',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: '4px',
  },

  accountDataBox: {
    marginBottom: '2rem',
  },

  hint: {
    fontSize: '0.85rem',
    color: '#A0AEC0',
    marginTop: '0.25rem',
  },

  kitDisplay: {
    backgroundColor: '#1A1A1A',
    border: '1px solid #3A3A3A',
    borderRadius: '4px',
    padding: '1rem',
    overflow: 'auto',
  },

  kitCode: {
    color: '#00CED1',
    fontSize: '0.85rem',
    wordBreak: 'break-all',
  },

  linkButton: {
    textDecoration: 'none',
    display: 'block',
  },
};
