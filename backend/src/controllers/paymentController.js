const fetch = require('node-fetch');

const db = require('../config/database');

const { v4: uuidv4 } = require('uuid');

const crypto = require('crypto');

const fs = require('fs');

const path = require('path');

const paymentConfig = require('../config/paymentConfig');

const { createVpnAccount } = require('../services/userService');

const vpnAccountScheduler = require('../services/vpnAccountScheduler');



const plisioService = require('../services/plisioService');

const zipTaxService = require('../services/ziptaxService');

const { getAuthorizeTransactionDetails } = require('../services/authorizeNetUtils');



// VPN Resellers API Integration

class VPNResellersService {

  constructor() {

    this.apiToken = paymentConfig.vpnResellers.apiToken;

    this.apiUrl = paymentConfig.vpnResellers.apiUrl;

  }



  async createAccount(userData) {

    try {

      const response = await fetch(`${this.apiUrl}/api/v1/accounts`, {

        method: 'POST',

        headers: {

          'Authorization': `Bearer ${this.apiToken}`,

          'Content-Type': 'application/json'

        },

        body: JSON.stringify({

          username: userData.username,

          password: userData.password,

          email: userData.email || null,

          plan_id: userData.plan_id

        })

      });



      if (!response.ok) {

        throw new Error(`VPN Resellers API error: ${response.status}`);

      }



      return await response.json();

    } catch (error) {

      console.error('VPN Resellers API error:', error);

      throw error;

    }

  }



  async activateAccount(accountId) {

    try {

      const response = await fetch(

        `${this.apiUrl}/api/v1/accounts/${accountId}/activate`,

        {

          method: 'POST',

          headers: {

            'Authorization': `Bearer ${this.apiToken}`,

            'Content-Type': 'application/json'

          }

        }

      );



      if (!response.ok) {

        throw new Error(`VPN Resellers API error: ${response.status}`);

      }



      return await response.json();

    } catch (error) {

      console.error('VPN Resellers activation error:', error);

      throw error;

    }

  }

}



// Authorize.net Integration

class AuthorizeNetService {

  constructor() {

    this.apiLoginId = paymentConfig.authorizeNet.apiLoginId;

    this.transactionKey = paymentConfig.authorizeNet.transactionKey;

    this.environment = paymentConfig.authorizeNet.environment;

  }



  getApiEndpoint() {

    return paymentConfig.authorizeNet.endpoints.charge;

  }



  getHostedFormUrl() {

    return this.environment === 'production'

      ? 'https://accept.authorize.net/payment/payment'

      : 'https://test.authorize.net/payment/payment';

  }



  async createTransaction(amount, cardData, billingInfo) {

    // Legacy direct-card flow (kept for backward compatibility)

    const transactionRequest = {

      createTransactionRequest: {

        merchantAuthentication: {

          name: this.apiLoginId,

          transactionKey: this.transactionKey

        },

        transactionRequest: {

          transactionType: 'authOnlyTransaction',

          amount: amount.toString(),

          payment: {

            creditCard: {

              cardNumber: cardData.number,

              expirationDate: cardData.expiration,

              cardCode: cardData.cvv

            }

          },

          billTo: {

            firstName: billingInfo.firstName,

            lastName: billingInfo.lastName,

            address: billingInfo.address,

            city: billingInfo.city,

            state: billingInfo.state,

            zip: billingInfo.zip,

            country: billingInfo.country

          }

        }

      }

    };



    try {

      const response = await fetch(this.getApiEndpoint(), {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json'

        },

        body: JSON.stringify(transactionRequest)

      });



      if (!response.ok) {

        throw new Error(`Authorize.net API error: ${response.status}`);

      }



      return await response.json();

    } catch (error) {

      console.error('Authorize.net API error:', error);

      throw error;

    }

  }



  async createHostedPaymentPage({ amount, invoiceNumber, description, returnUrl, cancelUrl, email }) {

    if (!this.apiLoginId || !this.transactionKey) {

      throw new Error('Authorize.net credentials are missing');

    }



    const requestBody = {

      getHostedPaymentPageRequest: {

        merchantAuthentication: {

          name: this.apiLoginId,

          transactionKey: this.transactionKey

        },

        transactionRequest: {

          transactionType: 'authCaptureTransaction',

          amount: amount.toString(),

          order: {

            invoiceNumber,

            description

          },

          customer: {

            email

          }

        },

        hostedPaymentSettings: {

          setting: [

            {

              settingName: 'hostedPaymentReturnOptions',

              settingValue: JSON.stringify({

                showReceipt: true,

                url: returnUrl,

                urlText: 'Return to AhoyVPN',

                cancelUrl,

                cancelUrlText: 'Cancel'

              })

            },

            {

              settingName: 'hostedPaymentButtonOptions',

              settingValue: JSON.stringify({ text: 'Pay' })

            }

          ]

        }

      }

    };



    const response = await fetch(this.getApiEndpoint(), {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify(requestBody)

    });



    if (!response.ok) {

      throw new Error(`Authorize.net hosted page API error: ${response.status}`);

    }



    // Authorize.net sometimes prepends a UTF-8 BOM or whitespace before JSON,

    // which breaks response.json(). Parse manually and strip BOM.

    const raw = await response.text();

    let data;

    try {

      data = JSON.parse(raw.replace(/^\uFEFF/, ''));

    } catch (err) {

      console.error('Authorize.net hosted page JSON parse error:', err.message, 'body=', raw.slice(0, 200));

      throw new Error('Authorize.net hosted page returned invalid JSON');

    }

    const resultCode = data?.messages?.resultCode;



    if (process.env.DEBUG_AUTHORIZE_NET === 'true') {

      console.log('Authorize.net hosted response', {

        resultCode,

        token: data?.token || null,

        messages: data?.messages || null

      });

    }



    if (resultCode !== 'Ok' || !data?.token) {

      const msg = data?.messages?.message?.[0]?.text || 'Failed to create hosted payment token';

      throw new Error(msg);

    }



    return {

      token: data.token,

      formUrl: this.getHostedFormUrl()

    };

  }



  async createArbSubscription({

    amount,

    intervalLength,

    intervalUnit,

    startDate,

    subscriberName,

    subscriberEmail,

    billingAddress,

    invoiceNumber,

    description

  }) {

    // ARBCreateSubscriptionRequest

    // intervalUnit: 'days' | 'months'

    // startDate: YYYY-MM-DD

    const requestBody = {

      createSubscriptionRequest: {

        merchantAuthentication: {

          name: this.apiLoginId,

          transactionKey: this.transactionKey

        },

        subscription: {

          name: description || 'AhoyVPN Subscription',

          paymentSchedule: {

            startDate,

            interval: {

              length: intervalLength,

              unit: intervalUnit

            },

            totalOccurrences: 9999,

            trialOccurrences: 0

          },

          amount: parseFloat(amount).toFixed(2),

          payment: {

            creditCard: {

              cardNumber: billingAddress.cardNumber,

              expirationDate: billingAddress.expirationDate,

              cardCode: billingAddress.cardCode

            }

          },

          customer: {

            email: subscriberEmail

          },

          billTo: {

            firstName: billingAddress.firstName || subscriberName?.split(' ')[0] || '',

            lastName: billingAddress.lastName || subscriberName?.split(' ').slice(1).join(' ') || '',

            address: billingAddress.address || '',

            city: billingAddress.city || '',

            state: billingAddress.state || '',

            zip: billingAddress.zip || '',

            country: billingAddress.country || 'USA'

          },

          order: {

            invoiceNumber,

            description

          }

        }

      }

    };



    try {

      const response = await fetch(this.getApiEndpoint(), {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(requestBody)

      });



      const raw = await response.text();

      const data = JSON.parse(raw.replace(/^\uFEFF/, ''));



      if (data?.messages?.resultCode !== 'Ok') {

        const msg = data?.messages?.message?.[0]?.text || 'ARB subscription creation failed';

        throw new Error(msg);

      }



      return {

        subscriptionId: data.subscriptionId,

        status: data.messages?.resultCode

      };

    } catch (error) {

      console.error('ARB subscription creation error:', error.message || error);

      throw error;

    }

  }



  async getArbSubscription(subscriptionId) {

    const requestBody = {

      getSubscriptionRequest: {

        merchantAuthentication: {

          name: this.apiLoginId,

          transactionKey: this.transactionKey

        },

        subscriptionId: String(subscriptionId)

      }

    };



    try {

      const response = await fetch(this.getApiEndpoint(), {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(requestBody)

      });



      const raw = await response.text();

      const data = JSON.parse(raw.replace(/^\uFEFF/, ''));



      if (data?.messages?.resultCode !== 'Ok') {

        return null;

      }



      return {

        subscriptionId: data.subscription?.id,

        status: data.subscription?.status,

        amount: data.subscription?.paymentSchedule?.amount,

        intervalLength: data.subscription?.paymentSchedule?.interval?.length,

        intervalUnit: data.subscription?.paymentSchedule?.interval?.unit,

        startDate: data.subscription?.paymentSchedule?.startDate,

        nextPaymentDate: data.subscription?.paymentSchedule?.nextPaymentDate,

        totalOccurrences: data.subscription?.paymentSchedule?.totalOccurrences,

        trialOccurrences: data.subscription?.paymentSchedule?.trialOccurrences,

        profile: data.subscription?.profile

      };

    } catch (error) {

      console.error('ARB get subscription error:', error.message || error);

      return null;

    }

  }



  async createArbSubscriptionFromProfile({

    amount,

    intervalLength,

    intervalUnit,

    startDate,

    customerProfileId,

    customerPaymentProfileId,

    subscriberEmail,

    description,

    invoiceNumber

  }) {

    // Creates ARB subscription using an already-stored customer payment profile.

    // This is used after a hosted payment page charge — Authorize.net automatically

    // stores the card as a payment profile; we just reference it by ID.

    const requestBody = {

      createSubscriptionRequest: {

        merchantAuthentication: {

          name: this.apiLoginId,

          transactionKey: this.transactionKey

        },

        subscription: {

          name: description || 'AhoyVPN Subscription',

          paymentSchedule: {

            startDate,

            interval: {

              length: intervalLength,

              unit: intervalUnit

            },

            totalOccurrences: 9999,

            trialOccurrences: 0

          },

          amount: parseFloat(amount).toFixed(2),

          payment: {

            storedCredentials: {

              mandate: 'recurring'

            }

          },

          customer: {

            email: subscriberEmail

          },

          order: {

            invoiceNumber: `ARB-${invoiceNumber}`,

            description

          },

          customerProfileId: String(customerProfileId),

          customerPaymentProfileId: String(customerPaymentProfileId)

        }

      }

    };



    try {

      const response = await fetch(this.getApiEndpoint(), {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(requestBody)

      });



      const raw = await response.text();

      const data = JSON.parse(raw.replace(/^\uFEFF/, ''));



      if (data?.messages?.resultCode !== 'Ok') {

        const msg = data?.messages?.message?.[0]?.text || 'ARB subscription creation failed';

        throw new Error(msg);

      }



      return {

        subscriptionId: data.subscriptionId,

        status: data.messages?.resultCode

      };

    } catch (error) {

      console.error('ARB subscription creation error:', error.message || error);

      throw error;

    }

  }



  async cancelArbSubscription(subscriptionId) {

    const requestBody = {

      cancelSubscriptionRequest: {

        merchantAuthentication: {

          name: this.apiLoginId,

          transactionKey: this.transactionKey

        },

        subscriptionId: String(subscriptionId)

      }

    };



    try {

      const response = await fetch(this.getApiEndpoint(), {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(requestBody)

      });



      const raw = await response.text();

      const data = JSON.parse(raw.replace(/^\uFEFF/, ''));



      return data?.messages?.resultCode === 'Ok';

    } catch (error) {

      console.error('ARB cancel subscription error:', error.message || error);

      return false;

    }

  }

}



// Initialize services

const vpnResellersService = new VPNResellersService();

const authorizeNetService = new AuthorizeNetService();



const logAuthorizeRelay = (data) => {

  try {

    const dir = path.join(process.cwd(), 'logs');

    fs.mkdirSync(dir, { recursive: true });

    const line = JSON.stringify({ ts: new Date().toISOString(), ...data });

    fs.appendFileSync(path.join(dir, 'authorize-relay.log'), line + '\n');

  } catch (error) {

    console.error('Authorize relay logging error:', error);

  }

};



const normalizeAffiliateCode = (value) => {

  const normalized = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

  return normalized || null;

};



const ALLOWED_CRYPTO_CURRENCIES = new Set([

  'BTC', // Bitcoin

  'LTC', // Litecoin

  'DASH', // Dash

  'ZEC', // Zcash

  'DOGE', // Dogecoin

  'BCH', // Bitcoin Cash

  'XMR', // Monero

  'USDC', // USD Coin (ERC-20)

  'USDC_BEP20', // USDC BEP-20

  'USDT', // Tether ERC-20

  'USDT_TRX', // Tether TRC-20

  'USDT_BEP20', // Tether BEP-20

  'TON', // Toncoin

  'APE', // ApeCoin ERC-20

  'SOL', // Solana

  'LOVE', // Love Bit BEP-20

  'ETH', // Ethereum

  'BASE_ETH', // Ethereum Base

  'ETC', // Ethereum Classic

  'BTTC_TRX', // BitTorrent-Chain TRC-20

  'BUSD_BEP20', // Binance USD BEP-20

  'BNB', // BNB Chain

  'TRX', // Tron

  'SHIB', // Shiba Inu ERC-20

]);



const calculatePeriodEnd = (interval, startDate = new Date()) => {

  const end = new Date(startDate);

  switch (String(interval || '').toLowerCase()) {

    case 'month':

      end.setMonth(end.getMonth() + 1);

      break;

    case 'quarter':

      end.setMonth(end.getMonth() + 3);

      break;

    case 'semi_annual':

      end.setMonth(end.getMonth() + 6);

      break;

    case 'year':

      end.setFullYear(end.getFullYear() + 1);

      break;

    default:

      end.setMonth(end.getMonth() + 1);

  }

  return end;

};





// ========== AFFILIATE COMMISSION HELPERS (added 2026-04-13) ==========

const getMinimumPayoutCents = async () => {

  try {

    const r = await db.query("SELECT (value->>'amount')::int as amount FROM payout_config WHERE key = 'minimum_payout_cents' LIMIT 1");

    return r.rows.length > 0 ? parseInt(r.rows[0].amount) : 1000;

  } catch { return 1000; }

};



const getDefaultDiscountCents = async () => {

  try {

    const r = await db.query("SELECT default_discount_cents FROM payout_config WHERE key = 'default_discount_cents' LIMIT 1");

    return r.rows.length > 0 ? parseInt(r.rows[0].default_discount_cents) : 0;

  } catch { return 0; }

};



const applyAffiliateCommissionIfEligible = async ({ affiliateCode, affiliateLinkId, accountNumber, plan, amountCents }) => {

  if (!affiliateCode) return null;



  // Look up affiliate by username (affiliates table has username, not code)

  const affiliateResult = await db.query(

    `SELECT id, username, user_id

     FROM affiliates

     WHERE UPPER(username) = UPPER($1) AND status = 'active'

     LIMIT 1`,

    [affiliateCode]

  );



  if (affiliateResult.rows.length === 0) {

    console.log(`Affiliate not found for code: ${affiliateCode}`);

    return null;

  }



  const affiliate = affiliateResult.rows[0];



  // Prevent self-referral (affiliate cannot refer themselves)

  if (affiliate.user_id) {

    // Can't easily check self-referral without user_id on referral, skip for now

  }



  // Commission: 10% of transaction amount, $0.75 minimum

  const commissionRate = 0.10;

  const operatingCostPerUserCents = Math.round((parseFloat(process.env.OPERATING_COST_PER_USER) || 1.20) * 100);

  const netProfitCents = Math.max(0, amountCents - operatingCostPerUserCents);

  const computedCommission = Math.round(netProfitCents * commissionRate);

  const finalCommissionCents = Math.max(computedCommission, await getMinimumPayoutCents()); // $0.75 min



  // Anonymized customer hash (no PII — hash of account number)

  const customerHash = accountNumber

    ? require('crypto').createHash('sha256').update(accountNumber).digest('hex').substring(0, 32)

    : `cust_${affiliate.id}_${Date.now()}`;



  // Record referral

  await db.query(

    `INSERT INTO referrals (affiliate_id, customer_hash, plan, amount_cents, transaction_date, status, referral_link_id, created_at)

     VALUES ($1, $2, $3, $4, NOW(), 'active', $5, NOW())`,

    [affiliate.id, customerHash, plan || 'unknown', amountCents, affiliateLinkId || null]

  );



  // Credit commission to affiliate's transaction ledger (positive = credit)

  await db.query(

    `INSERT INTO transactions (affiliate_id, type, amount_cents, description, created_at)

     VALUES ($1, 'commission', $2, $3, NOW())`,

    [

      affiliate.id,

      finalCommissionCents,

      `Referral commission for ${plan || 'signup'} signup — $${(amountCents / 100).toFixed(2)} transaction`

    ]

  );



  console.log(`💰 Commission $${(finalCommissionCents / 100).toFixed(2)} credited to affiliate ${affiliate.username} (${affiliate.id})`);

  return finalCommissionCents;

};



// Get available plans (requires authentication)

const getPlans = async (req, res) => {

  try {

    const result = await db.query('SELECT * FROM plans ORDER BY amount_cents');

    res.json({ plans: result.rows });

  } catch (error) {

    console.error('Get plans error:', error);

    res.status(500).json({ error: 'Failed to get plans' });

  }

};



// Helper to extract minimal location info for tax calculation

const extractLocationFromBody = (body = {}) => {

  const billing = body.billingInfo || {};



  const country = (body.country || billing.country || '').trim();

  const region =

    (body.stateOrProvince || body.region || billing.state || '').trim();

  const postalCode =

    (body.postalCode || body.zip || body.postal || billing.zip || '').trim();



  return { country, region, postalCode };

};



// Create checkout session (requires authentication)

const createCheckout = async (req, res) => {

  try {

    const {

      planId,

      paymentMethod,

      cardData,

      billingInfo,

      returnUrl,

      cancelUrl,

      affiliateId,

      payerWalletAddress

    } = req.body;

    const userId = req.user.id;



    // Get user details

    const userResult = await db.query(

      'SELECT account_number, email, is_active FROM users WHERE id = $1',

      [userId]

    );



    if (userResult.rows.length === 0) {

      return res.status(404).json({ error: 'User not found' });

    }



    const user = userResult.rows[0];



    // Get plan details

    // Accept both UUID plan IDs and legacy frontend aliases (monthly/quarterly/semiannual/annual)

    const planAliases = {

      monthly: 'monthly',

      quarterly: 'quarterly',

      semiannual: 'semi-annual',

      'semi-annual': 'semi-annual',

      annual: 'annual'

    };



    const normalizedPlanInput = String(planId || '').trim();

    const lowerPlanInput = normalizedPlanInput.toLowerCase();

    const aliasPlanInput = planAliases[lowerPlanInput] || lowerPlanInput;



    const planResult = await db.query(

      `SELECT * FROM plans

       WHERE id::text = $1

          OR lower(name) = lower($2)

          OR lower(replace(name, '‑', '-')) = lower($2)

       LIMIT 1`,

      [normalizedPlanInput, aliasPlanInput]

    );



    if (planResult.rows.length === 0) {

      return res.status(400).json({ error: 'Invalid plan' });

    }



    const plan = planResult.rows[0];

    const safeAffiliateCode = normalizeAffiliateCode(affiliateId);



    // Auto-apply per-affiliate-link discount (from affiliate_link_discounts table)

    let discountedBaseCents = plan.amount_cents;

    let perLinkDiscount = 0;
    if (safeAffiliateCode) {

      const discountResult = await db.query(

        `SELECT ald.discount_cents

         FROM affiliate_links al

         JOIN affiliate_link_discounts ald ON al.id = ald.affiliate_link_id

         WHERE UPPER(al.code) = UPPER(\$1) AND al.active = true LIMIT 1`,

        [safeAffiliateCode]

      );

      perLinkDiscount = discountResult.rows[0]?.discount_cents || 0;

      if (perLinkDiscount > 0) {

        discountedBaseCents = Math.max(0, plan.amount_cents - perLinkDiscount);

        console.log("Affiliate link discount: " + perLinkDiscount + " cents off, " + plan.amount_cents + " -> " + discountedBaseCents);

      }

    }





    // ----- Sales tax (ZipTax) integration -----

    // Minimal location: country + state/province + postal code

    const { country, region, postalCode } = extractLocationFromBody(req.body);



    let taxRate = 0;

    let taxAmountCents = 0;

    let totalAmountCents = discountedBaseCents;



    // Normalize country for ZipTax (supports USA/CAN). We only charge tax for US in v1.

    const countryNormalized = String(country || '').trim().toUpperCase();

    const isUSCustomer = ['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(

      countryNormalized

    );



    if (isUSCustomer) {

      if (!region || !postalCode) {

        return res.status(400).json({

          error: 'Unable to fetch crucial data, please try again later',

          details: 'Missing state or postal code for tax calculation.'

        });

      }



      try {

        const { rate } = await zipTaxService.lookupCombinedSalesTaxRate({

          countryCode: 'USA',

          region,

          postalCode

        });



        taxRate = rate || 0;

        taxAmountCents = Math.round(discountedBaseCents * taxRate);

        totalAmountCents = discountedBaseCents + taxAmountCents;

      } catch (err) {

        console.error('ZipTax error during checkout:', err.message || err);

        return res.status(503).json({

          error: 'Unable to fetch crucial data, please try again later'

        });

      }

    }



    if (paymentMethod === 'crypto') {

      const cryptoCurrency = String((req.body.cryptoCurrency || 'BTC')).trim().toUpperCase() || 'BTC';

      if (!ALLOWED_CRYPTO_CURRENCIES.has(cryptoCurrency)) {

        return res.status(400).json({ error: 'Unsupported cryptocurrency' });

      }



      const forwardedProto = req.headers['x-forwarded-proto'];

      const forwardedHost = req.headers['x-forwarded-host'];

      const directHost = req.headers.host;

      const configuredBaseUrl = process.env.FRONTEND_URL || process.env.API_BASE_URL || 'https://ahoyvpn.net';

      const inferredBaseUrl = (forwardedHost || directHost)

        ? `${forwardedProto || 'https'}://${forwardedHost || directHost}`

        : null;

      const baseApiUrl = (inferredBaseUrl || configuredBaseUrl).replace(/\/$/, '');

      const appBaseUrl = baseApiUrl.replace(/\/api\/?$/, '');

      const callbackUrl = `${baseApiUrl}/api/webhooks/plisio`;

      const successPageUrl = returnUrl || `${appBaseUrl}/dashboard.html?payment=success`;

      const cancelPageUrl = cancelUrl || `${appBaseUrl}/checkout.html?payment=failed`;



      const invoice = await createPlisioInvoice(

        { ...plan, total_amount_cents: totalAmountCents },

        user,

        cryptoCurrency,

        callbackUrl,

        successPageUrl,

        cancelPageUrl

      );



      const periodStart = new Date();

      const periodEnd = calculatePeriodEnd(plan.interval, periodStart);

      const subscriptionId = uuidv4();



      await db.query(

        `INSERT INTO subscriptions (

           id, user_id, plan_id, status,

           current_period_start, current_period_end,

           created_at, updated_at,

           referral_code, plisio_invoice_id, metadata

         ) VALUES (

           $1, $2, $3, 'trialing',

           $4, $5,

           NOW(), NOW(),

           $6, $7, $8::jsonb

         )`,

        [

          subscriptionId,

          userId,

          plan.id,

          periodStart,

          periodEnd,

          safeAffiliateCode,

          invoice.invoiceId,

          JSON.stringify({

            payment_method: 'plisio',

            crypto_currency: cryptoCurrency,

            status: 'pending_payment',

            wallet_address: invoice.walletAddress,

            invoice_url: invoice.invoiceUrl,

            plan_interval: plan.interval,

            plan_amount_cents: plan.amount_cents,

            tax_amount_cents: taxAmountCents,

            tax_rate: taxRate,

            total_amount_cents: totalAmountCents,

            payer_wallet_address: payerWalletAddress || null

          })

        ]

      );



      await db.query(

        `INSERT INTO payments (id, user_id, subscription_id, amount_cents, currency, status, payment_method, payment_intent_id, invoice_url, created_at)

         VALUES ($1, $2, $3, $4, $5, 'pending', 'plisio', $6, $7, NOW())`,

        [

          uuidv4(),

          userId,

          subscriptionId,

          totalAmountCents,

          plan.currency || 'USD',

          invoice.invoiceId,

          invoice.invoiceUrl

        ]

      );



      return res.json({

        paymentMethod: 'crypto',

        flow: 'plisio',

        cryptoCurrency,

        subscriptionId,

        invoice,

        pricing: {

          currency: plan.currency || 'USD',

          baseAmountCents: plan.amount_cents,

          discountCents: perLinkDiscount || 0,

          discountedBaseCents,

          taxAmountCents,

          totalAmountCents

        }

      });

    } else if (paymentMethod === 'card' || paymentMethod === 'card_redirect') {

      // Authorize.net is only available for monthly + quarterly plans

      const allowedAuthorizeIntervals = new Set(['month', 'quarter']);

      if (!allowedAuthorizeIntervals.has(String(plan.interval || '').toLowerCase())) {

        return res.status(400).json({

          error: 'Card payments are only available for Monthly and Quarterly plans.'

        });

      }



      // Preferred flow: Authorize.net hosted payment page redirect

      const useHostedRedirect = paymentMethod === 'card_redirect' || !cardData;



      if (useHostedRedirect) {

        const forwardedProto = req.headers['x-forwarded-proto'];

        const forwardedHost = req.headers['x-forwarded-host'];

        const directHost = req.headers.host;



        const inferredBaseUrl = (forwardedHost || directHost)

          ? `${forwardedProto || 'https'}://${forwardedHost || directHost}`

          : null;



        const configuredBaseUrl = process.env.FRONTEND_URL || process.env.API_BASE_URL || 'https://ahoyvpn.net';

        const appBaseUrl = (inferredBaseUrl || configuredBaseUrl).replace(/\/api\/?$/, '').replace(/\/$/, '');



        const relayUrl = `${appBaseUrl}/api/payment/authorize/relay`;

        const hostedReturnUrl = relayUrl;

        const hostedCancelUrl = relayUrl;



        // Authorize.net invoiceNumber max length is 20 chars

        const invoiceNumber = `A${user.account_number}${String(Date.now()).slice(-8)}`;



        // Persist pending checkout so we can attribute affiliate + finalize on relay/webhook.

        const periodStart = new Date();

        const periodEnd = calculatePeriodEnd(plan.interval, periodStart);



        await db.query(

          `INSERT INTO subscriptions (

            id, user_id, plan_id, status,

            current_period_start, current_period_end,

            created_at, updated_at,

            referral_code, account_number, metadata

          ) VALUES (

            $1, $2, $3, 'trialing',

            $4, $5,

            NOW(), NOW(),

            $6, $7, $8::jsonb

          )`,

          [

            uuidv4(),

            userId,

            plan.id,

            periodStart,

            periodEnd,

            safeAffiliateCode,

            user.account_number,

            JSON.stringify({

              payment_method: 'authorize',

              status: 'pending_payment',

              invoice_number: invoiceNumber,

              plan_interval: plan.interval,

              plan_amount_cents: plan.amount_cents,

              tax_amount_cents: taxAmountCents,

              tax_rate: taxRate,

              total_amount_cents: totalAmountCents

            })

          ]

        );



        const hosted = await authorizeNetService.createHostedPaymentPage({

          amount: totalAmountCents / 100,

          invoiceNumber,

          description: `AhoyVPN ${plan.name || plan.plan_key || 'Plan'}`,

          returnUrl: hostedReturnUrl,

          cancelUrl: hostedCancelUrl,

          email: user.email || ''

        });



        if (process.env.DEBUG_AUTHORIZE_NET === 'true') {

          console.log('Authorize.net hosted token created', {

            invoiceNumber,

            amount: totalAmountCents / 100,

            returnUrl: hostedReturnUrl,

            cancelUrl: hostedCancelUrl,

            formUrl: hosted.formUrl,

            token: hosted.token

          });

        }



        // Bridge URL keeps compatibility with older frontend clients that do GET redirects.

        // Use backend bridge endpoint to avoid frontend CSP/cache issues.

        const bridgeUrl = `${appBaseUrl}/api/payment/hosted-redirect?token=${encodeURIComponent(hosted.token)}&formUrl=${encodeURIComponent(hosted.formUrl)}`;



        return res.json({

          paymentMethod: 'card',

          flow: 'redirect',

          // Intentionally return only bridge URL to avoid frontend CSP-blocked direct POST path

          redirectUrl: bridgeUrl,

          invoiceNumber,

          pricing: {

            currency: plan.currency || 'USD',

            baseAmountCents: plan.amount_cents,

            discountCents: perLinkDiscount || 0,

            discountedBaseCents,

            taxAmountCents,

            totalAmountCents

          }

        });

      }



      // Legacy direct-card flow (fallback only)

      const transaction = await authorizeNetService.createTransaction(

        totalAmountCents / 100, // Convert cents to dollars (subtotal + tax)

        cardData,

        billingInfo || {}

      );



      if (transaction.transactionResponse.responseCode === '1') {

        // Payment successful - activate account

        await db.query(

          'UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1',

          [userId]

        );



        // Create subscription

        const subscriptionResult = await db.query(

          `INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)

           VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '30 days', NOW(), NOW())

           RETURNING id`,

          [uuidv4(), userId, planId]

        );



        return res.json({

          paymentMethod: 'card',

          flow: 'direct',

          success: true,

          accountNumber: user.account_number,

          subscriptionId: subscriptionResult.rows[0].id,

          pricing: {

            currency: plan.currency || 'USD',

            baseAmountCents: plan.amount_cents,

            taxAmountCents,

            totalAmountCents

          }

        });

      }



      return res.status(400).json({

        error: 'Payment failed',

        details: transaction.transactionResponse.errors

      });

    } else {

      res.status(400).json({ error: 'Invalid payment method' });

    }

  } catch (error) {

    console.error('Checkout error:', error);

    res.status(500).json({ error: 'Checkout failed', message: error.message });

  }

};



// Plisio webhook handler

const plisioWebhook = async (req, res) => {

  try {

    const signature = req.headers['x-plisio-signature'];

    const secret = process.env.PLISIO_API_KEY;



    const computed = crypto

      .createHmac('sha256', secret)

      .update(JSON.stringify(req.body))

      .digest('hex');



    if (computed !== signature) {

      console.error('Invalid Plisio webhook signature');

      return res.status(401).json({ error: 'Unauthorized' });

    }



    const { id, status, txid, amount, currency, wallet_address } = req.body;



    if (status === 'completed') {

      // Find subscription by plisio_invoice_id (stored in subscriptions table, not invoices)

      const subscriptionResult = await db.query(

        'SELECT id, user_id, plan_id FROM subscriptions WHERE plisio_invoice_id = $1',

        [id]

      );



      if (subscriptionResult.rows.length > 0) {

        const { id: subscriptionId, user_id, plan_id } = subscriptionResult.rows[0];



        // Update subscription status to active

        await db.query(

          'UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2',

          ['active', subscriptionId]

        );



        // Update payment record status

        await db.query(

          'UPDATE payments SET status = $1, updated_at = NOW() WHERE subscription_id = $2',

          ['completed', subscriptionId]

        );



        // Log transaction (use affiliate_id if available, otherwise null)

        await db.query(

          `INSERT INTO transactions (id, affiliate_id, type, amount_cents, description, created_at)

           VALUES ($1, $2, 'commission', $3, $4, NOW())`,

          [uuidv4(), null, Math.round(amount * 100), `Plisio payment: ${txid}`]

        );



        console.log(`✅ Payment processed for user ${user_id}, subscription ${subscriptionId}`);

      }

    }



    res.json({ received: true });

  } catch (error) {

    console.error('Plisio webhook error:', error);

    res.status(500).json({ error: 'Internal server error' });

  }

};



// Account deletion cron job (runs daily)

const deleteOldAccounts = async () => {

  try {

    const cutoffDate = new Date();

    cutoffDate.setDate(cutoffDate.getDate() - 30);



    const result = await db.query(

      `DELETE FROM users

       WHERE registered_at < $1

       AND (last_purchase_at IS NULL OR last_purchase_at < $1)

       AND is_active = false

       RETURNING id`,

      [cutoffDate]

    );



    if (result.rows.length > 0) {

      console.log(`Deleted ${result.rows.length} old accounts`);

    }



    await vpnAccountScheduler.cleanupExpiredAccounts();

    await vpnAccountScheduler.cleanupCanceledSubscriptions();

  } catch (error) {

    console.error('Account deletion error:', error);

  }

};



// Helper functions

async function createPlisioInvoice(plan, user, cryptoCurrency, callbackUrl, successUrl, cancelUrl) {

  const amountUsd = (plan.total_amount_cents != null ? plan.total_amount_cents : plan.amount_cents) / 100;

  const orderNumber = `CRYPTO-${user.account_number || uuidv4().split('-')[0]}-${String(Date.now()).slice(-6)}`;

  const orderName = `AhoyVPN ${plan.name || plan.plan_key || 'Plan'}`;

  const invoice = await plisioService.createInvoice(

    amountUsd,

    cryptoCurrency,

    orderName,

    orderNumber,

    callbackUrl,

    successUrl,

    cancelUrl,

    user.email || ''

  );



  return {

    invoiceId: invoice.invoiceId,

    invoiceUrl: invoice.invoiceUrl,

    qrCode: invoice.qrCode,

    walletAddress: invoice.walletAddress,

    amount: invoice.amountDue,

    currency: invoice.currency,

    expiresAt: invoice.expiresAt,

    cryptoCurrency

  };

}



// Get Plisio invoice status (public endpoint for success_callback_url)

const getInvoiceStatus = async (req, res) => {

  try {

    const { invoiceId } = req.params;

    if (!invoiceId) {

      return res.status(400).json({ error: 'Invoice ID required' });

    }

    

    // Optional: verify request is from Plisio (could check IP or token)

    // For now, just return status

    

    const status = await plisioService.getInvoiceStatus(invoiceId);

    res.json({

      success: true,

      invoiceId,

      status: status.status,

      amount: status.amount,

      currency: status.currency,

      paidAt: status.paid_at,

      expiresAt: status.expire_at

    });

  } catch (error) {

    console.error('Invoice status error:', error);

    res.status(500).json({ error: 'Failed to fetch invoice status' });

  }

};



const hostedRedirectScript = (req, res) => {

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');

  res.status(200).send("(function(){var f=document.getElementById('anet'); if(f){f.submit();}})();");

};



const hostedRedirectBridge = async (req, res) => {

  try {

    const token = String(req.query.token || '').trim();

    const requestedFormUrl = String(req.query.formUrl || '').trim();

    const formUrl = requestedFormUrl || 'https://accept.authorize.net/payment/payment';



    const allowedHosts = new Set(['accept.authorize.net', 'test.authorize.net']);

    let parsed;

    try {

      parsed = new URL(formUrl);

    } catch {

      return res.status(400).send('Invalid formUrl');

    }



    if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname)) {

      return res.status(400).send('Invalid formUrl host');

    }



    if (!token) {

      return res.status(400).send('Missing token');

    }



    const safeToken = token

      .replace(/&/g, '&amp;')

      .replace(/</g, '&lt;')

      .replace(/>/g, '&gt;')

      .replace(/"/g, '&quot;')

      .replace(/'/g, '&#39;');



    const safeAction = parsed.toString()

      .replace(/&/g, '&amp;')

      .replace(/</g, '&lt;')

      .replace(/>/g, '&gt;')

      .replace(/"/g, '&quot;')

      .replace(/'/g, '&#39;');



    return res.status(200).send(`<!doctype html>

<html>

  <head>

    <meta charset="utf-8">

    <title>Redirecting…</title>

    <style>

      body { background: #0F1720; color: #E2E8F0; font-family: 'Inter', system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }

      .bridge { text-align: center; max-width: 360px; padding: 24px; border-radius: 12px; border: 1px solid #1F2937; background: #111827; }

      .spinner { margin: 1rem auto 0; width: 48px; height: 48px; border-radius: 50%; border: 4px solid transparent; border-top-color: #38BDF8; animation: spin 1s linear infinite; }

      .bridge h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }

      .bridge p { margin-bottom: 0.5rem; font-size: 0.95rem; color: #94A3B8; }

      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

      .bridge small { opacity: 0.6; }

    </style>

  </head>

  <body>

    <form id="anet" method="POST" action="${safeAction}">

      <input type="hidden" name="token" value="${safeToken}" />

    </form>

    <div class="bridge">

      <h1>Preparing Secure Payment</h1>

      <p>Authorize.net is verifying your transaction. This can take up to 90 seconds. Please stay on this page until the redirect completes.</p>

      <div class="spinner"></div>

      <small>Do not refresh or close your browser.</small>

    </div>

    <script src="/api/payment/hosted-redirect-script.js"></script>

    <noscript>

      <p>JavaScript is required. Click continue.</p>

      <button form="anet" type="submit">Continue</button>

    </noscript>

  </body>

</html>`);

  } catch (error) {

    console.error('Hosted redirect bridge error:', error);

    return res.status(500).send('Bridge failed');

  }

};



const authorizeRelayResponse = async (req, res) => {

  try {

    const payload = req.method === 'POST' ? (req.body || {}) : (req.query || {});



    const responseCode = String(payload.x_response_code || payload.response_code || '').trim();

    const transactionId = String(payload.x_trans_id || payload.transId || '').trim();

    const invoiceNumber = String(payload.x_invoice_num || payload.invoiceNumber || '').trim();

    const amountRaw = String(payload.x_amount || payload.amount || '').trim();



    if (process.env.DEBUG_AUTHORIZE_NET === 'true') {

      console.log('Authorize relay payload', {

        method: req.method,

        responseCode,

        transactionId,

        invoiceNumber,

        amountRaw,

        keys: Object.keys(payload || {})

      });

    }



    logAuthorizeRelay({

      method: req.method,

      responseCode,

      transactionId,

      invoiceNumber,

      amountRaw,

      keys: Object.keys(payload || {})

    });



    const forwardedProto = req.headers['x-forwarded-proto'];

    const forwardedHost = req.headers['x-forwarded-host'];

    const directHost = req.headers.host;



    const inferredBaseUrl = (forwardedHost || directHost)

      ? `${forwardedProto || 'https'}://${forwardedHost || directHost}`

      : null;



    const appBaseUrl = (inferredBaseUrl || process.env.FRONTEND_URL || 'https://ahoyvpn.net')

      .replace(/\/api\/?$/, '')

      .replace(/\/$/, '');



    if (!invoiceNumber) {

      return res.redirect(`${appBaseUrl}/checkout?payment=cancel&reason=missing_invoice`);

    }



    let subResult = await db.query(

      `SELECT s.id, s.user_id, s.referral_code, s.status, s.metadata, s.plan_id,

              p.amount_cents, p.interval as plan_interval, s.account_number,

              s.current_period_start, s.current_period_end

       FROM subscriptions s

       JOIN plans p ON p.id = s.plan_id

       WHERE s.metadata->>'invoice_number' = $1

       ORDER BY s.created_at DESC

       LIMIT 1`,

      [invoiceNumber]

    );



    if (subResult.rows.length === 0) {

      const accountMatch = invoiceNumber.match(/A?(\d{8})/);

      if (accountMatch) {

        const accountNumber = accountMatch[1];

        const fallback = await db.query(

          `SELECT s.id, s.user_id, s.referral_code, s.status, s.metadata, s.plan_id,

                  p.amount_cents, p.interval as plan_interval, s.account_number,

                  s.current_period_start, s.current_period_end

           FROM subscriptions s

           JOIN plans p ON p.id = s.plan_id

           WHERE s.account_number = $1 AND s.status = 'trialing'

           ORDER BY s.created_at DESC

           LIMIT 1`,

          [accountNumber]

        );



        if (fallback.rows.length > 0) {

          subResult = fallback;

          await db.query(

            `UPDATE subscriptions

             SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,

                 updated_at = NOW()

             WHERE id = $2`,

            [JSON.stringify({ invoice_number: invoiceNumber }), fallback.rows[0].id]

          );

        }

      }

    }



    if (subResult.rows.length === 0) {

      return res.redirect(`${appBaseUrl}/checkout?payment=cancel&reason=subscription_not_found`);

    }



    const subscription = subResult.rows[0];



    if (responseCode !== '1') {

      const failedMetaPatch = {

        authorize_status: 'failed',

        authorize_trans_id: transactionId || null,

        authorize_response_code: responseCode || null

      };



      await db.query(

        `UPDATE subscriptions

         SET updated_at = NOW(),

             metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb

         WHERE id = $2`,

        [JSON.stringify(failedMetaPatch), subscription.id]

      );



      return res.redirect(`${appBaseUrl}/checkout?payment=cancel`);

    }



    // Idempotency guard: if already active, return success quickly

    if (subscription.status === 'active') {

      return res.redirect(`${appBaseUrl}/checkout?payment=success&invoice=${encodeURIComponent(invoiceNumber)}`);

    }



    await db.query('BEGIN');



    const successMetaPatch = {

      authorize_status: 'succeeded',

      authorize_trans_id: transactionId || null,

      authorize_response_code: responseCode || null

    };



    await db.query(

      `UPDATE subscriptions

       SET status = 'active',

           updated_at = NOW(),

           metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb

       WHERE id = $2`,

      [JSON.stringify(successMetaPatch), subscription.id]

    );



    await createVpnAccount(subscription.user_id, subscription.account_number, subscription.plan_interval);



    await db.query(

      'UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1',

      [subscription.user_id]

    );



    const parsedAmountCents = Math.round((parseFloat(amountRaw || '0') || 0) * 100);

    const amountCents = parsedAmountCents > 0 ? parsedAmountCents : parseInt(subscription.amount_cents, 10);



    // ─── ARB Setup for month/quarter plans ───────────────────────────────────

    // After the hosted payment page charges the first month, we create an

    // ARB subscription so Authorize.net handles all future charges automatically.

    // We use the stored payment profile that Authorize.net created automatically

    // when the hosted page processed the payment.

    const arbIntervals = new Set(['month', 'quarter']);

    if (arbIntervals.has(String(subscription.plan_interval || '').toLowerCase())) {

      try {

        // Get stored customerProfileId + customerPaymentProfileId from the transaction

        const txDetails = await getAuthorizeTransactionDetails(transactionId);



        if (txDetails?.customerProfileId && txDetails?.customerPaymentProfileId) {

          // Calculate next billing date (ARB startDate = next cycle, not today)

          const periodEnd = new Date(subscription.current_period_end);

          const arbStartDate = new Date(periodEnd);

          arbStartDate.setDate(arbStartDate.getDate() + 1); // start next day

          const arbStartStr = arbStartDate.toISOString().split('T')[0]; // YYYY-MM-DD



          // interval mapping

          const intervalLength = subscription.plan_interval === 'quarter' ? 3 : 1;

          const intervalUnit = 'months';



          // Get user email for the ARB subscription

          const userResult = await db.query(

            'SELECT email, full_name FROM users WHERE id = $1',

            [subscription.user_id]

          );

          const userEmail = userResult.rows[0]?.email || '';



          // Amount = plan base amount (tax already included in first charge)

          const arbAmount = (parseInt(subscription.amount_cents, 10) / 100).toFixed(2);



          const arbResult = await authorizeNetService.createArbSubscriptionFromProfile({

            amount: arbAmount,

            intervalLength,

            intervalUnit,

            startDate: arbStartStr,

            customerProfileId: txDetails.customerProfileId,

            customerPaymentProfileId: txDetails.customerPaymentProfileId,

            subscriberEmail: userEmail,

            description: `AhoyVPN ${subscription.plan_interval === 'quarter' ? 'Quarterly' : 'Monthly'} Plan`,

            invoiceNumber: invoiceNumber

          });



          // Store ARB subscription ID in subscription metadata

          const arbMetaPatch = {

            arb_subscription_id: arbResult.subscriptionId,

            arb_status: 'active',

            arb_start_date: arbStartStr,

            arb_interval_length: intervalLength,

            arb_interval_unit: intervalUnit,

            arb_amount: arbAmount

          };



          await db.query(

            `UPDATE subscriptions

             SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,

                 updated_at = NOW()

             WHERE id = $2`,

            [JSON.stringify(arbMetaPatch), subscription.id]

          );



          console.log(`ARB subscription ${arbResult.subscriptionId} created for subscription ${subscription.id}, starts ${arbStartStr}`);

        } else {

          console.warn(`No stored payment profile found for transId ${transactionId} — cannot create ARB subscription for subscription ${subscription.id}`);

        }

      } catch (arbError) {

        // Non-fatal: payment already succeeded, log but don't disrupt the flow.

        // The subscription is active; ARB can be retried or set up manually.

        console.error('ARB setup failed (non-fatal — payment succeeded):', arbError.message || arbError);

      }

    }

    // ─── End ARB Setup ───────────────────────────────────────────────────────



    await applyAffiliateCommissionIfEligible({

      affiliateCode: subscription.referral_code,

      accountNumber: subscription.account_number,

      plan: subscription.plan_id,

      amountCents

    });



    // Create payment record for Authorize.net

    await db.query(

      `INSERT INTO payments (

         id, user_id, subscription_id, amount_cents, currency,

         status, payment_method, payment_intent_id, invoice_url,

         created_at, referral_code, account_number

       ) VALUES (

         $1, $2, $3, $4, 'USD',

         'succeeded', 'authorize', $5, $6,

         NOW(), $7, $8

       )`,

      [

        uuidv4(),

        subscription.user_id,

        subscription.id,

        amountCents,

        transactionId || invoiceNumber,

        null,

        subscription.referral_code || null,

        subscription.account_number

      ]

    );



    await db.query('COMMIT');



    return res.redirect(`${appBaseUrl}/checkout?payment=success&invoice=${encodeURIComponent(invoiceNumber)}`);

  } catch (error) {

    try { await db.query('ROLLBACK'); } catch (_) {}

    console.error('Authorize relay processing error:', error);



    const forwardedProto = req.headers['x-forwarded-proto'];

    const forwardedHost = req.headers['x-forwarded-host'];

    const directHost = req.headers.host;

    const inferredBaseUrl = (forwardedHost || directHost)

      ? `${forwardedProto || 'https'}://${forwardedHost || directHost}`

      : null;

    const appBaseUrl = (inferredBaseUrl || process.env.FRONTEND_URL || 'https://ahoyvpn.net')

      .replace(/\/api\/?$/, '')

      .replace(/\/$/, '');



    return res.redirect(`${appBaseUrl}/checkout?payment=cancel&reason=processing_error`);

  }

};



module.exports = {

  getPlans,

  createCheckout,

  hostedRedirectScript,

  hostedRedirectBridge,

  authorizeRelayResponse,

  plisioWebhook,

  getInvoiceStatus,

  deleteOldAccounts,

  vpnResellersService,

  authorizeNetService,

  applyAffiliateCommissionIfEligible

};
