#!/bin/sh
# =============================================================================
# Custom Nginx entrypoint for KRT-Leadtool
# - Generates a self-signed cert if none exists (so nginx can start)
# - Watches for cert changes in the background and reloads nginx automatically
# =============================================================================

DOMAIN="lead.das-krt.com"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
CERT_FILE="${CERT_DIR}/fullchain.pem"
KEY_FILE="${CERT_DIR}/privkey.pem"

# --- Generate self-signed cert if needed ---
if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "[KRT-Nginx] No SSL certificate found for ${DOMAIN}."
    echo "[KRT-Nginx] Generating temporary self-signed certificate..."

    mkdir -p "$CERT_DIR"

    openssl req -x509 -nodes -newkey rsa:2048 -days 7 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -subj "/CN=${DOMAIN}" \
        2>/dev/null

    echo "[KRT-Nginx] Self-signed certificate created."
else
    echo "[KRT-Nginx] SSL certificate found for ${DOMAIN}."
fi

# --- Background cert watcher: reload nginx when cert changes ---
(
    LAST_HASH=""
    # Wait for nginx to fully start
    sleep 5
    while true; do
        if [ -f "$CERT_FILE" ]; then
            CURRENT_HASH=$(sha256sum "$CERT_FILE" 2>/dev/null | cut -d' ' -f1)
            if [ -n "$LAST_HASH" ] && [ "$CURRENT_HASH" != "$LAST_HASH" ]; then
                echo "[KRT-Nginx] Certificate changed — reloading nginx..."
                nginx -s reload 2>/dev/null && echo "[KRT-Nginx] Reloaded successfully." || true
            fi
            LAST_HASH="$CURRENT_HASH"
        fi
        sleep 30
    done
) &

# Delegate to the official Nginx entrypoint
exec /docker-entrypoint.sh "$@"
