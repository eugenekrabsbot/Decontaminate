#!/bin/bash
# Backend health check for AhoyVPN
# Runs as root via cron every 15 minutes

set -e

LOG_FILE="/home/ahoyvpn/health_check.log"
BACKEND_URL="https://ahoyvpn.net/api/"
TIMEOUT=10

# Function to log with timestamp
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG_FILE"
}

# Check if backend responds with HTTP 200
if curl -s -f --max-time "$TIMEOUT" "$BACKEND_URL" > /dev/null; then
    log "OK - Backend responding"
    exit 0
else
    log "ERROR - Backend down, restarting PM2"
    # Restart the backend service
    cd /home/ahoyvpn/trialbackend
    pm2 restart backend 2>&1 >> "$LOG_FILE"
    sleep 5
    # Verify restart succeeded
    if curl -s -f --max-time "$TIMEOUT" "$BACKEND_URL" > /dev/null; then
        log "SUCCESS - Backend restored"
    else
        log "FAILED - Backend still down after restart"
    fi
fi