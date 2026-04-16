# AhoyVPN Backend Systemd Service Setup

## Prerequisites
- Node.js installed (`/usr/bin/node`)
- PostgreSQL running (system service `postgresql.service`)
- Redis installed and running (required for session/caching)
- Environment file `.env` configured in the backend directory

## Steps

### 0. Install Redis (if not already installed)
```bash
sudo apt update
sudo apt install -y redis-server
sudo systemctl enable redis-server.service
sudo systemctl start redis-server.service
```

Verify Redis is listening on port 6379:
```bash
redis-cli ping
```

### 1. Copy the service file to systemd directory
```bash
sudo cp ahoyvpn-backend.service /etc/systemd/system/
sudo chmod 644 /etc/systemd/system/ahoyvpn-backend.service
```

### 2. Stop the currently running backend (if any)
```bash
pkill -f "node src/index.js"
```

### 3. Reload systemd and enable the service
```bash
sudo systemctl daemon-reload
sudo systemctl enable ahoyvpn-backend.service
```

### 4. Start the service
```bash
sudo systemctl start ahoyvpn-backend.service
```

### 5. Check status
```bash
sudo systemctl status ahoyvpn-backend.service
```

Logs can be viewed with:
```bash
sudo journalctl -u ahoyvpn-backend.service -f
```

### 6. Verify the API is responding
```bash
curl -s http://localhost:3000/api/health
```
(Replace `/api/health` with a valid endpoint; the backend currently doesn't have a health route.)

## Post‑installation
- The service will automatically restart on failure (Restart=always).
- It will start after system boot (enabled).
- Logs are sent to the system journal.

## Optional: Weekly maintenance reboot
If you'd like to schedule a weekly reboot (e.g., Sunday 3 AM), add a cron job as root:

```bash
sudo crontab -e
```
Add the line:
```
0 3 * * 0 /sbin/reboot
```

Alternatively, enable unattended‑upgrade automatic reboots by editing `/etc/apt/apt.conf.d/50unattended‑upgrades` and setting:
```
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";
```

## Troubleshooting
- **Service fails to start**: Check journalctl for errors.
- **Port 3000 already in use**: Ensure no other process is using the port (`sudo lsof -i :3000`).
- **Environment variables missing**: Verify `.env` file exists and contains required keys (database, PureWL, etc.).
- **PostgreSQL not running**: Start it with `sudo systemctl start postgresql`.

## Notes
- Stripe keys have been removed (no longer used).
- The service runs as user `krabs`; ensure file permissions allow reading of `.env` and writing to logs if needed.