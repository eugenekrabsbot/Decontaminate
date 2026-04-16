#!/usr/bin/env bash
set -euo pipefail

MONITOR_DIR="/home/ahoy/monitoring"
HTML_DIR="/var/www/ahoyvpn.net/html"
BASELINE_FILE="$MONITOR_DIR/html-baseline.sha256"
LOG_FILE="$MONITOR_DIR/monitor.log"
LINE_FILE="$MONITOR_DIR/auth-line.pos"
TMP_HASH_FILE="/tmp/ahoy-html-hashes.sha"

mkdir -p "$MONITOR_DIR"

echo "[${BASH_SOURCE[0]}] Starting integrity + auth scan at $(date -u)" >> "$LOG_FILE"

# Build sorted hash list for HTML dir
if [[ -d "$HTML_DIR" ]]; then
  find "$HTML_DIR" -type f -print0 | sort -z | xargs -0 sha256sum | sort > "$TMP_HASH_FILE"
else
  echo "Warning: HTML directory $HTML_DIR is missing" >> "$LOG_FILE"
  exit 1
fi

if [[ -f "$BASELINE_FILE" ]]; then
  if ! diff -u "$BASELINE_FILE" "$TMP_HASH_FILE" >/tmp/ahoy-html-diff.txt; then
    echo "[${BASH_SOURCE[0]}] File changes detected" >> "$LOG_FILE"
    cat /tmp/ahoy-html-diff.txt >> "$LOG_FILE"
  fi
else
  echo "[${BASH_SOURCE[0]}] Baseline created" >> "$LOG_FILE"
fi

mv "$TMP_HASH_FILE" "$BASELINE_FILE"
rm -f /tmp/ahoy-html-diff.txt

# Auth log monitoring
if [[ -f "/var/log/auth.log" ]]; then
  last_line=$(cat "$LINE_FILE" 2>/dev/null || echo 1)
  last_line=$((last_line < 1 ? 1 : last_line))
  new_line=$(wc -l < "/var/log/auth.log")
  if [[ $new_line -lt $last_line ]]; then
    last_line=1
  fi
  tail -n +"$last_line" "/var/log/auth.log" | grep -Ei "(Failed password|Invalid user|authentication failure|sudo:.*authentication failure)" >/tmp/ahoy-auth-alerts.txt || true
  if [[ -s /tmp/ahoy-auth-alerts.txt ]]; then
    echo "[${BASH_SOURCE[0]}] Suspicious auth entries detected:" >> "$LOG_FILE"
    cat /tmp/ahoy-auth-alerts.txt >> "$LOG_FILE"
  fi
  echo $((new_line + 1)) > "$LINE_FILE"
  rm -f /tmp/ahoy-auth-alerts.txt
else
  echo "Warning: auth log missing" >> "$LOG_FILE"
fi

echo "[${BASH_SOURCE[0]}] Scan complete at $(date -u)" >> "$LOG_FILE"
