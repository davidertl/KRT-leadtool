#!/bin/bash
# =============================================================================
# SSL Initialization Script for KRT-Leadtool
# Requests a Let's Encrypt certificate via Certbot using webroot mode.
# Nginx starts automatically with a self-signed cert, so this just replaces it.
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

# Step 1: Ensure services are running (nginx needs to serve ACME challenges)
echo "[1/3] Ensuring services are running..."
docker compose up -d

# Wait for nginx to be ready
echo "    Waiting for nginx..."
for i in $(seq 1 15); do
  if docker exec krt-nginx nginx -t 2>/dev/null; then
    break
  fi
  sleep 2
done

# Step 2: Request certificate using webroot mode (nginx stays running)
echo "[2/3] Requesting Let's Encrypt certificate..."
docker compose run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal

# Step 3: Reload nginx with the real certificate
echo "[3/3] Reloading nginx with new certificate..."
docker exec krt-nginx nginx -s reload

echo ""
echo "=== Done! ==="
echo "SSL certificate for $DOMAIN is now active."
echo "The certbot container will auto-renew every 12 hours."
echo "Visit: https://$DOMAIN"
