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

# ---- 3. Ensure cron is available ----
echo ""
echo "[3/5] Ensuring cron is available..."

if ! command -v crontab &> /dev/null; then
  apt-get update
  apt-get install -y cron
  systemctl enable cron || true
  systemctl start cron || true
  echo "[3/5] Cron installed"
else
  echo "[3/5] Cron already available"
fi

# ---- 4. Setup cron jobs ----
echo ""
echo "[4/5] Setting up cron jobs..."

# Backup cron (daily at 02:00)
CRON_BACKUP="0 2 * * * ${PROJECT_DIR}/scripts/backup.sh >> ${PROJECT_DIR}/backups/backup.log 2>&1"

# Add cron jobs if not already present
(crontab -l 2>/dev/null || true) | grep -qF "backup.sh" || \
  (crontab -l 2>/dev/null || true; echo "${CRON_BACKUP}") | crontab -

echo "[4/5] Backup cron configured"

# ---- 5. Instructions ----
echo ""
echo "[5/5] Final steps:"
echo "========================================"
echo ""
echo "1. Copy your project files to ${PROJECT_DIR}:"
echo "   - docker-compose.yml"
echo "   - nginx/default-http.conf"
echo "   - nginx/default-ssl.conf"
echo "   - nginx/docker-entrypoint.sh"
echo "   - postgres/init.sql"
echo "   - scripts/backup.sh"
echo "   - scripts/init-ssl.sh"
echo ""
echo "2. Create .env from example.env:"
echo "   cp example.env .env"
echo "   nano .env  # Fill in DOMAIN, STATUS_DOMAIN, VOICE_DOMAIN, callback URLs, and secrets"
echo ""
echo "3. Make helper scripts executable:"
echo "   chmod +x ${PROJECT_DIR}/scripts/backup.sh ${PROJECT_DIR}/scripts/init-ssl.sh"
echo ""
echo "4. Start the stack:"
echo "   cd ${PROJECT_DIR}"
echo "   APP_MODULES=leadtool,voice docker compose --profile combined --profile ops up -d --build"
echo ""
echo "5. Optional: request the multi-host certificate immediately:"
echo "   ${PROJECT_DIR}/scripts/init-ssl.sh YOUR_DOMAIN YOUR_EMAIL STATUS_DOMAIN VOICE_DOMAIN"
echo ""
echo "6. Verify:"
echo "   docker compose ps"
echo "   curl -I https://YOUR_DOMAIN"
echo "   curl -I https://STATUS_DOMAIN"
echo "   curl -I https://VOICE_DOMAIN"
echo ""
echo "========================================"
echo "  Setup complete!"
echo "========================================"
