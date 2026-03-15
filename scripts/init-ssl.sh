#!/bin/bash
# =============================================================================
# SSL Initialization Script for KRT-Leadtool
# Requests a Let's Encrypt certificate for the app root domain plus
# the status and voice subdomains via Certbot webroot mode.
#
# Usage: ./scripts/init-ssl.sh mydomain.com your@email.com [status.mydomain.com] [voice.mydomain.com]
# =============================================================================

set -e

DOMAIN=${1:?Usage: $0 <domain> <email>}
EMAIL=${2:?Usage: $0 <domain> <email>}
STATUS_DOMAIN=${3:-status.${DOMAIN}}
VOICE_DOMAIN=${4:-voice.${DOMAIN}}

echo "=== KRT SSL Init ==="
echo "App host:    $DOMAIN"
echo "Status host: $STATUS_DOMAIN"
echo "Voice host:  $VOICE_DOMAIN"
echo "Email:       $EMAIL"
echo ""

# Step 1: Ensure services are running (nginx needs to serve ACME challenges)
echo "[1/3] Ensuring services are running..."
APP_MODULES="${APP_MODULES:-leadtool,voice}" docker compose --profile combined --profile ops up -d nginx

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
docker compose --profile combined run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  -d "$STATUS_DOMAIN" \
  -d "$VOICE_DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal

# Step 3: Reload nginx with the real certificate
echo "[3/3] Reloading nginx with new certificate..."
docker exec krt-nginx nginx -s reload

echo ""
echo "=== Done! ==="
echo "SSL certificate for $DOMAIN, $STATUS_DOMAIN, and $VOICE_DOMAIN is now active."
echo "The certbot container will auto-renew every 12 hours."
echo "Visit: https://$DOMAIN"
