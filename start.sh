#!/bin/bash

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

export PATH="$HOME/.cargo/bin:$PATH"

USE_TUNNEL=false
if [ "$1" = "--tunnel" ]; then
  USE_TUNNEL=true
fi

# ── 1. Start MinIO (optional, for file uploads) ──
echo "[1/3] Starting MinIO..."
if docker compose up -d 2>&1; then
  echo "  -> MinIO running"
else
  echo "  -> MinIO skipped (Docker not running). File uploads will not work."
fi

# ── 2. Set env ──
cd "$ROOT_DIR/homie-backend"

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example and fill in your values:"
  echo "  cp .env.example .env"
  exit 1
fi

if [ "$USE_TUNNEL" = true ]; then
  echo "[2/3] Starting Cloudflare Tunnel..."
  TUNNEL_LOG=$(mktemp)
  cloudflared tunnel --url http://localhost:3001 > "$TUNNEL_LOG" 2>&1 &
  TUNNEL_PID=$!

  # Wait for tunnel URL
  TUNNEL_URL=""
  for i in $(seq 1 30); do
    TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
    if [ -n "$TUNNEL_URL" ]; then
      break
    fi
    sleep 1
  done

  if [ -z "$TUNNEL_URL" ]; then
    echo "  ERROR: Tunnel URL not found after 30s."
    echo "  Logs:"
    cat "$TUNNEL_LOG"
    kill $TUNNEL_PID 2>/dev/null
    exit 1
  fi

  echo "  -> Tunnel: $TUNNEL_URL"
  echo ""
  echo "  !! Google Cloud Console で以下を追加してください:"
  echo "     承認済みの JavaScript 生成元: $TUNNEL_URL"
  echo "     承認済みのリダイレクト URI:"
  echo "       ${TUNNEL_URL}/api/v1/auth/google/callback"
  echo "       ${TUNNEL_URL}/api/v1/calendar/google/callback"
  echo ""

  # Override URL-related env vars (dotenvy won't overwrite existing env vars)
  export FRONTEND_URL="$TUNNEL_URL"
  export GOOGLE_REDIRECT_URI="${TUNNEL_URL}/api/v1/auth/google/callback"
  export GOOGLE_CALENDAR_REDIRECT_URI="${TUNNEL_URL}/api/v1/calendar/google/callback"

  trap "kill $TUNNEL_PID 2>/dev/null; rm -f $TUNNEL_LOG" EXIT
else
  echo "[2/3] Configuring for localhost..."
fi

# ── 3. Start backend ──
echo "[3/3] Starting homie..."
echo ""
echo "========================================="
if [ "$USE_TUNNEL" = true ]; then
  echo "  homie: $TUNNEL_URL"
else
  echo "  homie: http://localhost:3001"
fi
echo "========================================="
echo ""

# Show QR code if qrencode is available
if command -v qrencode &>/dev/null; then
  if [ "$USE_TUNNEL" = true ]; then
    QR_URL="$TUNNEL_URL"
  else
    QR_URL="http://localhost:3001"
  fi
  echo "  スマホで読み取ってね:"
  echo ""
  qrencode -t ANSIUTF8 "$QR_URL"
  echo ""
fi

exec "$ROOT_DIR/homie-backend/target/release/homie-backend"
