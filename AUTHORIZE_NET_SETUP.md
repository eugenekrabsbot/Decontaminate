# Authorize.net Setup — Complete Documentation
**AhoyVPN** | Last updated: 2026-04-17

---

## What This Document Is

This is the authoritative record of the Authorize.net Accept Hosted integration. If anything breaks, gets wiped, or needs to be rebuilt — this document has everything needed to restore it exactly as it is right now.

---

## Architecture Overview

The Authorize.net integration uses **Accept Hosted** — an embedded iframe payment form. The flow:

```
Customer selects Card → Backend creates token → Customer enters card in iframe
→ api.ashx POSTs to Relay URL → /payment/success redirects → subscription activated
                 ↓
          Webhook fires → Backend activates subscription (server-to-server, backup)
```

**Two separate endpoints are involved:**
1. **Relay URL** — what the customer's browser hits after payment (redirect UX)
2. **Webhook** — what Authorize.net's servers hit directly (server-to-server, critical)

Both must work. The relay URL handles the UX. The webhook handles the actual activation and is the most critical piece.

---

## Endpoints

### Relay URL
```
https://ahoyvpn.net/relay.html
```
**What it does:** Returns an HTML page with an auto-submit form that redirects the customer to `/payment/success`. The form passes through the payment result so the frontend can show success/failure.

**NOTE:** This URL must return HTTP 200 on both GET and POST. Originally it was a static HTML file at `/var/www/ahoyvpn.net/html/relay.html`, but nginx returns 405 on POST requests to static files. The fix proxies this URL to the backend.

**What it does NOT do:** Activate subscriptions. That's the webhook's job.

### Webhook URL
```
https://webhook.ahoyvpn.net/api/payment/webhook/authorize
```
**What it does:** Authorize.net's servers POST payment confirmation directly to this URL. The backend verifies the signature and activates the subscription. This fires regardless of whether the relay URL works.

**This is the critical endpoint.** If this fires, the customer gets activated even if the relay redirect fails.

### Accept Hosted Form URL
```
https://accept.authorize.net/payment/payment
```
The iframe form where the customer enters their card details. The tokenized version is served via the hosted redirect endpoint.

### Backend: Hosted Redirect (creates the Accept Hosted token)
```
GET  https://webhook.ahoyvpn.net/api/payment/hosted-redirect?token=<token>
GET  https://webhook.ahoyvpn.net/api/payment/hosted-redirect-script.js
```

### Backend: Authorize Relay (return URL from Accept Hosted)
```
GET  https://webhook.ahoyvpn.net/api/payment/authorize/relay
POST https://webhook.ahoyvpn.net/api/payment/authorize/relay
```
Where Accept Hosted redirects after payment. This parses the response and shows the customer a result page.

---

## Authorize.net Merchant Portal Settings

### Relay URL
**Path:** Account → Settings → Accept Hosted → Relay URL  
**Value:** `https://ahoyvpn.net/relay.html`

This MUST be set exactly to `https://ahoyvpn.net/relay.html`. The old value was `https://webhook.ahoyvpn.net/relay.html` — that did NOT work because the webhook subdomain serves no static files.

### Webhook URL (for reference)
The webhook URL is set in the Authorize.net API response when creating the Accept Hosted token — it points to `https://webhook.ahoyvpn.net/api/payment/webhook/authorize`. This is configured in the backend code, not in the merchant portal.

---

## Backend Code

### File: `backend/src/controllers/paymentController.js`

Add this function (around line 2426, before `authorizeRelayResponse`):

```javascript
// Serve HTML relay page for Authorize.net Accept Hosted relay URL
// api.ashx POSTs here after payment; this page auto-redirects customer to /payment/success
const relayHtmlPage = (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(`<!DOCTYPE html>
<html>
<head><title>Processing...</title></head>
<body onload="document.redirect.submit()">
<form name="redirect" action="https://ahoyvpn.net/payment/success" method="GET">
<input type="hidden" name="payment" value="success">
</form>
<p>Processing your payment... please wait.</p>
</body>
</html>`);
};
```

Export it (around line 2990, in `module.exports`):
```javascript
  authorizeRelayResponse,
  relayHtmlPage,
  plisioWebhook,
```

### File: `backend/src/routes/paymentRoutes.js`

Add these routes (after the existing `/authorize/relay` routes, around line 23):

```javascript
// Authorize.net relay HTML page (for Accept Hosted relay URL)
router.get('/relay-html', paymentController.relayHtmlPage);
router.post('/relay-html', paymentController.relayHtmlPage);
```

### File: `backend/src/config/paymentConfig.js`

Ensure Authorize.net config is present:
```javascript
authorizeNet: {
  apiLoginId: process.env.AUTHORIZE_NET_API_LOGIN_ID,
  transactionKey: process.env.AUTHORIZE_NET_TRANSACTION_KEY,
  endpoints: {
    charge: 'https://api.authorize.net/xml/v1/request.api'
  }
}
```

### Environment Variables (`.env` on server at `/home/ahoy/BackEnd/.env`)
```
AUTHORIZE_NET_API_LOGIN_ID=your_api_login_id
AUTHORIZE_NET_TRANSACTION_KEY=your_transaction_key
```

---

## Nginx Configuration

### File: `/etc/nginx/sites-available/ahoyvpn.net`

**Critical section — the relay.html location block.** This MUST be present and MUST proxy to the backend:

```nginx
    # relay.html: proxy to backend so POST works
    location = /relay.html {
        proxy_pass http://127.0.0.1:3000/api/payment/relay-html;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

**Critical — CSP must allow Accept Hosted iframe.** The main CSP header must include:
```
frame-ancestors 'self' https://accept.authorize.net https://test.authorize.net
```
NOT `'none'` — that blocks the iframe.

**Critical — X-Frame-Options.** Must allow Accept Hosted:
```
X-Frame-Options: ALLOW-FROM https://accept.authorize.net
```
(Not `SAMEORIGIN` — that blocks the iframe.)

**Important — form-action CSP** must allow Accept Hosted form submissions:
```
form-action 'self' https://accept.authorize.net https://test.authorize.net
```

### Full Working nginx config for ahoyvpn.net

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name ahoyvpn.net www.ahoyvpn.net;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ahoyvpn.net www.ahoyvpn.net;

    root /var/www/ahoyvpn.net/html;
    index index.html;

    ssl_certificate /etc/letsencrypt/live/ahoyvpn.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ahoyvpn.net/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/ahoyvpn.net/chain.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://checkout.plisio.net https://checkout.paymentscloud.com; frame-ancestors 'self' https://accept.authorize.net https://test.authorize.net; base-uri 'self'; form-action 'self' https://accept.authorize.net https://test.authorize.net;" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Affiliate cookie route
    location ~ ^/affiliate/([A-Za-z0-9_-]+)$ {
        proxy_pass http://localhost:3000/api/ref/$1$is_args$args;
        proxy_cookie_path /api/ref/ /;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect http://localhost:3000/ /;
    }

    # Extensionless static page routes
    location ~ ^/([A-Za-z0-9_-]+)$ {
        try_files /$1.html =404;
    }

    location ~ \.html$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # relay.html: proxy to backend so POST works
    location = /relay.html {
        proxy_pass http://127.0.0.1:3000/api/payment/relay-html;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ $uri.html =404;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

### File: `/etc/nginx/sites-available/webhook.conf`

This serves `webhook.ahoyvpn.net` — all requests proxy to the backend on port 3000. No static files here.

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name webhook.ahoyvpn.net;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name webhook.ahoyvpn.net;

    ssl_certificate /etc/letsencrypt/live/webhook.ahoyvpn.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/webhook.ahoyvpn.net/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/webhook.ahoyvpn.net/chain.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## DNS / Subdomains

| Subdomain | Points to | Purpose |
|-----------|-----------|---------|
| `ahoyvpn.net` | 89.167.46.117 | Main site + relay URL |
| `webhook.ahoyvpn.net` | 89.167.46.117 | Webhook endpoint + backend API |
| `www.ahoyvpn.net` | 89.167.46.117 | WWW alias |

Both `ahoyvpn.net` and `webhook.ahoyvpn.net` have SSL certificates from Let's Encrypt.

---

## The Original Problem (and Why It Was Broken)

The relay URL was originally set to `https://webhook.ahoyvpn.net/relay.html`. But `webhook.ahoyvpn.net` is a separate nginx vhost that proxies ALL requests to the backend on port 3000 — it has no static file serving. The file `relay.html` was at `/var/www/ahoyvpn.net/html/relay.html` on the `ahoyvpn.net` document root. So Authorize.net's servers got a 404 when trying to load `webhook.ahoyvpn.net/relay.html`.

Then, when the URL was changed to `https://ahoyvpn.net/relay.html`, it was a static file. But nginx returns 405 "Not Allowed" on POST requests to static files — because nginx's `try_files $uri` handler only handles GET/HEAD, not POST. And Authorize.net's `api.ashx` POSTs the relay response.

Additionally, even with GET working, `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'none'` in the CSP blocked Authorize.net's iframe from rendering the page.

**The fix: proxy `relay.html` to the backend, which serves the HTML via Node.js on both GET and POST, with proper CSP headers that allow the iframe.**

---

## Testing

### 1. Verify relay URL responds to POST (most critical test)
```bash
curl -sI -X POST "https://ahoyvpn.net/relay.html" | head -5
# Should return: HTTP/2 200
# NOT: HTTP/2 405
```

### 2. Verify relay URL returns correct HTML
```bash
curl -s -X POST "https://ahoyvpn.net/relay.html" | grep -o "action=.*success"
# Should return: action="https://ahoyvpn.net/payment/success"
```

### 3. Verify webhook endpoint is reachable
```bash
curl -s "https://webhook.ahoyvpn.net/api/payment/webhook/authorize" -X POST -w "\nHTTP:%{http_code}"
# Should return: HTTP:401 (no auth — expected)
```

### 4. Full payment flow test
1. Go to ahoyvpn.net → select a plan → select "Card" payment method
2. Complete payment in Accept Hosted iframe
3. Verify customer is redirected to `/payment/success`
4. Check database: `vpn_username` and `vpn_password` should be populated in the `customers` table

### 5. Check PM2 logs for webhook firing
```bash
pm2 logs ahoyvpn-backend --lines 100 --nostream | grep -i "authorize\|webhook"
```

---

## If It Breaks

**Symptom: Payment stuck on "Processing..." after card entry**

1. Check if relay URL returns 200 on POST: `curl -sI -X POST "https://ahoyvpn.net/relay.html"`
   - If 405: nginx static file issue — the `location = /relay.html` proxy block is missing or wrong
   - If 404: file not found — check the nginx config has the proxy block

2. Check PM2 logs: `pm2 logs ahoyvpn-backend --lines 50`
   - If no webhook logs: Authorize.net isn't firing the webhook
   - Check the webhook is configured in the Accept Hosted token creation response

3. Check nginx reload was applied: `sudo nginx -t && sudo nginx -s reload`

4. If all else fails: the subscription activation depends on the webhook, which fires server-to-server. If the webhook fired, the customer was activated regardless of what the relay showed.

---

## Commit History

| Date | Commit | Change |
|------|--------|--------|
| 2026-04-17 | `7b29241` | fix: add relay-html endpoint for Authorize.net Accept Hosted relay URL |
| 2026-04-17 | mono-repo | nginx config + backend + routes updated |
| Pre-fix | `3f75358` | fix: deleteAffiliate - use correct table names |

Repo: `https://github.com/eugenekrabsbot/Decontaminate`
