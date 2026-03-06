#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "=== homie setup ==="
echo ""

# ── 1. Install tools ──
if ! command -v cloudflared &>/dev/null; then
  echo "[1/2] Installing cloudflared..."
  brew install cloudflared
else
  echo "[1/2] cloudflared already installed"
fi

if ! command -v qrencode &>/dev/null; then
  echo "  Installing qrencode..."
  brew install qrencode
fi

# ── 2. Build ──
echo "[2/2] Building..."

echo "  Frontend..."
cd "$ROOT_DIR/homie-app"
VITE_API_URL="" pnpm build 2>&1 | tail -1

echo "  Backend..."
cd "$ROOT_DIR/homie-backend"
export PATH="$HOME/.cargo/bin:$PATH"
cargo build --release 2>&1 | tail -1

echo ""
echo "=== Setup complete ==="
echo ""
echo "使い方:"
echo ""
echo "  A) このPC だけで使う場合:"
echo "     cd $ROOT_DIR && ./start.sh"
echo "     → http://localhost:3001 でアクセス"
echo ""
echo "  B) スマホからも使う場合:"
echo "     cd $ROOT_DIR && ./start.sh --tunnel"
echo "     → 表示される https://xxx.trycloudflare.com でアクセス"
echo "     → Google Cloud Console にそのURLを承認済みURIとして追加"
echo ""
