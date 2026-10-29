#!/usr/bin/env bash
# Firestore のルールを本番（study-flight）に反映する。
# 認証: 環境変数 FIREBASE_SERVICE_ACCOUNT にサービスアカウントの JSON（そのまま or base64）。
# 未設定なら何もしない（CI でシークレットがないときも失敗にしない）。
set -euo pipefail
if [ -z "${FIREBASE_SERVICE_ACCOUNT:-}" ]; then
  echo "[rules] FIREBASE_SERVICE_ACCOUNT が未設定のため、ルールの反映をスキップします"
  exit 0
fi
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
key="$dir/sa.json"
if printf '%s' "$FIREBASE_SERVICE_ACCOUNT" | head -c 1 | grep -q '{'; then
  printf '%s' "$FIREBASE_SERVICE_ACCOUNT" > "$key"
else
  printf '%s' "$FIREBASE_SERVICE_ACCOUNT" | base64 -d > "$key"
fi
chmod 600 "$key"
GOOGLE_APPLICATION_CREDENTIALS="$key" npx firebase deploy --only firestore:rules --project study-flight --non-interactive
