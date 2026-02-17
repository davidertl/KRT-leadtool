#!/bin/bash
# =============================================================================
# SSL Initialization Script for KRT-Leadtool
# Generates a temporary self-signed cert so nginx can start,
# then requests a real Let's Encrypt certificate via Certbot.
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

# Step 1: Create a temporary self-signed cert so nginx can start with the HTTPS config
echo "[1/4] Generating temporary self-signed certificate..."
docker compose run --rm --entrypoint "" certbot sh -c "
  mkdir -p /etc/letsencrypt/live/$DOMAIN
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
    -subj '/CN=$DOMAIN'
  echo 'Temporary self-signed cert created.'
"

# Step 2: Start nginx (it can now load the self-signed cert)
echo "[2/4] Starting nginx with temporary cert..."
docker compose up -d nginx

# Wait for nginx to be ready
sleep 3

# Step 3: Request real Let's Encrypt certificate
echo "[3/4] Requesting Let's Encrypt certificate..."
docker compose run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal

# Step 4: Reload nginx to use the real cert
echo "[4/4] Reloading nginx with real certificate..."
docker compose exec nginx nginx -s reload

echo ""
echo "=== Done! ==="
echo "SSL certificate for $DOMAIN is now active."
echo "The certbot container will auto-renew every 12 hours."
echo "Visit: https://$DOMAIN"
