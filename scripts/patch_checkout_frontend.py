#!/usr/bin/env python3
"""Patch checkout.jsx."""
with open('/home/krabs/.openclaw/workspace/ahoyvpn-frontend/pages/checkout.jsx', 'r') as f:
    content = f.read()

# PATCH 1: Add subscriptionAgreementChecked state
c = content.find("  // Loading\n  const [loading, setLoading] = useState(false);")
if c >= 0:
    content = content.replace(
        "  // Loading\n  const [loading, setLoading] = useState(false);",
        "  // Subscription agreement\n  const [subscriptionAgreementChecked, setSubscriptionAgreementChecked] = useState(false);\n\n  // Loading\n  const [loading, setLoading] = useState(false);",
        1
    )
    print("Patch 1 (state) applied")
else:
    print("WARNING: Patch 1 not found")

# PATCH 2: Replace invoice summary grid
old2 = ("                <div style={styles.invoiceSummaryGrid}>\n"
        "                  <div style={styles.invoiceDetail}>\n"
        "                    <span>Plan price</span>\n"
        "                    <strong>\n"
        "                      ${(pricing.baseAmountCents / 100).toFixed(2)} {pricing.currency || 'USD'}\n"
        "                    </strong>\n"
        "                  </div>\n"
        "                  <div style={styles.invoiceDetail}>\n"
        "                    <span>Sales tax</span>\n"
        "                    <strong>\n"
        "                      ${(pricing.taxAmountCents / 100).toFixed(2)} {pricing.currency || 'USD'}\n"
        "                    </strong>\n"
        "                  </div>\n"
        "                  <div style={styles.invoiceDetail}>\n"
        "                    <span>Total</span>\n"
        "                    <strong>\n"
        "                      ${(pricing.totalAmountCents / 100).toFixed(2)} {pricing.currency || 'USD'}\n"
        "                    </strong>\n"
        "                  </div>\n"
        "                </div>")
new2 = ("                <div style={styles.invoiceSummaryGrid}>\n"
        "                  <div style={styles.invoiceDetail}>\n"
        "                    <span>Plan price</span>\n"
        "                    <strong>\n"
        "                      ${(pricing.baseAmountCents / 100).toFixed(2)} {pricing.currency || 'USD'}\n"
        "                    </strong>\n"
        "                  </div>\n"
        "                  {pricing.discountCents > 0 && (\n"
        "                    <>\n"
        "                      <div style={{ ...styles.invoiceDetail, borderColor: '#27ae60', backgroundColor: '#1A2A1A' }}>\n"
        "                        <span>Affiliate Discount</span>\n"
        "                        <strong style={{ color: '#27ae60' }}>\n"
        "                          -${(pricing.discountCents / 100).toFixed(2)} {pricing.currency || 'USD'}\n"
        "                        </strong>\n"
        "                      </div>\n"
        "                      <div style={styles.invoiceDetail}>\n"
        "                        <span>Subtotal</span>\n"
        "                        <strong>\n"
        "                          ${((pricing.baseAmountCents - pricing.discountCents) / 100).toFixed(2)} {pricing.currency || 'USD'}\n"
        "                        </strong>\n"
        "                      </div>\n"
        "                    </>\n"
        "                  )}\n"
        "                  <div style={styles.invoiceDetail}>\n"
        "                    <span>Sales tax</span>\n"
        "                    <strong>\n"
        "                      ${(pricing.taxAmountCents / 100).toFixed(2)} {pricing.currency || 'USD'}\n"
        "                    </strong>\n"
        "                  </div>\n"
        "                  <div style={{ ...styles.invoiceDetail, borderColor: '#00CED1', backgroundColor: '#1A2A3A' }}>\n"
        "                    <span>Total</span>\n"
        "                    <strong style={{ color: '#00CED1' }}>\n"
        "                      ${(pricing.totalAmountCents / 100).toFixed(2)} {pricing.currency || 'USD'}\n"
        "                    </strong>\n"
        "                  </div>\n"
        "                </div>")
if old2 in content:
    content = content.replace(old2, new2, 1)
    print("Patch 2 (discount line) applied")
else:
    print("WARNING: Patch 2 not found")

# PATCH 3: Add checkbox before card checkout button
old3 = ("                  </div>\n              </>\n            )}\n\n            {statusMessage")
new3 = ("                  </div>\n\n                  <div style={{\n                    marginTop: '1.5rem',\n                    padding: '1rem',\n                    backgroundColor: '#1A1A2A',\n                    border: '1px solid #3A3A5A',\n                    borderRadius: '8px',\n                  }}>\n                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', color: '#B0C4DE', fontSize: '0.9rem', lineHeight: '1.5' }}>\n                      <input\n                        type=\"checkbox\"\n                        checked={subscriptionAgreementChecked}\n                        onChange={(e) => setSubscriptionAgreementChecked(e.target.checked)}\n                        style={{ marginTop: '0.25rem', width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1E90FF', flexShrink: 0 }}\n                      />\n                      <span>\n                        I agree that I am signing up for a <strong>recurring subscription</strong>. I have read and agree to the{' '}\n                        <a href=\"/terms-of-service\" target=\"_blank\" rel=\"noreferrer\" style={{ color: '#1E90FF' }}>Terms of Service</a>. I understand that if I\n                        am ever locked out of my account, I can email{' '}\n                        <a href=\"mailto:ahoyvpn@ahoyvpn.com\" style={{ color: '#1E90FF' }}>ahoyvpn@ahoyvpn.com</a>{' '}\n                        with my account number to cancel my subscription.\n                      </span>\n                    </label>\n                  </div>\n                </>\n              )}\n\n            {statusMessage")
if old3 in content:
    content = content.replace(old3, new3, 1)
    print("Patch 3 (checkbox) applied")
else:
    print("WARNING: Patch 3 not found")

# PATCH 4: Disable card button when checkbox not checked
old4 = ("                  disabled={loading}\n                  size=\"lg\"\n                >\n                  {loading ? 'Processing...' : `Continue to ${paymentData.provider}`}\n                </Button>")
new4 = ("                  disabled={loading || !subscriptionAgreementChecked}\n                  size=\"lg\"\n                >\n                  {!subscriptionAgreementChecked\n                    ? 'Please agree to the subscription terms above'\n                    : loading\n                      ? 'Processing...'\n                      : `Continue to ${paymentData.provider}`}\n                </Button>")
if old4 in content:
    content = content.replace(old4, new4, 1)
    print("Patch 4 (button disable) applied")
else:
    print("WARNING: Patch 4 not found")

with open('/home/krabs/.openclaw/workspace/ahoyvpn-frontend/pages/checkout.jsx', 'w') as f:
    f.write(content)
print(f"Done. Final size: {len(content)} bytes")
