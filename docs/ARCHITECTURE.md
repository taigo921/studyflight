# アーキテクチャ

## 全体

- **静的 PWA**（Next.js `output: "export"`）を GitHub Pages で配信。サーバーなし・ログインなし。
- データは端末の **IndexedDB（Dexie）** に保存。画面は `liveQuery` で購読する。
- 地図は **MapLibre GL**（地球儀投影）。外部タイルが取れない・WebGL が使えないときは 2D 航路図に切り替え、タイマーと記録は止めない。
- Service Worker（`scripts/build-sw.mjs`）でアプリシェルを事前キャッシュ。外部タイルはキャッシュしない。

```
src/
  domain/     純粋関数（状態遷移・集計・路線検索・推定時間・利用権）。UI と DB に依存しない
  data/       Dexie のテーブルとトランザクション（sessions / legs / trips / settings / backup）
  features/   React フック（liveQuery の購読、共有画像）
  lib/        ブラウザ依存の小さな部品（地図スタイル、配信元、描画品質、分析、同意、UTM、先行登録）
  components/ 画面と UI 部品
  i18n/       ja（既定）/ en の辞書
```

## タイマーの正しさ

- 真実は保存された `activeSince` + `accumulatedFocusSeconds` + `focusSegments`。表示は毎秒そこから計算するだけ。
- 状態遷移は `domain/session.ts` の純粋関数。`data/sessions.ts` が Dexie トランザクション内で最新の記録を読み直して適用する（冪等。2タブ・リロード・二重タップでも1回だけ）。Web Locks で直列化。
- 起動時・表示復帰時に `resolveDueFlights` で予定時刻を過ぎたフライトを着陸させる。
- 区間（Leg）の進み具合は、同じトランザクションで完了セッションから再計算する（学習していない時間は加算しない）。

## 旅のモデル

- **Trip**: 出発空港 → 最終目的地（任意）。
- **FlightLeg**: 1本の区間。推定予定時間 `scheduledSeconds`、学習で進んだ `flownSeconds`。
- **FlightSession**: 1回の学習。予定時間は min(学習時間, 区間の残り)。途中で終えると上空で停止し、次回は同じ区間を続きから飛ぶ。
- 路線は OpenFlights（`public/data/routes.json`）。予定時間は距離からの推定（`domain/flight-time.ts`）。Dijkstra で経由ルートを提案。

## 外部連携の境界（未接続・要承認）

| 機能 | 現状 | 接続するとき |
|---|---|---|
| 分析 | `lib/analytics.ts` がキューまで。送信先未設定 | `NEXT_PUBLIC_ANALYTICS_ENDPOINT`。同意必須。自前の受信 API または PostHog / Plausible 等 |
| 先行登録 | `lib/waitlist.ts`。送信先未設定なら受付停止 | `NEXT_PUBLIC_WAITLIST_ENDPOINT`。フォームサービスまたは Supabase の Edge Function |
| 実際の時刻表 | 推定時間のみ | 有料 API（OAG / Cirium / FlightAware 等）をサーバー経由で。キーはサーバーにのみ置く |
| 高解像度衛星画像 | Sentinel-2 cloudless 2016 | Mapbox 等。docs/MAP_PROVIDERS.md |
| 同期・アカウント | なし | Supabase（RLS 必須）。TASKS の Phase 5 |

## 課金（設計のみ）

```
[iOS アプリ] --StoreKit--> Apple ----App Store Server Notifications----\
                                                                         --> [サーバー] 検証・正規化 --> entitlements テーブル
[Web]        --Checkout--> Stripe ----Webhook（署名検証）----------------/                     |
                                                                                                 v
                                                              [クライアント] 署名付きの Entitlement を取得・表示切替
```

- 判定ロジックは `domain/entitlements.ts`（期限・猶予・オフライン時の信用期間）。クライアントは有料機能を自分で解放しない。
- 購入経路（Stripe / Apple）は分け、同じ `Entitlement` に正規化する。iOS アプリ内のデジタル商品は App 内課金を使う。
- 基本機能（タイマー・記録・分析・旅）は無料。利用権が切れてもデータは消さない。
- 秘密鍵（Stripe secret key、Webhook secret、App Store の鍵）はサーバーの環境変数のみ。クライアントのコード・リポジトリに置かない。

## 紹介・ソーシャル（設計のみ）

型は `domain/social.ts`。紹介コード（`?ref=` は `lib/attribution.ts` が端末内に記録済み）→ サーバーで成立判定・特典付与。公開範囲は既定で非公開、科目名・メモは公開しない。
