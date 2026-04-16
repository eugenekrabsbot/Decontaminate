#!/bin/bash
set -e

echo "🚀 AhoyVPN Server Setup"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root (or with sudo).${NC}"
   exit 1
fi

# Update system
echo -e "${YELLOW}Updating system packages...${NC}"
apt update && apt upgrade -y

# Install Node.js 20.x
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installing Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

# Install PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}Installing PostgreSQL...${NC}"
    apt install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
fi

# Install Redis (optional, for caching)
if ! command -v redis-server &> /dev/null; then
    echo -e "${YELLOW}Installing Redis...${NC}"
    apt install -y redis-server
    systemctl start redis-server
    systemctl enable redis-server
fi

# Install Nginx
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}Installing Nginx...${NC}"
    apt install -y nginx
    systemctl start nginx
    systemctl enable nginx
fi

# Install PM2 (process manager)
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Installing PM2...${NC}"
    npm install -g pm2
fi

# Create system user for AhoyVPN
if ! id "ahoyvpn" &>/dev/null; then
    echo -e "${YELLOW}Creating ahoyvpn user...${NC}"
    useradd -m -s /bin/bash ahoyvpn
fi

# Database setup
echo -e "${YELLOW}Setting up PostgreSQL database...${NC}"
sudo -u postgres psql -c "CREATE DATABASE ahoyvpn;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER ahoyvpn WITH PASSWORD '$(openssl rand -hex 12)';" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ahoyvpn TO ahoyvpn;" 2>/dev/null || true

# Clone repositories (as ahoyvpn user)
echo -e "${YELLOW}Cloning repositories...${NC}"
sudo -u ahoyvpn bash << 'EOF'
cd /home/ahoyvpn
if [ ! -d "trialfrontend" ]; then
    git clone https://github.com/eugenekrabsbot/trialfrontend.git
fi
if [ ! -d "trialbackend" ]; then
    git clone https://github.com/eugenekrabsbot/trialbackend.git
fi
EOF

# Backend setup
echo -e "${YELLOW}Setting up backend...${NC}"
cd /home/ahoyvpn/trialbackend
sudo -u ahoyvpn npm install --production

# Copy environment file (requires manual editing)
if [ ! -f .env ]; then
    sudo -u ahoyvpn cp .env.example .env
    echo -e "${RED}⚠️  Please edit /home/ahoyvpn/trialbackend/.env with your actual secrets.${NC}"
fi

# Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
sudo -u ahoyvpn npm run migrate

# Frontend setup (static files)
echo -e "${YELLOW}Setting up frontend...${NC}"
cd /home/ahoyvpn/trialfrontend
# No build step needed (static HTML)

# Nginx configuration
echo -e "${YELLOW}Configuring Nginx...${NC}"
cat > /etc/nginx/sites-available/ahoyvpn << 'NGINX'
server {
    listen 80;
    server_name _; # Replace with your domain

    # Frontend (static files)
    location / {
        root /home/ahoyvpn/trialfrontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/ahoyvpn /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Start backend with PM2
echo -e "${YELLOW}Starting backend with PM2...${NC}"
cd /home/ahoyvpn/trialbackend
sudo -u ahoyvpn pm2 start src/index.js --name ahoyvpn-backend --update-env
pm2 save
pm2 startup

echo -e "${GREEN}✅ Setup complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Edit /home/ahoyvpn/trialbackend/.env with your PureWL and Plisio keys."
echo "2. Configure DNS to point to this server's IP."
echo "3. Set up SSL with Let's Encrypt (certbot)."
echo "4. Restart backend: pm2 restart ahoyvpn-backend"
echo ""
echo "Frontend: http://$(curl -s ifconfig.me)"
echo "Backend API: http://$(curl -s ifconfig.me)/api"