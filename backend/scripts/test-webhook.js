/**
 * Test webhook script for AhoyVPN
 * Simulates webhook calls from payment providers
 */

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config({ path: './.env' });

// Configuration
const API_BASE_URL = 'http://localhost:3000';

// Test data
const testCustomers = [
  { accountNumber: '12345678', email: 'demo1@ahoyvpn.net' },
  { accountNumber: '87654321', email: 'demo2@ahoyvpn.net' }
];

const testPlans = {
  monthly: { price: 9.99, planKey: 'monthly' },
  quarterly: { price: 24.99, planKey: 'quarterly' },
  semiAnnual: { price: 44.99, planKey: 'semiAnnual' },
  annual: { price: 79.99, planKey: 'annual' }
};

/**
 * Test Plisio webhook
 */
async function testPlisioWebhook() {
  console.log('🧪 Testing Plisio webhook...\n');

  const customer = testCustomers[0];
  const plan = testPlans.monthly;

  const webhookData = {
    status: 'completed',
    order_number: `AHOY-${Date.now()}-${customer.accountNumber}`,
    invoice_id: `inv_${Date.now()}`,
    tx_id: `tx_${Date.now()}`,
    currency: 'BTC',
    amount: plan.price.toString(),
    email: customer.email,
    wallet_address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    timestamp: Math.floor(Date.now() / 1000)
  };

  console.log('Webhook payload:');
  console.log(JSON.stringify(webhookData, null, 2));
  console.log('\n');

  try {
    // Generate Plisio signature
    const apiKey = process.env.PLISIO_API_KEY;
    const sortedParams = Object.keys(webhookData)
      .sort()
      .map(key => `${key}=${webhookData[key]}`)
      .join('&');
    const signature = crypto
      .createHmac('sha256', apiKey)
      .update(sortedParams)
      .digest('hex');

    const response = await axios.post(
      `${API_BASE_URL}/api/payment/webhook/plisio`,
      webhookData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Plisio-Signature': signature
        },
        timeout: 5000
      }
    );

    console.log('✅ Plisio webhook test successful!');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Plisio webhook test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * Test PaymentsCloud webhook (simulated)
 */
async function testPaymentsCloudWebhook() {
  console.log('\n🧪 Testing PaymentsCloud webhook...\n');

  const customer = testCustomers[1];
  const plan = testPlans.quarterly;

  const webhookData = {
    event: 'payment.succeeded',
    data: {
      id: `pay_${Date.now()}`,
      amount: Math.round(plan.price * 100), // cents
      currency: 'usd',
      status: 'succeeded',
      customer_email: customer.email,
      metadata: {
        account_number: customer.accountNumber,
        plan_key: plan.planKey
      },
      created: Math.floor(Date.now() / 1000)
    }
  };

  console.log('Webhook payload:');
  console.log(JSON.stringify(webhookData, null, 2));
  console.log('\n');

  try {
    const paycloudSecret = process.env.PAYCLOUD_SECRET;
    const signature = paycloudSecret
      ? crypto.createHmac('sha256', paycloudSecret).update(JSON.stringify(webhookData)).digest('hex')
      : null;

    const response = await axios.post(
      `${API_BASE_URL}/api/payment/webhook/paymentscloud`,
      webhookData,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(signature ? { 'X-PaymentsCloud-Signature': signature } : {})
        },
        timeout: 5000
      }
    );

    console.log('✅ PaymentsCloud webhook test successful!');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ PaymentsCloud webhook test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * Test checkout flow
 */
async function testCheckoutFlow() {
  console.log('\n🧪 Testing checkout flow...\n');

  const customer = testCustomers[0];
  const plan = testPlans.monthly;

  const checkoutData = {
    plan: 'Monthly',
    planKey: plan.planKey,
    price: plan.price,
    tax: 0,
    total: plan.price,
    email: customer.email,
    paymentMethod: 'crypto',
    crypto: {
      currency: 'BTC',
      walletAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
    },
    returnUrl: `${API_BASE_URL}/dashboard.html?payment=success`
  };

  console.log('Checkout payload:');
  console.log(JSON.stringify(checkoutData, null, 2));
  console.log('\n');

  try {
    // Note: This requires authentication, so it will fail without a valid JWT
    const response = await axios.post(
      `${API_BASE_URL}/api/payment/checkout`,
      checkoutData,
      {
        headers: {
          'Content-Type': 'application/json'
          // Add JWT token here if testing with authentication
        },
        timeout: 5000
      }
    );

    console.log('✅ Checkout test successful!');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Checkout test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';

  console.log('AhoyVPN Webhook Testing');
  console.log('=======================\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  let success = true;

  if (testType === 'plisio' || testType === 'all') {
    success = await testPlisioWebhook() && success;
  }

  if (testType === 'paymentscloud' || testType === 'all') {
    success = await testPaymentsCloudWebhook() && success;
  }

  if (testType === 'checkout' || testType === 'all') {
    success = await testCheckoutFlow() && success;
  }

  console.log('\n=======================');
  if (success) {
    console.log('✅ All tests completed successfully!');
  } else {
    console.log('❌ Some tests failed. Check the errors above.');
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testPlisioWebhook, testPaymentsCloudWebhook, testCheckoutFlow };
