const axios = require('axios');

class PureWLService {
  constructor() {
    this.baseUrl = process.env.PUREWL_BASE_URL || 'https://atomapi.com';
    this.secretKey = process.env.PUREWL_SECRET_KEY;
    this.resellerId = process.env.PUREWL_RESELLER_ID;
    this.accessToken = null;
    this.tokenExpiry = null;
    
    if (!this.secretKey) {
      throw new Error('PUREWL_SECRET_KEY is not defined in environment variables');
    }
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
    });
  }
  
  async getAccessToken() {
    // If we have a valid token, return it
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    
    try {
      const response = await this.client.post('/auth/v1/accessToken', {
        secretKey: this.secretKey,
        grantType: 'secret',
      });
      
      const { accessToken, expiry, resellerId, resellerUid } = response.data.body;
      this.accessToken = accessToken;
      this.tokenExpiry = Date.now() + (expiry * 1000);
      this.resellerId = resellerId;
      
      return accessToken;
    } catch (error) {
      console.error('Failed to get PureWL access token:', error.response?.data || error.message);
      throw new Error(`PureWL authentication failed: ${error.response?.data?.header?.message || error.message}`);
    }
  }
  
  async createVPNAccount(userId, period = 30, preferences = {}) {
    const accessToken = await this.getAccessToken();
    
    const payload = {
      uuid: userId,
      period,
      subscriptionType: 'paid',
    };
    
    try {
      const response = await this.client.post('/vam/v3/create', payload, {
        headers: {
          'X-AccessToken': accessToken,
        },
      });
      
      const { vpnUsername, vpnPassword, expiryDate } = response.data.body;
      return { vpnUsername, vpnPassword, expiryDate };
    } catch (error) {
      console.error('Failed to create PureWL VPN account:', error.response?.data || error.message);
      throw new Error(`PureWL account creation failed: ${error.response?.data?.header?.message || error.message}`);
    }
  }
  
  async generateVPNAccount(userId, period = 30, preferences = {}) {
    const accessToken = await this.getAccessToken();
    
    const payload = {
      uuid: userId,
      period,
      subscriptionType: 'paid',
    };
    
    try {
      const response = await this.client.post('/vam/v2/generate', payload, {
        headers: {
          'X-AccessToken': accessToken,
        },
      });
      
      const { vpnUsername, vpnPassword, expiryDate } = response.data.body;
      return { vpnUsername, vpnPassword, expiryDate };
    } catch (error) {
      console.error('Failed to generate PureWL VPN account:', error.response?.data || error.message);
      throw new Error(`PureWL account generation failed: ${error.response?.data?.header?.message || error.message}`);
    }
  }
  
  async extendVPNAccount(vpnUsername, extensionDate) {
    const accessToken = await this.getAccessToken();
    
    const payload = {
      vpnUsername,
      extensionDate, // DD-MM-YYYY
    };
    
    try {
      const response = await this.client.put('/vam/v2/extend', payload, {
        headers: {
          'X-AccessToken': accessToken,
        },
      });
      
      return response.data.body;
    } catch (error) {
      console.error('Failed to extend PureWL VPN account:', error.response?.data || error.message);
      throw new Error(`PureWL account extension failed: ${error.response?.data?.header?.message || error.message}`);
    }
  }
  
  async renewVPNAccount(vpnUsername, period, preferences = {}) {
    const accessToken = await this.getAccessToken();
    
    const payload = {
      vpnUsername,
      period,
    };
    
    try {
      const response = await this.client.put('/vam/v2/renew', payload, {
        headers: {
          'X-AccessToken': accessToken,
        },
      });
      
      return response.data.body;
    } catch (error) {
      console.error('Failed to renew PureWL VPN account:', error.response?.data || error.message);
      throw new Error(`PureWL account renewal failed: ${error.response?.data?.header?.message || error.message}`);
    }
  }
  
  async disableVPNAccount(vpnUsername) {
    const accessToken = await this.getAccessToken();
    
    const payload = { vpnUsername };
    
    try {
      const response = await this.client.put('/vam/v2/disable', payload, {
        headers: {
          'X-AccessToken': accessToken,
        },
      });
      
      return response.data.body;
    } catch (error) {
      console.error('Failed to disable PureWL VPN account:', error.response?.data || error.message);
      throw new Error(`PureWL account disable failed: ${error.response?.data?.header?.message || error.message}`);
    }
  }
  
  async enableVPNAccount(vpnUsername) {
    const accessToken = await this.getAccessToken();
    
    const payload = { vpnUsername };
    
    try {
      const response = await this.client.put('/vam/v2/enable', payload, {
        headers: {
          'X-AccessToken': accessToken,
        },
      });
      
      return response.data.body;
    } catch (error) {
      console.error('Failed to enable PureWL VPN account:', error.response?.data || error.message);
      throw new Error(`PureWL account enable failed: ${error.response?.data?.header?.message || error.message}`);
    }
  }
  
  async getVPNAccountStatus(vpnUsername) {
    const accessToken = await this.getAccessToken();
    
    try {
      const response = await this.client.get(`/vam/v2/status?X-AccessToken=${accessToken}&vpnUsername=${vpnUsername}`);
      return response.data.body;
    } catch (error) {
      console.error('Failed to get PureWL VPN account status:', error.response?.data || error.message);
      throw new Error(`PureWL account status check failed: ${error.response?.data?.header?.message || error.message}`);
    }
  }
  
  async getCountries(deviceType = 'windows') {
    const accessToken = await this.getAccessToken();
    
    try {
      const response = await this.client.get(`/inventory/v3/countries/${deviceType}`, {
        headers: {
          'X-AccessToken': accessToken,
        },
      });
      
      return response.data.body.countries;
    } catch (error) {
      console.error('Failed to get PureWL countries:', error.response?.data || error.message);
      throw new Error(`PureWL countries fetch failed: ${error.response?.data?.header?.message || error.message}`);
    }
  }
  
  async getOptimizedServer(countrySlug, protocolSlug, username, deviceType = 'windows') {
    const accessToken = await this.getAccessToken();
    
    const payload = {
      sCountrySlug: countrySlug,
      sProtocolSlug1: protocolSlug,
      sUsername: username,
      sDeviceType: deviceType,
      iResellerId: this.resellerId,
    };
    
    try {
      const response = await this.client.post('/speedtest/v4/serversWithoutPsk', payload, {
        headers: {
          'X-AccessToken': accessToken,
        },
      });
      
      return response.data.body.servers[0];
    } catch (error) {
      console.error('Failed to get PureWL optimized server:', error.response?.data || error.message);
      throw new Error(`PureWL server optimization failed: ${error.response?.data?.header?.message || error.message}`);
    }
  }
}

module.exports = new PureWLService();