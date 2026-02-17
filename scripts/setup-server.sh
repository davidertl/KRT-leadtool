#!/bin/bash
# ================================================
# KRT-Leadtool Server Setup Script
# Run once on a fresh Debian 13 server
# Skips: firewall (handled by Hetzner), server hardening
# ================================================

set -euo pipefail

echo "========================================"
echo "  KRT-Leadtool Server Setup"
echo "========================================"

# ---- 1. Install Docker ----
echo ""
echo "[1/5] Installing Docker Engine..."

if ! command -v docker &> /dev/null; then
  # Add Docker's official GPG key
  apt-get update
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  # Add Docker repo
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  echo "[1/5] Docker installed successfully"
else
  echo "[1/5] Docker already installed: $(docker --version)"
fi

# ---- 2. Create project directory ----
echo ""
echo "[2/5] Setting up project directory..."

PROJECT_DIR="/opt/krt-leadtool"
mkdir -p "${PROJECT_DIR}"/{data/postgres,data/valkey,data/uptime-kuma,nginx/ssl,nginx/webroot,backups,scripts}

echo "[2/5] Directory structure created at ${PROJECT_DIR}"

# ---- 3. Install Certbot ----
echo ""
echo "[3/5] Installing Certbot for SSL..."

if ! command -v certbot &> /dev/null; then
  apt-get install -y certbot
  echo "[3/5] Certbot installed"
else
  echo "[3/5] Certbot already installed"
fi

# ---- 4. Setup cron jobs ----
echo ""
echo "[4/5] Setting up cron jobs..."

# Backup cron (daily at 02:00)
CRON_BACKUP="0 2 * * * ${PROJECT_DIR}/scripts/backup.sh >> ${PROJECT_DIR}/backups/backup.log 2>&1"

# Certbot renewal (twice daily as recommended)
CRON_CERTBOT="0 3,15 * * * certbot renew --quiet --deploy-hook 'docker compose -f ${PROJECT_DIR}/docker-compose.yml restart nginx'"

# Add cron jobs if not already present
(crontab -l 2>/dev/null || true) | grep -qF "backup.sh" || \
  (crontab -l 2>/dev/null || true; echo "${CRON_BACKUP}") | crontab -

(crontab -l 2>/dev/null || true) | grep -qF "certbot renew" || \
  (crontab -l 2>/dev/null || true; echo "${CRON_CERTBOT}") | crontab -

echo "[4/5] Cron jobs configured"

# ---- 5. Instructions ----
echo ""
echo "[5/5] Final steps:"
echo "========================================"
echo ""
echo "1. Copy your project files to ${PROJECT_DIR}:"
echo "   - docker-compose.yml"
echo "   - nginx/default.conf"
echo "   - postgres/init.sql"
echo "   - scripts/backup.sh"
echo ""
echo "2. Create .env from example.env:"
echo "   cp example.env .env"
echo "   nano .env  # Fill in real values"
echo ""
echo "3. Make backup script executable:"
echo "   chmod +x ${PROJECT_DIR}/scripts/backup.sh"
echo ""
echo "4. Get SSL certificate:"
echo "   certbot certonly --standalone -d YOUR_DOMAIN -d STATUS_DOMAIN --email YOUR_EMAIL --agree-tos"
echo "   # Then copy/symlink certs:"
echo "   ln -s /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem ${PROJECT_DIR}/nginx/ssl/live/fullchain.pem"
echo "   ln -s /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem ${PROJECT_DIR}/nginx/ssl/live/privkey.pem"
echo ""
echo "5. Start the stack:"
echo "   cd ${PROJECT_DIR}"
echo "   docker compose up -d"
echo ""
echo "6. Verify:"
echo "   docker compose ps"
echo "   curl -I https://YOUR_DOMAIN"
echo ""
echo "========================================"
echo "  Setup complete!"
echo "========================================"
