const db = require('../config/database');

class PromoService {
  /**
   * Validate a promo code and return discount details.
   * @param {string} code - Promo code (case-insensitive)
   * @param {string} planKey - Plan key (e.g., 'monthly', 'quarterly')
   * @param {number} basePriceCents - Base price in cents
   * @returns {Promise<object>} - { valid: boolean, discountCents: number, discountType: string, error?: string }
   */
  async validatePromoCode(code, planKey, basePriceCents) {
    try {
      const query = `
        SELECT id, code, discount_type, discount_value, max_uses, uses_count, expires_at, applies_to_plan_keys
        FROM promo_codes
        WHERE LOWER(code) = LOWER($1)
      `;
      const result = await db.query(query, [code]);
      
      if (result.rows.length === 0) {
        return { valid: false, error: 'Invalid promo code' };
      }
      
      const promo = result.rows[0];
      
      // Check expiration
      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        return { valid: false, error: 'Promo code expired' };
      }
      
      // Check usage limits
      if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
        return { valid: false, error: 'Promo code usage limit reached' };
      }
      
      // Check if applies to plan
      if (promo.applies_to_plan_keys && promo.applies_to_plan_keys.length > 0) {
        if (!promo.applies_to_plan_keys.includes(planKey)) {
          return { valid: false, error: 'Promo code not valid for this plan' };
        }
      }
      
      // Calculate discount
      let discountCents = 0;
      let discountType = promo.discount_type;
      
      switch (promo.discount_type) {
        case 'percent':
          discountCents = Math.round(basePriceCents * (promo.discount_value / 100));
          break;
        case 'fixed':
          discountCents = promo.discount_value; // stored as cents
          break;
        case 'free_trial':
          discountCents = basePriceCents; // 100% off
          discountType = 'percent'; // treat as 100% discount
          break;
        default:
          return { valid: false, error: 'Invalid discount type' };
      }
      
      // Ensure discount doesn't exceed price
      if (discountCents > basePriceCents) {
        discountCents = basePriceCents;
      }
      
      // Increment uses count (we'll commit after payment success)
      // We'll update later in markPromoCodeUsed()
      
      return {
        valid: true,
        promoId: promo.id,
        discountCents,
        discountType,
        originalCode: promo.code,
        description: `Promo code applied: ${discountCents / 100} off`
      };
      
    } catch (error) {
      console.error('Promo validation error:', error);
      return { valid: false, error: 'Internal error validating promo code' };
    }
  }
  
  /**
   * Mark a promo code as used (increment uses_count).
   * @param {string} promoId - UUID of promo code
   */
  async markPromoCodeUsed(promoId) {
    try {
      const query = `
        UPDATE promo_codes
        SET uses_count = uses_count + 1, updated_at = NOW()
        WHERE id = $1
        RETURNING uses_count
      `;
      await db.query(query, [promoId]);
    } catch (error) {
      console.error('Error marking promo code used:', error);
      // Non-fatal error
    }
  }
  
  /**
   * Apply discount to price and return breakdown.
   * @param {number} basePriceCents - Base price in cents
   * @param {string} promoCode - Optional promo code
   * @param {string} planKey - Plan key
   * @returns {Promise<object>} - { basePriceCents, discountCents, finalPriceCents, promoValid: boolean, promoError?: string }
   */
  async applyDiscount(basePriceCents, promoCode, planKey) {
    if (!promoCode || promoCode.trim() === '') {
      return {
        basePriceCents,
        discountCents: 0,
        finalPriceCents: basePriceCents,
        promoValid: true,
        promoApplied: false
      };
    }
    
    const validation = await this.validatePromoCode(promoCode, planKey, basePriceCents);
    if (!validation.valid) {
      return {
        basePriceCents,
        discountCents: 0,
        finalPriceCents: basePriceCents,
        promoValid: false,
        promoError: validation.error,
        promoApplied: false
      };
    }
    
    const finalPriceCents = basePriceCents - validation.discountCents;
    
    return {
      basePriceCents,
      discountCents: validation.discountCents,
      finalPriceCents,
      promoValid: true,
      promoApplied: true,
      promoId: validation.promoId,
      promoCode: validation.originalCode,
      discountType: validation.discountType
    };
  }
  
  /**
   * Create a new promo code (admin only).
   */
  async createPromoCode(data) {
    const { code, discount_type, discount_value, max_uses, expires_at, applies_to_plan_keys } = data;
    
    const query = `
      INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, expires_at, applies_to_plan_keys)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const result = await db.query(query, [
      code,
      discount_type,
      discount_value,
      max_uses,
      expires_at,
      applies_to_plan_keys
    ]);
    
    return result.rows[0];
  }
  
  /**
   * List all promo codes.
   */
  async listPromoCodes() {
    const query = `
      SELECT id, code, discount_type, discount_value, max_uses, uses_count, expires_at, applies_to_plan_keys, created_at
      FROM promo_codes
      ORDER BY created_at DESC
    `;
    const result = await db.query(query);
    return result.rows;
  }
}

module.exports = new PromoService();