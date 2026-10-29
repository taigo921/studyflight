# 外部データ・サービスのライセンスと費用

最終確認: 2026-10-28。**商用化・有料化の前に、各提供元の最新の規約・料金を確認すること。** 法的助言ではない。

## 現在使っているもの（すべて無料・APIキー不要）

| 対象 | 提供元 | ライセンス | 商用利用 | 帰属表示 | 費用 |
|---|---|---|---|---|---|
| 空港データ | OurAirports | パブリックドメイン | 可 | 任意（アプリ内に記載） | 0 |
| 路線データ | OpenFlights routes.dat（2014年時点） | ODbL 1.0 | 可（帰属表示・派生 DB の同一ライセンス公開） | 必須 | 0 |
| 地球画像 | NASA Blue Marble NG（GIBS） | NASA 画像（米国政府著作物） | 可 | 謝辞を求められている | 0 |
| 衛星画像 | Sentinel-2 cloudless 2024（EOX） | CC BY-NC-SA 4.0 | **不可**（商用化時は 2016 版 CC BY 4.0・EOX 商用ライセンス・Mapbox へ切替。2016 版も EOX に要確認） | 必須 | 0（商用ライセンスは見積もり） |
| 地形 | Terrain Tiles（Mapzen / AWS Open Data） | 各ソースの帰属 | 可 | 必須 | 0 |
| 地図・地名 | OpenFreeMap / OpenMapTiles / OpenStreetMap | ODbL（OSM）他 | 可 | 必須 | 0（寄付制） |
| 陸地（オフライン） | Natural Earth | パブリックドメイン | 可 | 任意 | 0 |
| 地図描画 | MapLibre GL JS | BSD-3-Clause | 可 | ライセンス表記 | 0 |
| 3D 描画 | Three.js | MIT | 可 | ライセンス表記 | 0 |
| 機体モデル | StudyFlight 787-9 風モデル（開発者提供、手続き的に生成したオリジナル。生成スクリプトを assets/models に同梱。Boeing のライセンスモデルではない） | 開発者の権利 | 可 | 不要 | 0 |
| フレンド機能 | Firebase（Authentication 匿名・Firestore） | Google の規約 | 可 | 不要 | 無料の Spark プランで開始（1 日の読み書き回数・容量に上限。料金ページで要確認）。設定はユーザーが行う |
| 配信 | GitHub Pages | GitHub 規約 | 個人・小規模は可（商用 SaaS の主用途は規約確認） | — | 0 |

使っていないもの: Jonty/airline-route-data（LICENSE なし。統計の参考のみで同梱しない）、Sentinel-2 cloudless 2016（CC BY 4.0。商用化時の切替候補として設定済み）。

## 導入候補（要承認・未契約）

| 用途 | 候補 | 費用の目安 | 注意 |
|---|---|---|---|
| 実際の時刻表・所要時間 | OAG、Cirium、FlightAware AeroAPI | 有料（従量または契約）。要見積もり | キーはサーバーのみ。再配布・キャッシュ条件 |
| 高解像度衛星画像 | Mapbox Satellite、EOX 商用ライセンス | 無料枠あり → 従量 / 見積もり | ロゴ・帰属表示、トークンの URL 制限 |
| 先行登録の保存 | Supabase、フォームサービス | 無料枠あり | 個人情報（メール）の管理・削除対応 |
| 分析 | PostHog、Plausible、自前 | 無料枠〜月額 | 同意管理、匿名化 |
| 同期・アカウント | Supabase | 無料枠あり → 月額 | RLS、データ移行 |
| 課金 | Stripe（Web）、Apple App 内課金（iOS） | 手数料（Stripe: 決済ごと / Apple: 売上の一定割合） | Webhook 検証、ストア規約 |
