#!/usr/bin/env python3
"""Fix checkout.jsx."""
with open('/home/krabs/.openclaw/workspace/ahoyvpn-frontend/pages/checkout.jsx', 'r') as f:
    content = f.read()

# Remove duplicate state variable
dup = "  // Subscription agreement\n  const [subscriptionAgreementChecked, setSubscriptionAgreementChecked] = useState(false);\n\n  // Subscription agreement\n  const [subscriptionAgreementChecked, setSubscriptionAgreementChecked] = useState(false);"
clean = "  // Subscription agreement\n  const [subscriptionAgreementChecked, setSubscriptionAgreementChecked] = useState(false);\n"
if dup in content:
    content = content.replace(dup, clean, 1)
    print("Duplicate removed")
else:
    print("Duplicate not found")

# Find and add checkbox - exact match from debug output
search = "                </div>\n              </>\n            )}\n\n            {statusMessage && <p style={styles.waitNotice}>"
replacement = ("                </div>\n"
               "\n"
               "                  <div style={{\n"
               "                    marginTop: '1.5rem',\n"
               "                    padding: '1rem',\n"
               "                    backgroundColor: '#1A1A2A',\n"
               "                    border: '1px solid #3A3A5A',\n"
               "                    borderRadius: '8px',\n"
               "                  }}>\n"
               "                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', color: '#B0C4DE', fontSize: '0.9rem', lineHeight: '1.5' }}>\n"
               '                      <input\n'
               '                        type="checkbox"\n'
               "                        checked={subscriptionAgreementChecked}\n"
               "                        onChange={(e) => setSubscriptionAgreementChecked(e.target.checked)}\n"
               "                        style={{ marginTop: '0.25rem', width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1E90FF', flexShrink: 0 }}\n"
               "                      />\n"
               "                      <span>\n"
               "                        I agree that I am signing up for a <strong>recurring subscription</strong>. I have read and agree to the{' '}\n"
               '                        <a href="/terms-of-service" target="_blank" rel="noreferrer" style={{ color: "#1E90FF" }}>Terms of Service</a>. I understand that if I\n'
               "                        am ever locked out of my account, I can email{' '}\n"
               '                        <a href="mailto:ahoyvpn@ahoyvpn.com" style={{ color: "#1E90FF" }}>ahoyvpn@ahoyvpn.com</a>{' '}\n'
               "                        with my account number to cancel my subscription.\n"
               "                      </span>\n"
               "                    </label>\n"
               "                  </div>\n"
               "              </>\n"
               "            )}\n\n"
               "            {statusMessage && <p style={styles.waitNotice}>")

if search in content:
    content = content.replace(search, replacement, 1)
    print("Checkbox added")
else:
    print("Checkbox location not found")

with open('/home/krabs/.openclaw/workspace/ahoyvpn-frontend/pages/checkout.jsx', 'w') as f:
    f.write(content)
print("Done. Final size:", len(content))
