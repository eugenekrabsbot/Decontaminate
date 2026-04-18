const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const argon2 = require('argon2');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const emailService = require('../services/emailService');
const promoService = require('../services/promoService');
const plisioService = require('../services/plisioService');
const { createVpnAccount } = require('../services/userService');
const { getAuthorizeTransactionDetails, AuthorizeNetService } = require('../services/authorizeNetUtils');
const { applyAffiliateCommissionIfEligible } = require('./paymentController');

// Webhook verification interface
const logAuthorizeEvent = (label, data) => {
  try {
    const dir = path.join(process.cwd(), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), label, ...data });
    fs.appendFileSync(path.join(dir, 'authorize-webhook.log'), line + '\n');
  } catch (error) {
    console.error('Authorize webhook logging error:', error);
  }
};

class WebhookVerifier {
  // Verify Plisio webhook signature
  // Plisio uses HMAC-SHA1 of sorted body params (excluding verify_hash) or verify_hash in body
  // Plisio may send callbacks as GET (query params) or POST (JSON body)
  static verifyPlisio(req) {
    const apiKey = process.env.PLISIO_API_KEY;
    if (!apiKey) {
      console.warn('PLISIO_API_KEY not configured');
      return false;
    }

    const source = req.method === 'GET' ? req.query : req.body;
    const signature = req.headers['x-plisio-signature'];

    // Method 1: X-Plisio-Signature header (HMAC-SHA1 of sorted params)
    if (signature) {
      const sortedParams = Object.keys(source)
        .filter(key => key !== 'verify_hash')
        .sort()
        .map(key => `${key}=${source[key]}`)
        .join('&');

      const expectedSignature = crypto
        .createHmac('sha1', apiKey)
        .update(sortedParams)
        .digest('hex');

      const providedBuf = Buffer.from(String(signature));
      const expectedBuf = Buffer.from(expectedSignature);
      if (providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf)) {
        return true;
      }
    }

    // Method 2: verify_hash in params (HMAC-SHA1)
    if (source.verify_hash) {
      const { verify_hash, ...rest } = source;
      const sortedParams = Object.keys(rest)
        .sort()
        .map(key => `${key}=${rest[key]}`)
        .join('&');
      const hash = crypto.createHmac('sha1', apiKey).update(sortedParams).digest('hex');
      return hash === verify_hash;
    }

    return false;
  }
  
  // Verify PaymentsCloud webhook signature
  static verifyPaymentsCloud(req) {
    const secret = process.env.PAYCLOUD_SECRET;
    if (!secret) {
      console.warn('PAYCLOUD_SECRET not configured');
      return false;
    }
    
    // PaymentsCloud sends signature in X-PaymentsCloud-Signature header
    const signature = req.headers['x-paymentscloud-signature'];
    if (!signature) {
      return false;
    }
    
    // Create expected signature
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const providedBuf = Buffer.from(String(signature));
    const expectedBuf = Buffer.from(expectedSignature);
    if (providedBuf.length !== expectedBuf.length) return false;

    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  }

  // Verify Authorize.net webhook signature
  static verifyAuthorizeNet(req) {
    const signatureKey = process.env.AUTHORIZE_SIGNATURE_KEY;
    if (!signatureKey) {
      console.warn('AUTHORIZE_SIGNATURE_KEY not configured');
      return false;
    }

    const header = req.headers['x-anet-signature'] || '';
    const provided = header.replace(/^sha512[:=]/i, '').trim();
    if (!provided) return false;

    const raw = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));

    // Support both formats seen in the wild:
    // 1) hex key bytes (Authorize docs style)
    // 2) plain ASCII string key (observed in some environments)
    const expectedHexKey = crypto
      .createHmac('sha512', Buffer.from(signatureKey, 'hex'))
      .update(raw)
      .digest('hex');

    const expectedAsciiKey = crypto
      .createHmac('sha512', signatureKey)
      .update(raw)
      .digest('hex');

    const providedBuf = Buffer.from(provided, 'hex');
    if (!providedBuf.length) return false;

    const expectedHexBuf = Buffer.from(expectedHexKey, 'hex');
    const expectedAsciiBuf = Buffer.from(expectedAsciiKey, 'hex');

    const hexMatch = providedBuf.length === expectedHexBuf.length && crypto.timingSafeEqual(providedBuf, expectedHexBuf);
    const asciiMatch = providedBuf.length === expectedAsciiBuf.length && crypto.timingSafeEqual(providedBuf, expectedAsciiBuf);

    return hexMatch || asciiMatch;
  }
  
  // Check for replay attacks
  static async isReplayAttack(webhookId, provider) {
    const result = await db.query(
      'SELECT id FROM webhook_verifications WHERE webhook_id = $1 AND provider = $2',
      [webhookId, provider]
    );
    return result.rows.length > 0;
  }
  
  // Record webhook processing
  static async recordWebhook(webhookId, provider, signature) {
    await db.query(
      `INSERT INTO webhook_verifications (provider, webhook_id, signature, processed_at, created_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (webhook_id) DO NOTHING`,
      [provider, webhookId, signature]
    );
  }
}

// Plisio webhook handler - Plisio sends GET or POST callbacks
const plisioWebhook = async (req, res) => {
  try {
    // Plisio may send as GET (query params) or POST (JSON body)
    const source = req.method === 'GET' ? req.query : req.body;
    console.log('Plisio webhook received:', source);
    
    // Verify webhook signature
    const isValid = WebhookVerifier.verifyPlisio(req);
    if (!isValid) {
      console.error('Invalid Plisio webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    const {
      status,
      order_number,
      invoice_id,
      tx_id,
      currency,
      amount,
      email,
      account_number
    } = source;

    // Basic payload validation
    const webhookId = invoice_id || order_number;
    if (!status || !webhookId) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    
    // Check for replay attack
    if (await WebhookVerifier.isReplayAttack(webhookId, 'plisio')) {
      console.log('Replay attack detected, ignoring webhook');
      return res.json({ received: true, status: 'ignored' });
    }
    
    // Record webhook
    await WebhookVerifier.recordWebhook(webhookId, 'plisio', req.headers['x-plisio-signature']);
    
    console.log(`Plisio webhook: status=${status}, order=${order_number}, invoice=${invoice_id}`);
    
    // Return 200 OK immediately
    res.json({ received: true, status });
    
    // Process payment asynchronously (don't await)
    if (status === 'completed') {
      // invoice_id is Plisio's txn_id; order_number is our merchant order ID
      // If invoice_id is missing, use order_number as fallback
      const effectiveInvoiceId = invoice_id || order_number;
      processPlisioPaymentAsync(effectiveInvoiceId, tx_id, amount, currency).catch(err => {
        console.error('Async Plisio payment processing error:', err);
      });
    }
  } catch (error) {
    console.error('Plisio webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Async payment processing for Plisio
async function processPlisioPaymentAsync(invoice_id, tx_id, amount, currency) {
  try {
    // Find subscription by invoice ID (handle Plisio switched invoices)
    const subQuery = `
      SELECT s.*, u.id as user_id, u.account_number, p.interval as plan_interval
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE s.plisio_invoice_id = $1
    `;

    let effectiveInvoiceId = invoice_id;
    let subResult = await db.query(subQuery, [effectiveInvoiceId]);

    // If not found directly, try resolving switch/duplicate invoice chains
    if (subResult.rows.length === 0) {
      try {
        const invoiceStatus = await plisioService.getInvoiceStatus(invoice_id);
        const invoiceData = invoiceStatus?.invoice || invoiceStatus || {};
        const linkedInvoiceIds = [
          invoiceStatus?.active_invoice_id,
          invoiceData?.switch_id,
          invoiceData?.paid_id
        ].filter(Boolean);

        for (const candidateId of linkedInvoiceIds) {
          const candidate = await db.query(subQuery, [candidateId]);
          if (candidate.rows.length > 0) {
            subResult = candidate;
            // Subscription was tied to an older switched invoice - migrate linkage
            await db.query(
              `UPDATE subscriptions
               SET plisio_invoice_id = $1, updated_at = NOW()
               WHERE id = $2`,
              [invoice_id, candidate.rows[0].id]
            );

            await db.query(
              `UPDATE payments
               SET payment_intent_id = $1,
                   invoice_url = COALESCE($2, invoice_url),
                   updated_at = NOW()
               WHERE user_id = $3 AND payment_intent_id = $4`,
              [invoice_id, `https://plisio.net/invoice/${invoice_id}`, candidate.rows[0].user_id, candidateId]
            );

            effectiveInvoiceId = invoice_id;
            break;
          }
        }

        // Fill missing webhook values from Plisio API response
        amount = amount || invoiceData?.amount || invoiceData?.invoice_total_sum || null;
        currency = currency || invoiceData?.currency || invoiceData?.psys_cid || null;
      } catch (error) {
        console.error(`Failed resolving switched invoice chain for ${invoice_id}:`, error.message || error);
      }
    }

    if (subResult.rows.length === 0) {
      console.error(`Subscription not found for invoice ${invoice_id}`);
      return;
    }

    const subscription = subResult.rows[0];
    const userId = subscription.user_id;
    const planInterval = subscription.plan_interval || subscription?.metadata?.plan_interval || 'month';
    
    // Mark promo code as used if applicable
    if (subscription.promo_code_id) {
      await promoService.markPromoCodeUsed(subscription.promo_code_id);
      console.log(`Promo code ${subscription.promo_code_id} marked as used`);
    }
    
    // Update subscription status to active
    const updateSubQuery = `
      UPDATE subscriptions 
      SET status = 'active', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    await db.query(updateSubQuery, [subscription.id]);

    // Record tax transaction (non-blocking — failure here does not affect payment)
    try {
      const meta = subscription.metadata || {};
      const baseCents  = parseInt(meta.plan_amount_cents, 10) || 0;
      const taxCents   = parseInt(meta.tax_amount_cents, 10) || 0;
      const totalCents = baseCents + taxCents;
      const postalCode = (meta.postal_code || '').trim();

      if (postalCode && baseCents > 0) {
        await db.query(
          `INSERT INTO tax_transactions (
             transaction_date, postal_code, country, state,
             base_charge_cents, tax_rate, tax_amount_cents, total_amount_cents,
             invoice_number, subscription_id, user_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            new Date(),
            postalCode,
            (meta.country || 'USA').trim(),
            (meta.state || '').trim(),
            baseCents,
            parseFloat(meta.tax_rate || 0),
            taxCents,
            totalCents,
            effectiveInvoiceId || null,
            subscription.id,
            userId
          ]
        );
      }
    } catch (taxErr) {
      console.error('Failed to record tax_transaction (Plisio):', taxErr.message);
    }

    // Create VPN account via VPN Resellers
    const vpnAccount = await createVpnAccount(userId, subscription.account_number, planInterval);
    
    // Send welcome email with VPN credentials (if email exists)
    const userResult = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
    const userEmail = userResult.rows[0]?.email;
    
    if (userEmail) {
      const expiryDate = new Date(subscription.current_period_end).toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      });
      await emailService.sendAccountCreatedEmail(userEmail, vpnAccount.username, vpnAccount.password, expiryDate);
    }
    
        // Compute amount in cents for payment and commission
    const amountCents = Math.round(parseFloat(amount) * 100);
    
    // Process referral commission if referral code exists
    if (subscription.referral_code) {
      console.log(`Referral code found: ${subscription.referral_code}`);
      const commissionCents = await applyAffiliateCommissionIfEligible({
        affiliateCode: subscription.referral_code,
        accountNumber: subscription.account_number,
        plan: subscription.plan_id,
        amountCents: amountCents
      });
      if (commissionCents) {
        console.log(`💰 Commission $${(commissionCents / 100).toFixed(2)} credited for referral`);
      }
    }
    
    // Create payment record
    const paymentQuery = `
      INSERT INTO payments (user_id, subscription_id, amount_cents, currency, status, payment_method, payment_intent_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `;
    await db.query(paymentQuery, [
      userId,
      subscription.id,
      amountCents,
      currency,
      'succeeded',
      'plisio',
      tx_id || effectiveInvoiceId
    ]);
    
    console.log(`✅ Payment processed for user ${userId}, subscription ${subscription.id}`);
  } catch (error) {
    console.error('Async Plisio payment processing error:', error);
  }
}

// PaymentsCloud webhook handler - returns 200 OK immediately, processes async
const paymentsCloudWebhook = async (req, res) => {
  try {
    console.log('PaymentsCloud webhook received:', req.body);
    
    // Verify webhook signature
    const isValid = WebhookVerifier.verifyPaymentsCloud(req);
    if (!isValid) {
      console.error('Invalid PaymentsCloud webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    const { event, data } = req.body;

    // Basic payload validation
    if (!event || !data || !data.id) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    
    // Check for replay attack
    const webhookId = data.id;
    if (await WebhookVerifier.isReplayAttack(webhookId, 'paymentscloud')) {
      console.log('Replay attack detected, ignoring webhook');
      return res.json({ received: true, status: 'ignored' });
    }
    
    // Record webhook
    await WebhookVerifier.recordWebhook(webhookId, 'paymentscloud', req.headers['x-paymentscloud-signature']);
    
    console.log(`PaymentsCloud webhook: event=${event}, payment_id=${data.id}`);
    
    // Return 200 OK immediately
    res.json({ received: true, status: event });
    
    // Process payment asynchronously (don't await)
    if (event === 'payment.succeeded') {
      processPaymentsCloudPaymentAsync(data).catch(err => {
        console.error('Async PaymentsCloud payment processing error:', err);
      });
    }
  } catch (error) {
    console.error('PaymentsCloud webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Async payment processing for PaymentsCloud
async function processPaymentsCloudPaymentAsync(data) {
  try {
    // Extract metadata
    const { account_number, plan_key } = data.metadata || {};
    
    if (!account_number || !plan_key) {
      console.error('Missing account_number or plan_key in webhook metadata');
      return;
    }
    
    // Find user by account number
    const userResult = await db.query(
      'SELECT id FROM users WHERE account_number = $1',
      [account_number]
    );
    
    if (userResult.rows.length === 0) {
      console.error(`User not found for account ${account_number}`);
      return;
    }
    
    const userId = userResult.rows[0].id;
    
    // Find subscription
    const subQuery = `
      SELECT s.*, u.account_number
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id = $1 AND s.status = 'trialing'
      ORDER BY s.created_at DESC
      LIMIT 1
    `;
    const subResult = await db.query(subQuery, [userId]);
    
    if (subResult.rows.length === 0) {
      console.error(`No trialing subscription found for user ${userId}`);
      return;
    }
    
    const subscription = subResult.rows[0];
    
    // Update subscription status to active
    const updateSubQuery = `
      UPDATE subscriptions 
      SET status = 'active', 
          provider = 'paymentscloud',
          provider_transaction_id = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    await db.query(updateSubQuery, [data.id, subscription.id]);
    
    // Create VPN account via PureWL
    const vpnAccount = await createVpnAccount(userId, account_number, plan_key);
    
    // Send welcome email with VPN credentials (if email exists)
    const userResult2 = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
    const userEmail = userResult2.rows[0]?.email;
    
    if (userEmail) {
      const expiryDate = new Date(subscription.current_period_end).toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      });
      await emailService.sendAccountCreatedEmail(userEmail, vpnAccount.username, vpnAccount.password, expiryDate);
    }
    
    // Create payment record
    const paymentQuery = `
      INSERT INTO payments (user_id, subscription_id, amount_cents, currency, status, payment_method, payment_intent_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `;
    const amountCents = Math.round(parseFloat(data.amount) * 100);
    await db.query(paymentQuery, [
      userId,
      subscription.id,
      amountCents,
      data.currency || 'usd',
      'succeeded',
      'paymentscloud',
      data.id
    ]);
    
    console.log(`✅ PaymentsCloud payment processed for user ${userId}, subscription ${subscription.id}`);
  } catch (error) {
    console.error('Async PaymentsCloud payment processing error:', error);
  }
}

// Authorize.net webhook handler
const authorizeNetWebhook = async (req, res) => {
  try {
    // Temporary debug logging — keep minimal to avoid leaking full payloads
    const sigHeader = req.headers['x-anet-signature'] || '';
    // Accept either "sha512=<hmac>" or "sha512:<hmac>"; fallback to raw header
    const provided = sigHeader.replace(/^sha512[:=]/i, '').trim();
    const raw = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));
    const signatureKey = process.env.AUTHORIZE_SIGNATURE_KEY || '';
    const expectedHex = crypto
      .createHmac('sha512', Buffer.from(signatureKey, 'hex'))
      .update(raw)
      .digest('hex');
    const expectedAscii = crypto
      .createHmac('sha512', signatureKey)
      .update(raw)
      .digest('hex');

    const payload = req.body?.payload || req.body || {};
    let responseCode = String(
      payload.responseCode ||
      payload.response_code ||
      payload?.response?.responseCode ||
      payload?.transactionResponse?.responseCode ||
      ''
    ).trim();
    const transactionId = String(payload.id || payload.transId || payload.transactionId || payload?.trans_id || '').trim();
    let invoiceNumber = String(
      payload.invoiceNumber ||
      payload.invoice_number ||
      payload?.order?.invoiceNumber ||
      payload?.order?.invoice_number ||
      ''
    ).trim();
    let amountRaw = payload.authAmount || payload.amount || payload.auth_amount || payload?.authAmount || null;

    const isValid = WebhookVerifier.verifyAuthorizeNet(req);

    if (isValid && transactionId && (!invoiceNumber || responseCode !== '1')) {
      const txDetails = await getAuthorizeTransactionDetails(transactionId);
      if (txDetails) {
        invoiceNumber = invoiceNumber || txDetails.invoiceNumber || '';
        responseCode = responseCode || txDetails.responseCode || '';
        amountRaw = amountRaw || txDetails.amountRaw || null;

        logAuthorizeEvent('webhook-transaction-lookup', {
          transactionId,
          invoiceNumber,
          responseCode,
          transactionStatus: txDetails.transactionStatus || null
        });
      }
    }

    // Log every inbound webhook attempt so we can diagnose signature/env mismatches.
    logAuthorizeEvent('webhook-received', {
      responseCode,
      transactionId,
      invoiceNumber,
      amountRaw,
      eventType: req.body?.eventType || req.body?.event_type || null,
      signaturePresent: Boolean(req.headers['x-anet-signature']),
      signatureValid: isValid
    });

    if (!isValid) {
      console.error('Authorize.net signature invalid or missing', JSON.stringify({
        hasHeader: Boolean(provided),
        providedPrefix: provided ? provided.slice(0, 16) : 'none',
        expectedHexPrefix: expectedHex ? expectedHex.slice(0, 16) : 'none',
        expectedAsciiPrefix: expectedAscii ? expectedAscii.slice(0, 16) : 'none',
        rawLength: raw.length,
        eventType: req.body?.eventType || req.body?.event_type || null,
        transactionId,
        invoiceNumber
      }));
      return res.status(400).json({ received: true, signatureValid: false });
    }

    logAuthorizeEvent('webhook', {
      responseCode,
      transactionId,
      invoiceNumber,
      amountRaw,
      eventType: req.body?.eventType || req.body?.event_type || null,
      signaturePresent: Boolean(req.headers['x-anet-signature']),
      signatureValid: true
    });

    if (process.env.DEBUG_AUTHORIZE_NET === 'true') {
      console.log('Authorize webhook payload', {
        eventType: req.body?.eventType || req.body?.event_type || null,
        responseCode,
        transactionId,
        invoiceNumber,
        amountRaw,
        keys: Object.keys(payload || {})
      });
    }

    if (!invoiceNumber) {
      console.error('Authorize.net webhook missing invoice number');
      return res.json({ received: true, signatureValid: true });
    }

    if (responseCode !== '1') {
      // Special handling for authcapture.created: responseCode may be empty
      // in the webhook payload even when payment was authorized.
      // Try to extract transaction ID from transactionResponse and look up details.
      const eventType = req.body?.eventType || req.body?.event_type || null;
      const webhookTransId = String(
        payload?.transactionResponse?.transId ||
        payload?.transactionResponse?.trans_id ||
        ''
      ).trim();

      if (webhookTransId && (!invoiceNumber || !responseCode)) {
        const txDetails = await getAuthorizeTransactionDetails(webhookTransId);
        if (txDetails && txDetails.responseCode === '1') {
          invoiceNumber = invoiceNumber || txDetails.invoiceNumber || '';
          responseCode = '1';
          amountRaw = amountRaw || txDetails.amountRaw || null;
        }
      }

      if (responseCode !== '1') {
        console.warn('Authorize.net webhook non-success response', { invoiceNumber, responseCode });
        return res.json({ received: true, signatureValid: true });
      }
    }

    let subResult = await db.query(
      `SELECT s.*, p.interval as plan_interval, p.amount_cents
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
          `SELECT s.*, p.interval as plan_interval, p.amount_cents
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
      console.error(`Authorize.net webhook: subscription not found for invoice ${invoiceNumber}`);
      return res.json({ received: true, signatureValid: true });
    }

    const subscription = subResult.rows[0];
    const planInterval = subscription.plan_interval || subscription?.metadata?.plan_interval || 'month';

    if (subscription.status === 'active') {
      return res.json({ received: true, signatureValid: true });
    }

    const amountCents = Math.round((parseFloat(amountRaw || '0') || 0) * 100) || subscription.amount_cents;

    await db.query('BEGIN');
    try {
      await db.query(
        `UPDATE subscriptions
         SET status = 'active',
             updated_at = NOW(),
             metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
         WHERE id = $2`,
        [JSON.stringify({ authorize_status: 'succeeded', authorize_trans_id: transactionId || null, authorize_response_code: responseCode || null }), subscription.id]
      );

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

      await db.query('UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1', [subscription.user_id]);

      await db.query('COMMIT');

      // Record tax transaction (non-blocking — failure here does not affect payment)
      try {
        const meta = subscription.metadata || {};
        const baseCents     = parseInt(meta.plan_amount_cents, 10) || 0;
        const taxCents      = parseInt(meta.tax_amount_cents, 10) || 0;
        const totalCents    = baseCents + taxCents;
        const postalCode    = (meta.postal_code || '').trim();

        if (postalCode && baseCents > 0) {
          await db.query(
            `INSERT INTO tax_transactions (
               transaction_date, postal_code, country, state,
               base_charge_cents, tax_rate, tax_amount_cents, total_amount_cents,
               invoice_number, subscription_id, user_id
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              new Date(),
              postalCode,
              (meta.country || 'USA').trim(),
              (meta.state || '').trim(),
              baseCents,
              parseFloat(meta.tax_rate || 0),
              taxCents,
              totalCents,
              invoiceNumber || null,
              subscription.id,
              subscription.user_id
            ]
          );
        }
      } catch (taxErr) {
        console.error('Failed to record tax_transaction:', taxErr.message);
      }
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

    
    // ARB creation -- runs after subscription activated + VPN provisioned
    {
      const subMeta = (subscription.metadata || {});
      if (!subscription.arb_subscription_id && !subMeta[Symbol.for('arb_subscription_id')] && transactionId) {
        try {
          const svc = new AuthorizeNetService();
          const tx = await getAuthorizeTransactionDetails(transactionId);
          const { customerProfileId, customerPaymentProfileId } = tx || {};
          if (customerProfileId && customerPaymentProfileId) {
            const planInterval = subMeta.plan_interval || 'month';
            let planAmountCents = parseInt(subMeta.plan_amount_cents, 10) || 0;
            if (!planAmountCents) {
              const pr = await db.query('SELECT p.amount_cents FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.id = $1', [subscription.id]);
              planAmountCents = pr.rows[0]?.amount_cents || 0;
            }
            const arbAmount = ((planAmountCents || 0) / 100).toFixed(2);
            const startDate = new Date().toISOString().split('T')[0];
            const intervalLength = planInterval === 'year' ? 1 : planInterval === 'quarter' ? 3 : 1;
            const arbResult = await svc.createArbSubscriptionFromProfile({
              amount: arbAmount, intervalLength, intervalUnit: 'months', startDate,
              customerProfileId, customerPaymentProfileId,
              subscriptionId: String(subscription.id), customerEmail: userEmail,
            });
            if (arbResult?.subscriptionId) {
              await db.query('UPDATE subscriptions SET arb_subscription_id = $1, updated_at = NOW() WHERE id = $2', [arbResult.subscriptionId, subscription.id]);
              console.log('[Webhook] ARB created:', arbResult.subscriptionId, '| sub:', subscription.id);
            } else {
              console.warn('[Webhook] ARB missing subscriptionId:', arbResult);
            }
          } else {
            console.warn('[Webhook] Missing customerProfileId or customerPaymentProfileId from tx', transactionId);
          }
        } catch (arbErr) {
          console.error('[Webhook] ARB creation failed:', arbErr.message);
        }
      }
    }

    // --- VPN account: extend existing or create new ---
    // On ARB renewal: existing VPN account gets extended by 30 days from current_period_end.
    // On first activation: creates new VPN account (createVpnAccount uses ON CONFLICT so it's safe).
    const existingVpn = await db.query(
      'SELECT id FROM vpn_accounts WHERE user_id = $1 LIMIT 1',
      [subscription.user_id]
    );

    let vpnAccount;
    if (existingVpn.rows.length > 0) {
      // Extend existing VPN account expiry by 30 days from current_period_end
      const newExpiry = new Date(subscription.current_period_end);
      newExpiry.setDate(newExpiry.getDate() + 30);
      const newExpiryYmd = newExpiry.toISOString().slice(0, 10);
      await db.query(
        'UPDATE vpn_accounts SET expiry_date = $1, updated_at = NOW() WHERE user_id = $2',
        [newExpiryYmd, subscription.user_id]
      );
      const refreshedVpn = await db.query('SELECT * FROM vpn_accounts WHERE user_id = $1', [subscription.user_id]);
      vpnAccount = refreshedVpn.rows[0] || { username: '(extended)', password: '(extended)', purewl_uuid: null };
    } else {
      vpnAccount = await createVpnAccount(subscription.user_id, subscription.account_number, planInterval);
    }

    const userResult = await db.query('SELECT email FROM users WHERE id = $1', [subscription.user_id]);
    const userEmail = userResult.rows[0]?.email;
    if (userEmail) {
      const expiryDate = new Date(subscription.current_period_end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      await emailService.sendAccountCreatedEmail(userEmail, vpnAccount.username, vpnAccount.password, expiryDate);
    }

    return res.json({ received: true, signatureValid: true });
  } catch (err) {
    console.error('Authorize.net webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  plisioWebhook,
  paymentsCloudWebhook,
  authorizeNetWebhook,
  processPlisioPaymentAsync
};
