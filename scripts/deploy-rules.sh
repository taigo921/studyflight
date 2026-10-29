#!/usr/bin/env bash
# Firestore のルールを本番（study-flight）に反映する。
# 認証: 環境変数 FIREBASE_SERVICE_ACCOUNT にサービスアカウントの JSON（そのまま or base64）。
# 未設定なら何もしない。CI では失敗理由を注釈（::error）に出す（鍵の中身は出さない）。
set -uo pipefail
note() { if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::$1 title=deploy-rules::$2"; else echo "[rules] $2"; fi; }

if [ -z "${FIREBASE_SERVICE_ACCOUNT:-}" ]; then
  note notice "FIREBASE_SERVICE_ACCOUNT が未設定のため、ルールの反映をスキップしました"
  exit 0
fi
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
key="$dir/sa.json"
if printf '%s' "$FIREBASE_SERVICE_ACCOUNT" | tr -d ' \n\r\t' | head -c 1 | grep -q '{'; then
  printf '%s' "$FIREBASE_SERVICE_ACCOUNT" > "$key"
else
  printf '%s' "$FIREBASE_SERVICE_ACCOUNT" | base64 -d > "$key" 2>/dev/null || { note error "鍵を読めません（JSON でも base64 でもありません）"; exit 1; }
fi
chmod 600 "$key"

# 鍵の形式を確かめる（表示するのは種類・プロジェクト・アカウント名だけ）
info="$(node -e '
const fs=require("fs");
let k; try { k=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); } catch(e) { console.log("ERR JSON として読めません: "+e.message.slice(0,80)); process.exit(0); }
const miss=["type","project_id","private_key","client_email"].filter(f=>!k[f]);
if (miss.length) { console.log("ERR 項目が足りません: "+miss.join(",")); process.exit(0); }
console.log("OK type="+k.type+" project="+k.project_id+" account="+k.client_email);
' "$key")"
case "$info" in
  ERR*) note error "${info#ERR }"; exit 1 ;;
  *) note notice "${info#OK }" ;;
esac

out="$dir/out.txt"
if GOOGLE_APPLICATION_CREDENTIALS="$key" npx firebase deploy --only firestore:rules --project study-flight --non-interactive >"$out" 2>&1; then
  note notice "ルールを本番に反映しました"
  tail -5 "$out"
  exit 0
fi
cat "$out"
msg="$(grep -iE 'error|denied|permission|403|401|invalid' "$out" | tail -6 | sed 's/%/%25/g' | awk '{printf "%s%%0A", $0}')"
note error "反映に失敗しました: ${msg:-$(tail -6 "$out" | awk '{printf "%s%%0A", $0}')}"
exit 1
