#!/usr/bin/env bash
set -euo pipefail

# Run monitor as root without prompt (NOPASSWD rule in /etc/sudoers.d/ahoy-monitor)
sudo -n /home/ahoy/monitoring/monitor.sh 2>&1 || true

# Get summary from monitor log
LOG_FILE="/home/ahoy/monitoring/monitor.log"
LAST_LOG="$(tail -50 "$LOG_FILE" 2>/dev/null || echo 'No log entries yet')"

# Create summary
echo "=== SECURITY SUMMARY ==="
echo "Last scan: $(date)"
echo "Recent log entries:"
echo "$LAST_LOG"
