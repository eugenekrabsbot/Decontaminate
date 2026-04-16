#!/bin/bash
set -e

echo "AhoyVPN Backend Systemd Service Setup"
echo "======================================"

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    echo "Please run this script as a normal user (sudo will be prompted as needed)."
    exit 1
fi

# 0. Install Redis if not installed
if ! dpkg -l | grep -q redis-server; then
    echo "Redis not found. Installing redis-server..."
    sudo apt update
    sudo apt install -y redis-server
    sudo systemctl enable redis-server.service
    sudo systemctl start redis-server.service
    echo "Redis installed and started."
else
    echo "Redis already installed."
fi

# 1. Copy service file
echo "Copying service file to /etc/systemd/system/"
sudo cp ahoyvpn-backend.service /etc/systemd/system/
sudo chmod 644 /etc/systemd/system/ahoyvpn-backend.service

# 2. Stop any existing backend process
echo "Stopping any existing backend process..."
pkill -f "node src/index.js" || true
sleep 2

# 3. Reload systemd
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

# 4. Enable service
echo "Enabling ahoyvpn-backend.service..."
sudo systemctl enable ahoyvpn-backend.service

# 5. Start service
echo "Starting ahoyvpn-backend.service..."
sudo systemctl start ahoyvpn-backend.service

# 6. Check status
echo "Service status:"
sudo systemctl status ahoyvpn-backend.service --no-pager

echo ""
echo "Setup complete. The backend should now be running as a systemd service."
echo "Logs: sudo journalctl -u ahoyvpn-backend.service -f"
echo "Test API: curl -s http://localhost:3000/"

# Optional weekly reboot schedule
read -p "Schedule a weekly reboot on Sunday at 3 AM? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Adding cron job for weekly reboot..."
    (sudo crontab -l 2>/dev/null | grep -v "/sbin/reboot"; echo "0 3 * * 0 /sbin/reboot") | sudo crontab -
    echo "Cron job added. Current root crontab:"
    sudo crontab -l
else
    echo "Skipping weekly reboot scheduling."
fi

# Optional unattended-upgrades automatic reboots
read -p "Enable automatic reboots after security updates (with unattended-upgrades)? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Enabling automatic reboots in unattended-upgrades..."
    sudo sed -i 's/^Unattended-Upgrade::Automatic-Reboot.*/Unattended-Upgrade::Automatic-Reboot "true";/' /etc/apt/apt.conf.d/50unattended-upgrades
    sudo sed -i 's|^//Unattended-Upgrade::Automatic-Reboot-Time|Unattended-Upgrade::Automatic-Reboot-Time|' /etc/apt/apt.conf.d/50unattended-upgrades
    sudo sed -i 's|^Unattended-Upgrade::Automatic-Reboot-Time.*|Unattended-Upgrade::Automatic-Reboot-Time "03:00";|' /etc/apt/apt.conf.d/50unattended-upgrades 2>/dev/null || echo 'Unattended-Upgrade::Automatic-Reboot-Time "03:00";' | sudo tee -a /etc/apt/apt.conf.d/50unattended-upgrades
    echo "Automatic reboots enabled (03:00)."
else
    echo "Skipping unattended-upgrades automatic reboots."
fi