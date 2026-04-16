const axios = require('axios');

/**
 * ZipTax v6.0 client
 *
 * Uses the official machine-readable OpenAPI spec at:
 *   https://raw.githubusercontent.com/ZipTax/ziptax-reference/main/openapi/openapi.json
 *
 * Endpoint:
 *   GET https://api.zip-tax.com/request/v60
 *
 * Auth:
 *   Prefer X-API-KEY header with ZIPTAX_API_KEY env var.
 *
 * We keep this intentionally small and only expose the one thing we need:
 * a combined SALES_TAX rate for a given destination.
 */
class ZipTaxService {
  constructor() {
    this.apiKey = process.env.ZIPTAX_API_KEY;
    this.baseUrl = 'https://api.zip-tax.com';
  }

  /**
   * Lookup combined SALES_TAX rate using address-level request.
   *
   * @param {Object} opts
   * @param {string} opts.countryCode - 'USA' or 'CAN'. We currently only call with 'USA'.
   * @param {string} opts.region - State / province code (e.g. 'PA').
   * @param {string} opts.postalCode - Postal / ZIP code.
   * @param {number} [opts.taxabilityCode] - Optional product taxability code.
   * @returns {Promise<{ rate: number, raw: any }>}
   */
  async lookupCombinedSalesTaxRate({ countryCode = 'USA', region, postalCode, taxabilityCode } = {}) {
    if (!this.apiKey) {
      throw new Error('ZipTax API key (ZIPTAX_API_KEY) is not configured');
    }

    const normalizedCountry = String(countryCode || '').trim().toUpperCase();
    const normalizedRegion = String(region || '').trim();
    const normalizedPostal = String(postalCode || '').trim();

    if (!normalizedRegion || !normalizedPostal) {
      throw new Error('Missing region or postalCode for ZipTax lookup');
    }

    // ZipTax expects countryCode values like 'USA' or 'CAN'. We treat US-only for now.
    const zipCountryCode = normalizedCountry === 'CAN' ? 'CAN' : 'USA';

    // Build a minimal address string. ZipTax supports partial address
    // such as "200 Spectrum Center Dr, Irvine, CA 92618", but for our
    // use case state + postal code is sufficient.
    const address = `${normalizedRegion} ${normalizedPostal}`.trim();

    const params = {
      address,
      countryCode: zipCountryCode,
      format: 'json',
      // We do not need extended address details in the response.
      addressDetailExtended: 'false'
    };

    if (taxabilityCode != null) {
      params.taxabilityCode = taxabilityCode;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/request/v60`, {
        params,
        headers: {
          'X-API-KEY': this.apiKey,
          Accept: 'application/json'
        },
        timeout: 8000
      });

      const data = response.data;
      if (!data || typeof data !== 'object') {
        throw new Error('Unexpected ZipTax response format');
      }

      const metadata = data.metadata || {};
      const respInfo = metadata.response || {};
      if (typeof respInfo.code !== 'number' || respInfo.code !== 100) {
        const code = respInfo.code;
        const name = respInfo.name;
        const message = respInfo.message;
        throw new Error(
          `ZipTax error (code=${code}, name=${name || 'unknown'}): ${message || 'Request failed'}`
        );
      }

      const summaries = Array.isArray(data.taxSummaries) ? data.taxSummaries : [];
      if (!summaries.length) {
        // No tax summaries normally means 0% tax, but we treat it explicitly as 0.
        return { rate: 0, raw: data };
      }

      // Prefer SALES_TAX; fall back to the first summary if not present.
      const salesSummary =
        summaries.find((s) => String(s.taxType).toUpperCase() === 'SALES_TAX') || summaries[0];

      const rate = typeof salesSummary.rate === 'number' ? salesSummary.rate : 0;

      // Defensive guard: ensure rate is finite and non-negative.
      const safeRate = Number.isFinite(rate) && rate >= 0 ? rate : 0;

      return { rate: safeRate, raw: data };
    } catch (error) {
      // Avoid leaking secrets; only log high-level details.
      console.error('ZipTax lookup error:', error.message || error);
      throw new Error('ZipTax lookup failed');
    }
  }
}

module.exports = new ZipTaxService();
