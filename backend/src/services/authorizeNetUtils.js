// Shared Authorize.net utility functions
// Kept separate to avoid circular dependency between paymentController and webhookController

const AUTHORIZE_API_URL = 'https://api.authorize.net/xml/v1/request.api';

/**
 * Look up full transaction details from Authorize.net by transaction ID.
 * Returns the parsed transaction data or null on failure.
 */
async function getAuthorizeTransactionDetails(transactionId) {
  try {
    const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
    const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;

    if (!transactionId || !apiLoginId || !transactionKey) {
      return null;
    }

    const requestBody = {
      getTransactionDetailsRequest: {
        merchantAuthentication: {
          name: apiLoginId,
          transactionKey
        },
        transId: String(transactionId)
      }
    };

    const response = await fetch(AUTHORIZE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      return null;
    }

    const raw = await response.text();
    const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

    if (data?.messages?.resultCode !== 'Ok') {
      return null;
    }

    const tx = data?.transaction || {};
    const order = tx?.order || {};

    let responseCode = String(tx?.responseCode || tx?.transactionResponse?.responseCode || '').trim();
    const transactionStatus = String(tx?.transactionStatus || '').trim();

    if (!responseCode && ['capturedPendingSettlement', 'settledSuccessfully', 'authorizedPendingCapture'].includes(transactionStatus)) {
      responseCode = '1';
    }

    return {
      invoiceNumber: String(order?.invoiceNumber || order?.invoice_number || '').trim(),
      responseCode,
      amountRaw: tx?.authAmount || tx?.settleAmount || null,
      transactionStatus,
      customerProfileId: String(tx?.profile?.customerProfileId || '').trim() || null,
      customerPaymentProfileId: String(tx?.profile?.customerPaymentProfileId || '').trim() || null
    };
  } catch (error) {
    console.error('Authorize transaction details lookup failed:', error.message || error);
    return null;
  }
}

async function cancelArbSubscription(subscriptionId) {
  if (!subscriptionId) return { success: false, message: 'No ARB subscription ID provided' };

  const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
  const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;

  if (!apiLoginId || !transactionKey) {
    throw new Error('Authorize.net credentials are missing');
  }

  const requestBody = {
    ARBCancelSubscriptionRequest: {
      merchantAuthentication: {
        name: apiLoginId,
        transactionKey
      },
      subscriptionId: String(subscriptionId)
    }
  };

  try {
    const response = await fetch(AUTHORIZE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const raw = await response.text();
    const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

    if (data?.messages?.resultCode === 'Ok') {
      return { success: true, subscriptionId };
    }

    const msg = data?.messages?.message?.[0]?.text || 'ARB cancellation failed';
    return { success: false, message: msg };
  } catch (error) {
    console.error('ARB cancellation error:', error.message || error);
    throw error;
  }
}

class AuthorizeNetService {
  constructor() {
    this.apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
    this.transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;
  }

  async _makeRequest(requestBody) {
    if (!this.apiLoginId || !this.transactionKey) {
      throw new Error('Authorize.net credentials are not configured');
    }

    const response = await fetch(AUTHORIZE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...requestBody,
        merchantAuthentication: {
          name: this.apiLoginId,
          transactionKey: this.transactionKey
        }
      })
    });

    const raw = await response.text();
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  }

  async getArbSubscription(subscriptionId) {
    try {
      const data = await this._makeRequest({
        ARBGetSubscriptionRequest: {
          subscriptionId: String(subscriptionId)
        }
      });

      if (data?.messages?.resultCode !== 'Ok') {
        return null;
      }

      const sub = data?.subscription || {};
      return {
        id: subscriptionId,
        name: sub?.name || '',
        status: sub?.status || 'unknown',
        currentBillAmount: sub?.currentBillAmount || sub?.lastPaymentAmount || '0.00',
        lastPaymentAmount: sub?.lastPaymentAmount || '0.00',
        lastPaymentDate: sub?.lastPaymentDate || null,
        nextBillingDate: sub?.nextBillingDate || null,
        currentPeriodEnd: sub?.nextBillingDate || null,
        createdDate: sub?.createTimeStamp || null,
        firstRenewalDate: sub?.firstRenewalDate || null,
        lastPaymentId: null
      };
    } catch (error) {
      console.error('ARB subscription lookup error:', error.message || error);
      return null;
    }
  }

  async getTransactionDetails(transactionId) {
    try {
      const data = await this._makeRequest({
        getTransactionDetailsRequest: {
          transId: String(transactionId)
        }
      });

      if (data?.messages?.resultCode !== 'Ok') {
        return null;
      }

      const tx = data?.transaction || {};
      return {
        transactionId: String(transactionId),
        transactionStatus: tx?.transactionStatus || '',
        amount: tx?.authAmount || tx?.settleAmount || null,
        responseCode: tx?.responseCode || ''
      };
    } catch (error) {
      console.error('Transaction details lookup error:', error.message || error);
      return null;
    }
  }

  async cancelSubscription(subscriptionId) {
    return cancelArbSubscription(subscriptionId);
  }
}

module.exports = { getAuthorizeTransactionDetails, cancelArbSubscription, AuthorizeNetService };