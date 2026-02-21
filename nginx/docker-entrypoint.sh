#!/bin/sh
# =============================================================================
# Custom Nginx entrypoint for KRT-Leadtool
# Two-stage config: HTTP-only bootstrap → full SSL after cert is obtained.
#
# Boot:   No cert? → HTTP-only on port 80 (ACME challenges + 503)
# After:  docker compose restart nginx → detects cert → full SSL on 443
# =============================================================================

DOMAIN="${DOMAIN:-lead.das-krt.com}"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
CERT_FILE="${CERT_DIR}/fullchain.pem"
KEY_FILE="${CERT_DIR}/privkey.pem"
CONF_TARGET="/etc/nginx/conf.d/default.conf"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo "[KRT-Nginx] SSL certificate found for ${DOMAIN}."
    echo "[KRT-Nginx] Starting in SSL mode (port 80 redirect + port 443)."

    # Render the SSL template with the actual domain via envsubst
    envsubst '${DOMAIN}' < /etc/nginx/templates/ssl.conf.template > "$CONF_TARGET"
else
    echo "[KRT-Nginx] No SSL certificate found for ${DOMAIN}."
    echo "[KRT-Nginx] Starting in HTTP-only mode (port 80 — ACME challenges only)."
    echo "[KRT-Nginx] Run 'docker compose restart nginx' after Certbot obtains the cert."

    cp /etc/nginx/templates/http-only.conf "$CONF_TARGET"
fi

# Delegate to the official Nginx entrypoint
exec /docker-entrypoint.sh "$@"
