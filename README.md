# StudyFlight

学習時間を仮想フライトに変換する、iPhone 優先のオフライン対応 PWA。
科目・行き先・時間を選んで搭乗券を発行し、集中している間は地球儀の上を機体が進み、着陸とともに学習時間・SkyPoints・訪問空港が記録されます。

- ログイン不要。データは端末内の IndexedDB にのみ保存（JSON バックアップ / CSV 書き出しあり）
- タイマーは保存した時刻から再計算するため、バックグラウンド・リロード・タブを閉じた後でも破綻しない
- 3D 地球儀（MapLibre GL globe）が使えない端末では SVG の 2D 航路図に自動で切り替え
- 外部 API キー・有料サービス不要（地球 = NASA Blue Marble、衛星画像 = Sentinel-2 cloudless 2024、地形 = Terrain Tiles、地図 = OpenFreeMap、オフライン用に Natural Earth を同梱）

## 必要環境

- Node.js 22 以上 / npm 10 以上

## セットアップと主なコマンド

```bash
npm install
npm run dev          # 開発サーバ http://localhost:3000（SW は無効）
npm run build        # 静的エクスポート (out/) + Service Worker 生成
npm start            # out/ をローカル配信 http://127.0.0.1:3000
npm run lint
npm run typecheck
npm test             # Vitest（ドメイン・DB・コンポーネント）
npm run test:e2e     # Playwright（先に npm run build が必要）
npm run check        # lint + typecheck + test + build
```

iPhone 実機で試す場合の注意:
Service Worker と一部 API は HTTPS（または localhost）が必要です。実機検証は HTTPS で配信できる環境（例: 公開前のプレビューデプロイ）で行ってください。

## データの再生成

```bash
# OurAirports (Public Domain) の airports.csv から public/data/airports.json を生成
node scripts/build-airports.mjs raw-data/airports.csv
# Natural Earth 1:110m land (Public Domain) から public/data/world-land.json を生成
node scripts/build-world.mjs raw-data/ne_110m_land.geojson
# アプリアイコン（public/icons/icon.svg → PNG）
npm run icons
```

取得元: https://github.com/davidmegginson/ourairports-data / https://github.com/nvkelso/natural-earth-vector

## 構成

```
src/
  app/            ルート（/, /onboarding, /boarding, /flight?id=, /arrival?id=, /log, /analytics, /passport, /goals, /settings, /subjects）
  components/     UI（flight/ analytics/ passport/ settings/ ui/ icons/ screens/）
  domain/         純粋関数: session(状態遷移・タイマー) scoring stats geo zoned(タイムゾーン) airport-search format
  data/           Dexie スキーマ・リポジトリ・バックアップ・空港ローダ
  features/       React フック（liveQuery、時計、統計）
  lib/            起動処理、SW 登録、サウンド合成、ダウンロード
  store/          Zustand（トースト・確認ダイアログなど一時 UI 状態のみ）
scripts/          データ変換、SW 生成、静的サーバ、アイコン生成
e2e/              Playwright
```

設計の詳細・判断理由は `CONTINUATION.md`、要件は `PRODUCT_SPEC.md` / `STYLE_GUIDE.md`、進捗は `TASKS.md`。

## デプロイ（GitHub Pages）

`.github/workflows/deploy-pages.yml` が main への push ごとに lint・型・テスト・ビルドを行い、GitHub Pages に公開します。

1. GitHub で空のリポジトリ（例: `studyflight`、Public）を作成し、このコードを main に push
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする（初回のみ）
3. Actions の「Deploy to GitHub Pages」を再実行（または main に push）
4. `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開される

サブパス配信のため、ビルド時に `NEXT_PUBLIC_BASE_PATH=/<リポジトリ名>` を自動で付けています。
ローカルで同じ状態を再現する場合:

```bash
NEXT_PUBLIC_BASE_PATH=/studyflight npm run build
node scripts/serve.mjs out 3000 /studyflight   # http://127.0.0.1:3000/studyflight/
```

その他の静的ホスティング（Vercel / Cloudflare Pages 等）でも `out/` をそのまま配置できます（ルート配信なら BASE_PATH 不要）。

## 地図の配信元の差し替え

`.env.example` を参照。`NEXT_PUBLIC_SATELLITE_TILES` / `NEXT_PUBLIC_SATELLITE_ATTRIBUTION` / `NEXT_PUBLIC_SATELLITE_CREDIT` / `NEXT_PUBLIC_TERRAIN_TILES` / `NEXT_PUBLIC_VECTOR_STYLE_BASE` で変更できます。商用利用する場合は各配信元の規約を確認してください。

## ライセンス表記

- 地球（低ズーム）: NASA Blue Marble Next Generation（NASA EOSDIS GIBS）
- 衛星画像: Sentinel-2 cloudless by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024), CC BY-NC-SA 4.0（非商用のみ）。商用化時の切替は docs/MAP_PROVIDERS.md
- 標高: Terrain Tiles (Mapzen, AWS Open Data)
- 地図・地名: OpenFreeMap / © OpenMapTiles / © OpenStreetMap contributors
- 空港データ: OurAirports — Public Domain
- 地図データ: Natural Earth — Public Domain
- 地図描画: MapLibre GL JS — BSD-3-Clause
- ロゴ・アイコン・UI はオリジナル。サウンドは Web Audio で端末内合成

## ドキュメント

- docs/ARCHITECTURE.md — 構成・タイマーの正しさ・外部連携と課金の設計
- docs/MAP_PROVIDERS.md — 地図・衛星画像の配信元比較
- docs/ANALYTICS.md — 分析イベントと指標
- docs/LICENSES_AND_COSTS.md — ライセンスと費用
