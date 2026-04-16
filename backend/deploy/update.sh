#!/bin/bash
set -e

echo "🔄 AhoyVPN Update Script"

cd /home/ahoyvpn/trialbackend
git pull origin main
npm install --production
npm run migrate
pm2 restart ahoyvpn-backend

cd /home/ahoyvpn/trialfrontend
git pull origin main

echo "✅ Update complete!"