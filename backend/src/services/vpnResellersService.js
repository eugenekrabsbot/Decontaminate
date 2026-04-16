const fetch = require('node-fetch');
const paymentConfig = require('../config/paymentConfig');

class VpnResellersService {
  constructor() {
    this.apiToken = paymentConfig.vpnResellers.apiToken;
    this.baseUrl = paymentConfig.vpnResellers.apiUrl;
    this.endpoints = paymentConfig.vpnResellers.endpoints;
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const method = options.method || (options.body ? 'POST' : 'GET');
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers
      },
      method,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      const err = new Error(`VPN Resellers API error: ${response.status}: ${text}`);
      err.status = response.status;
      err.body = text;
      throw err;
    }

    return response.json();
  }

  async checkUsername(username) {
    const path = `${this.endpoints.checkUsername}?username=${encodeURIComponent(username)}`;
    return this.request(path, { method: 'GET' });
  }

  async createAccount(payload) {
    return this.request(this.endpoints.createAccount, { method: 'POST', body: payload });
  }

  async enableAccount(accountId) {
    const path = this.endpoints.enableAccount.replace('{accountId}', encodeURIComponent(accountId));
    return this.request(path, { method: 'PUT' });
  }

  async disableAccount(accountId) {
    const path = this.endpoints.disableAccount.replace('{accountId}', encodeURIComponent(accountId));
    return this.request(path, { method: 'PUT' });
  }

  async changePassword(accountId, password) {
    const path = this.endpoints.changePassword.replace('{accountId}', encodeURIComponent(accountId));
    return this.request(path, { method: 'PUT', body: { password } });
  }

  async setExpiry(accountId, expireAt) {
    const path = this.endpoints.expireAccount.replace('{accountId}', encodeURIComponent(accountId));
    return this.request(path, { method: 'PUT', body: { expire_at: expireAt } });
  }

  async getAccount(accountId) {
    const path = this.endpoints.getAccount.replace('{accountId}', encodeURIComponent(accountId));
    return this.request(path, { method: 'GET' });
  }
}

module.exports = VpnResellersService;
