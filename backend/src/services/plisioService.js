const axios = require('axios');

class PlisioService {
  constructor() {
    this.apiKey = process.env.PLISIO_API_KEY;
    this.baseUrl = 'https://api.plisio.net/api/v1';
  }

  // Create a new invoice in Plisio.
  // Plisio uses GET /invoices/new with all params as query string.
  // Amount is in source currency (USD), Plisio converts to crypto.
  async createInvoice(amount, currency, orderName, orderNumber, callbackUrl, successUrl, cancelUrl, email) {
    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        order_name: orderName,
        order_number: orderNumber,
        source_amount: String(parseFloat(amount).toFixed(8)),
        source_currency: 'USD',
        callback_url: callbackUrl,
        success_callback_url: successUrl,
        cancel_url: cancelUrl,
        email: email || '',
        plugin: 'AhoyVPN',
        version: '1.0.0'
      });

      const url = `${this.baseUrl}/invoices/new?${params.toString()}`;
      const response = await axios.get(url);

      console.log('Plisio createInvoice raw response:', JSON.stringify(response.data, null, 2));

      if (response.data.status === 'success') {
        const data = response.data.data || {};
        return {
          success: true,
          invoiceId: data.txn_id || null,
          invoiceUrl: data.invoice_url || null,
          qrCode: data.qr_code || null,
          walletAddress: data.wallet_address || null,
          amountDue: data.invoice_total_sum ? Number(data.invoice_total_sum) : null,
          currency,
          expiresAt: data.expire_at || null
        };
      } else {
        throw new Error(response.data.message || 'Plisio invoice creation failed');
      }
    } catch (error) {
      console.error('Plisio invoice creation error:', error.response?.data || error.message);
      throw new Error('Failed to create crypto invoice');
    }
  }

  async getInvoiceStatus(invoiceId) {
    try {
      const response = await axios.get(`${this.baseUrl}/invoices/${invoiceId}`, {
        params: { api_key: this.apiKey }
      });

      if (response.data.status === 'success') {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to get invoice status');
      }
    } catch (error) {
      console.error('Plisio invoice status error:', error.response?.data || error.message);
      throw new Error('Failed to fetch invoice status');
    }
  }

  // Verify Plisio callback using verify_hash or HMAC-SHA256
  // Plisio may send verify_hash (sha1 of sorted params) or use X-Plisio-Signature header
  verifyCallback(queryParams) {
    if (queryParams.verify_hash) {
      // Method 1: verify_hash (sha1 of sorted params + secret key)
      const crypto = require('crypto');
      const { verify_hash, ...rest } = queryParams;
      const sorted = Object.keys(rest)
        .sort()
        .map(key => `${key}=${rest[key]}`)
        .join('&');
      const hash = crypto.createHmac('sha1', this.apiKey).update(sorted).digest('hex');
      return hash === verify_hash;
    }
    return false;
  }
}

module.exports = new PlisioService();
