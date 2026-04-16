// Update payment configuration to use VPN Resellers and Authorize.net

const paymentConfig = {
  // VPN Resellers Configuration
  vpnResellers: {
    apiToken: process.env.VPN_RESELLERS_API_TOKEN,
    apiUrl: 'https://api.vpnresellers.com',
    planIds: {
      month: process.env.VPN_RESELLERS_PLAN_MONTHLY_ID,
      quarter: process.env.VPN_RESELLERS_PLAN_QUARTERLY_ID,
      semi_annual: process.env.VPN_RESELLERS_PLAN_SEMIANNUAL_ID,
      year: process.env.VPN_RESELLERS_PLAN_ANNUAL_ID
    },
    endpoints: {
      checkUsername: '/v3_2/accounts/check_username',
      createAccount: '/v3_2/accounts',
      enableAccount: '/v3_2/accounts/{accountId}/enable',
      disableAccount: '/v3_2/accounts/{accountId}/disable',
      changePassword: '/v3_2/accounts/{accountId}/change_password',
      expireAccount: '/v3_2/accounts/{accountId}/expire',
      getAccount: '/v3_2/accounts/{accountId}'
    }
  },

  // Authorize.net Configuration
  authorizeNet: {
    apiLoginId: process.env.AUTHORIZE_NET_API_LOGIN_ID,
    transactionKey: process.env.AUTHORIZE_NET_TRANSACTION_KEY,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
    endpoints: {
      charge: 'https://api.authorize.net/xml/v1/request.api'
    }
  },

  // Plisio Configuration (already exists)
  plisios: {
    apiKey: process.env.PLISIO_API_KEY,
    apiUrl: 'https://plisio.net/api/v1'
  }
};

module.exports = paymentConfig;
