#!/bin/bash
# Daily security audit for production server (ahoyvpn.net)
# Key: /home/krabs/.ssh/truekey | Passphrase: Bingo8675309 | User: ahoy

LOGFILE="/home/krabs/.openclaw/workspace/logs/security_$(date +\%Y-\%m-\%d).log"
KEY="/home/krabs/.ssh/truekey"
PASSPHRASE="Bingo8675309"
SERVER="89.167.46.117"
USER="ahoy"

mkdir -p "$(dirname $LOGFILE)"

echo "=== AHOYVPN SECURITY AUDIT $(date) ===" >> $LOGFILE

# PM2 status
echo "--- PM2 Status ---" >> $LOGFILE
expect -c "
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $KEY $USER@$SERVER pm2 list
expect \"Enter passphrase\"
send \"$PASSPHRASE\r\"
expect eof
" >> $LOGFILE 2>&1

# Disk usage
echo "--- Disk Usage ---" >> $LOGFILE
expect -c "
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $KEY $USER@$SERVER df -h /
expect \"Enter passphrase\"
send \"$PASSPHRASE\r\"
expect eof
" >> $LOGFILE 2>&1

# Auth log - failed logins
echo "--- Failed Logins (last 30 lines) ---" >> $LOGFILE
expect -c "
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $KEY $USER@$SERVER tail -30 /var/log/auth.log
expect \"Enter passphrase\"
send \"$PASSPHRASE\r\"
expect eof
" >> $LOGFILE 2>&1

# App errors
echo "--- App Errors (PM2 logs) ---" >> $LOGFILE
expect -c "
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $KEY $USER@$SERVER pm2 logs ahoyvpn-backend --lines 30 --nostream
expect \"Enter passphrase\"
send \"$PASSPHRASE\r\"
expect eof
" >> $LOGFILE 2>&1

# Network listening ports
echo "--- Listening Ports ---" >> $LOGFILE
expect -c "
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $KEY $USER@$SERVER ss -tuln
expect \"Enter passphrase\"
send \"$PASSPHRASE\r\"
expect eof
" >> $LOGFILE 2>&1

echo "=== AUDIT COMPLETE $(date) ===" >> $LOGFILE
echo "" >> $LOGFILE
