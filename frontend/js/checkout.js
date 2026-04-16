console.log("checkout.js loaded");

// Fetch real prices from backend API
let plans = {
    monthly: { name: 'Monthly Plan', price: 5.99 },
    quarterly: { name: 'Quarterly Plan', price: 16.99 },
    semiAnnual: { name: 'Semi-Annual Plan', price: 31.99 },
    annual: { name: 'Annual Plan', price: 59.99 }
};

// Fetch current prices from backend
(async () => {
    try {
        const response = await fetch('/api/subscription/plans', {
            credentials: 'include'
        });
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                // Update plans with real prices from backend
                data.data.forEach(plan => {
                    if (plans[plan.id]) {
                        plans[plan.id].price = plan.price;
                        plans[plan.id].name = plan.name;
                    }
                });
                console.log('Updated prices from backend:', plans);
                // Refresh the UI with new prices
                updateSummary();
            }
        }
    } catch (err) {
        console.warn('Could not fetch prices from backend, using defaults:', err);
    }
})();

// Authentication check
(async () => {
    try {
        const response = await fetch('/api/user/profile', { credentials: 'include' });
        if (response.status === 401) {
            console.log('User not authenticated, redirecting to login');
            window.location.href = '/login.html?return=' + encodeURIComponent(window.location.pathname + window.location.search);
            return;
        }
    } catch (err) {
        console.error('Auth check failed', err);
    }
})();

// CSRF token helper
function getCsrfToken() {
    const match = document.cookie.match(/csrfToken=([^;]+)/);
    return match ? match[1] : '';
}

// Dynamic plan selection (could be passed via query params)
const urlParams = new URLSearchParams(window.location.search);
const plan = urlParams.get('plan') || 'monthly';

// Promo codes (client-side mapping for UI preview)
const promoCodes = {
    JIMBO: { type: 'fixed', value: 0.50, description: '$0.50 off' },
    FREEWILLY: { type: 'percent', value: 100, description: '100% off first month' }
};
const selected = plans[plan] || plans.monthly;
let currentTotal = 0;

// Prefill email if passed
const email = urlParams.get('email');
if (email) {
    document.getElementById('email').value = email;
} else {
    (async () => {
        try {
            const response = await fetch('/api/user/profile', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.email) {
                    document.getElementById('email').value = data.data.email;
                    document.getElementById('email').readOnly = true;
                }
            }
        } catch (err) {
            // Not logged in, ignore
        }
    })();
}

// Set return URL for crypto payments
document.getElementById('returnUrl').value = window.location.origin + '/dashboard.html?payment=success';

// Update plan name in summary
document.getElementById('plan-name').textContent = selected.name;
// Update plan image
const planImages = {
    monthly: 'goodahoy.png',
    quarterly: 'quarterlyblue.png',
    semiAnnual: 'semiannualblue.png',
    annual: 'goodannual.png'
};
document.getElementById('plan-image').src = `images/${planImages[plan] || 'goodahoy.png'}`;

// Update summary with promo discount
let currentMethod = 'card'; // 'card' or 'crypto' - default to card
function updateSummary() {
    const promoInput = document.getElementById('promoCode').value.trim().toUpperCase();
    const promo = promoCodes[promoInput];
    const basePrice = selected.price;
    let discount = 0;
    let discountDescription = '';

    if (promo) {
        if (promo.type === 'fixed') {
            discount = promo.value;
        } else if (promo.type === 'percent') {
            discount = basePrice * (promo.value / 100);
        }
        // Ensure discount doesn't exceed price
        discount = Math.min(discount, basePrice);
        discountDescription = promo.description;
        // Show promo message
        const msgEl = document.getElementById('promo-message');
        msgEl.textContent = `✅ ${discountDescription} applied.`;
        msgEl.style.color = 'var(--status-active)';
        msgEl.style.display = 'block';
    } else if (promoInput !== '') {
        // Invalid promo code
        const msgEl = document.getElementById('promo-message');
        msgEl.textContent = '❌ Invalid promo code.';
        msgEl.style.color = 'var(--status-error)';
        msgEl.style.display = 'block';
        discount = 0;
    } else {
        // No promo code
        const msgEl = document.getElementById('promo-message');
        msgEl.style.display = 'none';
    }

    const discountedPrice = basePrice - discount;
    const tax = discountedPrice * 0.08; // estimated tax
    const total = discountedPrice + tax;

    // Update UI
    document.getElementById('plan-price').textContent = `$${discountedPrice.toFixed(2)}`;
    if (discount > 0) {
        // Show original price strikethrough
        document.getElementById('plan-price').innerHTML = `<s style="color: var(--text-muted); font-size: 0.9em;">$${basePrice.toFixed(2)}</s> $${discountedPrice.toFixed(2)}`;
    }
    document.getElementById('tax-price').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('total-price').textContent = `$${discountedPrice.toFixed(2)} + tax`;

    // Update payment button
    const payButton = document.getElementById('payButton');
    payButton.textContent = 'Subscribe Now';

    // Update global total variable
    currentTotal = total;
    return { basePrice, discountedPrice, tax, total, discount };
}

// Initial summary update
updateSummary();

// Update payment button text and secure message
function updatePaymentUI() {
    const payButton = document.getElementById('payButton');
    const secureMessage = document.getElementById('secure-message');
    if (currentMethod === 'card') {
        payButton.textContent = 'Subscribe Now';
        secureMessage.textContent = '🔒 Secure payment processing via Authorize.net';
    } else {
        payButton.textContent = 'Proceed to Crypto Payment';
        secureMessage.textContent = '🔒 Secure cryptocurrency payment processed by Plisio';
    }
}

// Initialize UI
updatePaymentUI();

// Tab switching
document.querySelectorAll('.payment-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const method = tab.dataset.method;
        if (method === currentMethod) return;

        // Update active tab
        document.querySelectorAll('.payment-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show/hide forms
        document.getElementById('card-form').classList.remove('active');
        document.getElementById('crypto-form').classList.remove('active');
        document.getElementById(`${method}-form`).classList.add('active');

        // Update state & UI
        currentMethod = method;
        updatePaymentUI();
    });
});

// Update summary when promo code changes
document.getElementById('promoCode').addEventListener('input', updateSummary);

// Form submission
document.getElementById('paymentForm').addEventListener('submit', async function(e) {
    console.log('Form submission handler executing');
    e.preventDefault();
    const btn = document.getElementById('payButton');
    const original = btn.textContent;
    btn.textContent = 'Processing...';
    btn.disabled = true;

    // Collect form data with current promo discount
    const { discountedPrice, tax: calculatedTax, total: calculatedTotal } = updateSummary();

    const formData = {
        plan: selected.name,
        planKey: plan,
        price: discountedPrice,
        tax: calculatedTax,
        total: calculatedTotal,
        email: document.getElementById('email').value,
        referralCode: document.getElementById('promoCode').value.trim(),
        promoCode: document.getElementById('promoCode').value.trim(),
        paymentMethod: currentMethod,
        returnUrl: document.getElementById('returnUrl').value
    };

    console.log('Payment data:', formData);

    try {
        const response = await fetch('/api/payment/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
            body: JSON.stringify(formData),
            credentials: 'include'
        });

        if (response.status === 401) {
            alert('Please log in to continue.');
            window.location.href = '/login.html';
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Payment failed');
        }

        if (data.success) {
            if (currentMethod === 'card') {
                // Card payment: redirect to Authorize.net hosted payment page
                if (data.redirectUrl) {
                    console.log('Redirecting to hosted payment page:', data.redirectUrl);
                    window.location.href = data.redirectUrl;
                } else {
                    throw new Error('No hosted payment URL returned');
                }
            } else {
                // Crypto payment: show invoice details or redirect
                alert(`Crypto payment invoice created. Please pay ${data.amountDue} ${data.currency} to ${data.walletAddress}.`);
                window.location.href = data.invoiceUrl;
            }
        } else {
            throw new Error(data.error || 'Unknown error');
        }
    } catch (error) {
        console.error('Checkout error:', error);
        alert('Payment failed: ' + error.message);
        btn.textContent = original;
        btn.disabled = false;
    }
});

// Show payment failure banner if URL contains payment=failed
if (urlParams.get('payment') === 'failed') {
    document.getElementById('payment-banner').style.display = 'block';
}

// Back to Plans button
document.getElementById('back-to-plans-btn')?.addEventListener('click', () => {
    window.location.href = 'index.html';
});
