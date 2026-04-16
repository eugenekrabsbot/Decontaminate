# Logs & Monitoring Setup

## Log Rotation (Systemd Journal)

**Configuration file:** `/etc/systemd/journald.conf.d/ahoyvpn-backend.conf`

```ini
# Limit journal size for AhoyVPN backend logs
[Journal]
SystemMaxUse=100M
SystemKeepFree=200M
SystemMaxFileSize=10M
MaxRetentionSec=4weeks
Compress=yes
MaxFileSec=1week
```

**Effect:**
- Total journal storage limited to **100 MB**.
- Journal files are compressed.
- Old entries are removed after **4 weeks**.
- Individual journal files rotate weekly.

**View logs:**
```bash
sudo journalctl -u ahoyvpn-backend.service -f
```

**Verify settings:**
```bash
sudo journalctl --disk-usage
```

---

## Health Monitoring

**Health endpoint:** `GET http://localhost:3000/health`  
Returns `{"status":"OK","timestamp":"..."}` (HTTP 200).

**Health check script:** `health‑check.js`  
- Runs every **5 minutes** via cron.
- Retries up to **2 times** (5‑second delay).
- Sends a Telegram alert via OpenClaw if the backend remains down after retries.
- Alerts are rate‑limited (once per 30 minutes).

**Cron job:**
```
*/5 * * * * PATH=/home/krabs/.npm-global/bin:/usr/bin:/bin cd /home/krabs/.openclaw/workspace/projects/ahoyvpn/backend && /usr/bin/node health-check.js 2>&1 | logger -t ahoyvpn-health
```

**View cron logs:**
```bash
grep ahoyvpn-health /var/log/syslog
```

**Manual test:**
```bash
cd ~/.openclaw/workspace/projects/ahoyvpn/backend
node health-check.js
```

---

## Alerting

Alerts are sent to **Telegram** (your primary chat) via OpenClaw’s `message send` command.

**Alert conditions:**
- Backend health endpoint returns non‑200 status.
- Endpoint is unreachable (network error, timeout).
- After 3 consecutive failures (initial + 2 retries).

**Cooldown:** 30 minutes between alerts for the same issue.

**Customization:** Edit `health‑check.js` to adjust thresholds, retries, or alert destination.

---

## Verification

1. **Log rotation active:**  
   ```bash
   sudo journalctl -u ahoyvpn-backend.service --since="1 hour ago" | head -5
   ```

2. **Health check working:**  
   ```bash
   curl -s http://localhost:3000/health | jq .status
   ```

3. **Cron job scheduled:**  
   ```bash
   crontab -l | grep ahoyvpn-health
   ```

---

## Maintenance

- Journal logs are automatically managed by systemd‑journald.
- Health‑check cron job will persist across reboots.
- To modify settings, edit the config file and restart the service:
  ```bash
  sudo systemctl restart ahoyvpn-backend.service
  ```
  (Journald config is applied dynamically; no restart needed.)