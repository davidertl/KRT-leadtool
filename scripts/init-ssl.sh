#!/bin/bash
# =============================================================================
# SSL Initialization Script for KRT-Leadtool
# Requests a Let's Encrypt certificate via Certbot using standalone mode
# (temporarily stops nginx), then restarts everything.
#
# Usage: ./scripts/init-ssl.sh lead.das-krt.com your@email.com
# =============================================================================

set -e

DOMAIN=${1:?Usage: $0 <domain> <email>}
EMAIL=${2:?Usage: $0 <domain> <email>}

echo "=== KRT SSL Init ==="
echo "Domain: $DOMAIN"
echo "Email:  $EMAIL"
echo ""

# Step 1: Stop nginx so certbot can use port 80
echo "[1/3] Stopping nginx (if running)..."
docker compose stop nginx 2>/dev/null || true

# Step 2: Request certificate using standalone mode (no nginx needed)
echo "[2/3] Requesting Let's Encrypt certificate..."
docker run --rm -p 80:80 \
  -v krt-leadtool_certbot-certs:/etc/letsencrypt \
  -v krt-leadtool_certbot-webroot:/var/www/certbot \
  certbot/certbot certonly \
  --standalone \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email

# Step 3: Start everything
echo "[3/3] Starting all services..."
docker compose up -d

echo ""
echo "=== Done! ==="
echo "SSL certificate for $DOMAIN is now active."
echo "The certbot container will auto-renew every 12 hours."
echo "Visit: https://$DOMAIN"
