#!/bin/bash
# Update Telegram webhook URL if ngrok tunnel changes

NGROK_API="http://127.0.0.1:4040/api/tunnels"
CONFIG_FILE="/home/krabs/.openclaw/openclaw.json"
LOG_FILE="/home/krabs/.openclaw/workspace/logs/webhook-monitor.log"

# Create logs directory if needed
mkdir -p "$(dirname "$LOG_FILE")"

# Get current ngrok public URL
NGROK_URL=$(curl -s "$NGROK_API" 2>/dev/null | grep -o '"public_url":"[^"]*' | cut -d'"' -f4 | grep "ngrok" | head -1)

if [ -z "$NGROK_URL" ]; then
  echo "[$(date)] ERROR: Could not fetch ngrok URL" >> "$LOG_FILE"
  exit 1
fi

# Extract current webhook URL from config
CURRENT_WEBHOOK=$(grep -o '"webhookUrl":"[^"]*' "$CONFIG_FILE" | cut -d'"' -f4)

# Construct new webhook URL
NEW_WEBHOOK="${NGROK_URL}/telegram-webhook"

# Compare and update if different
if [ "$CURRENT_WEBHOOK" != "$NEW_WEBHOOK" ]; then
  echo "[$(date)] Webhook changed: $CURRENT_WEBHOOK -> $NEW_WEBHOOK" >> "$LOG_FILE"
  
  # Update config using OpenClaw gateway tool
  openclaw gateway config.patch --raw '{
    "channels": {
      "telegram": {
        "webhookUrl": "'$NEW_WEBHOOK'"
      }
    }
  }' 2>&1 | tee -a "$LOG_FILE"
  
  echo "[$(date)] Config updated successfully" >> "$LOG_FILE"
else
  echo "[$(date)] Webhook unchanged: $CURRENT_WEBHOOK" >> "$LOG_FILE"
fi
