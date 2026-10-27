# CONTINUATION — 作業再開メモ

更新日時: 2026-10-27 (JST)

## 現在の状態

- フェーズ: Phase 0〜3 完了、Phase 4 は実機検証以外ほぼ完了。Phase 5（同期）は未着手（要許可）
- コード: GitHub `taigo921/studyflight`（main）。公開 URL: https://taigo921.github.io/studyflight/
- テスト結果（最終実行）:
  - `npm run lint` … 0 errors / 0 warnings
  - `npm run typecheck` … OK
  - `npm test` … 81 tests passed
  - `npm run build` … 14 routes 静的エクスポート、SW 107 ファイルをプリキャッシュ
  - `npm run test:e2e` … 10 passed（iPhone 13 サイズの Chromium。機能は 2D、3D はスモークテスト）

## 再開時のコマンド

```bash
cd studyflight
npm install
npm run check          # lint + typecheck + unit + build
npm run test:e2e       # build 済みの out/ を scripts/serve.mjs で配信して実行
npm run dev            # UI 開発
```

E2E は環境同梱の Chromium を使う（`@playwright/test` は 1.63.0 に固定）。3D 地球儀を
ヘッドレスで目視する場合は `--use-angle=swiftshader --enable-unsafe-swiftshader` を付けて起動する。

## 実装済みの主な設計

| 領域 | 内容 |
|---|---|
| タイマー | `domain/session.ts` の純粋関数。`activeSince` + `accumulatedFocusSeconds` から毎回計算。`setInterval` は表示更新のみ（非表示時は停止） |
| 状態遷移 | `data/sessions.ts` の `applyTransition` が Dexie トランザクション内で最新レコードを読み直して適用 → 多重着陸・2タブでも冪等。Web Locks があればタブ間で直列化 |
| 着陸 | 予定到達時の着陸時刻は「終了予定時刻」。起動時・画面復帰時に `resolveDueFlights()` で未確定の着陸を確定 |
| focusSegments | 出発/再開で open、一時停止/着陸/放棄で close。日跨ぎ集計の原本 |
| 集計 | `domain/stats.ts`。セグメントを IANA TZ の暦日で分割し、`actualFocusSeconds` を最大剰余法で配分（全画面の数字が一致） |
| 得点 | 満1分=1pt、20分以上かつ80%以上で+10。完了時に一度だけ計算して保存 |
| 地図 | MapLibre GL 6 globe。外部タイルなし（Natural Earth 陸地 GeoJSON を同梱）。失敗・WebGL 不可・2D 設定では `RouteMap2D`（SVG） |
| オフライン | `output: "export"` + `scripts/build-sw.mjs` が全ファイルをプリキャッシュ。更新はトーストから利用者が適用 |
| サウンド | Web Audio でブラウン/ピンク/ホワイトノイズを合成（機内・雨・ホワイトノイズ）。ユーザー操作で開始 |

## 仕様の補完・判断（理由）

1. **ルートは `/flight/?id=` 形式**（仕様は `/flight/[id]`）。静的エクスポートでは動的ルートに事前生成が必要で、オフライン SW とも相性が悪いため。
2. **静的エクスポート採用**。サーバー不要で完全オフライン化・任意の静的ホストに配置可能。
3. **外部地図タイルを使わない**。APIキー・契約・OSM タイル規約の問題を避け、オフラインでも 3D を表示できる。`NEXT_PUBLIC_MAP_STYLE_URL` で外部スタイルに切替可能（規約確認が前提）。
4. **空港データは large + medium（IATA/ICAO あり）5,064 件**。small は件数とサイズの都合で除外。主要空港に日本語名を付与（`scripts/ja-airport-names.json`）。
5. **訪問空港 = 完了フライトの出発地と到着地**。
6. **未出発の搭乗券（boarding）は1件のみ**。新しく発券すると古い搭乗券は削除（未計測データのため）。
7. **セッションに科目名・色・空港コードのスナップショット**を保持（科目アーカイブ・削除後もラベルが残る）。
8. **記録の修正は科目とメモのみ**。集中時間・ポイントは公正さのため編集不可（誤記録は削除）。
9. **フォントはシステムフォント**（iPhone では SF Pro + ヒラギノ）。Google Fonts の取得をビルドに依存させない。
10. **科目色**は暗背景で CVD 検証済みの8色カテゴリ配色。グラフでは上位7科目 + 「その他」に集約。
11. **連続日数の基準**は目標設定の `minimumStreakMinutes`（初期10分）。今日未達でも昨日まで続いていれば継続中。
12. 早期着陸の閾値は設定で変更可能（初期5分）。
13. **旅の仕組み**（2026-10-28 要望）: 学習時間 → 距離の換算は巡航速度 800km/h（25分≈333km、60分≈800km、90分≈1,200km）。候補は所要時間が学習時間の ±15%（最低±5分）、少なければ ±30/50/80% と広げ、最低8件。対象は IATA コードを持つ large/medium 空港。
14. **現在地** = 最後に完了したフライトの着陸空港（なければホーム空港）。放棄（欠航）では移動しない。
15. **ダイバート**: 早期着陸で進捗90%未満なら、その時点の機体位置に最も近い空港に着陸したものとして `landedAirportId/landedCode` を保存し、`distanceKm` は実際に飛んだ距離にする。訪問空港・現在地・軌跡・航路ログは着陸空港を使う。
16. 手動で出発地を変えた場合、軌跡は「/」で区切って表示する。
17. **地図の配信元（すべて APIキー不要）**: 衛星 = EOX Sentinel-2 cloudless 2024（`NEXT_PUBLIC_SATELLITE_TILES` で差し替え可。ライセンス表記は情報源で CC BY / CC BY-NC-SA が分かれるため、商用化時は要確認・差し替え）、地形 = AWS Terrain Tiles、標準/ダーク/ラベル = OpenFreeMap、地球 = 同梱 Natural Earth。外部タイルは SW で事前キャッシュしない。
18. **参考アプリの扱い**: ユーザー提示のスクリーンショット（FocusFlight）は体験・機能の参考にとどめ、色・形・文言・レイアウトは独自に作成（AGENTS.md の方針）。
19. **カメラ更新は0.5秒ごと**: 巡航時は機体が画面上で毎秒数ピクセルしか動かないため。再描画を減らしバッテリーを節約。
20. **WebGL 判定は1回だけ**（以前は描画のたびにコンテキストを作り、上限超過で地図のコンテキストが破棄される不具合があった）。
21. **E2E の構成**: 機能テストは WebGL 無効（2D）で実行、3D は「地球」スタイルでのスモークテスト（retries 2）。CI に GPU がなく SwiftShader の CPU 描画が重いため。workers は 1。

## 進行中: 統合開発指示書（2026-10-28 受領）への対応

ユーザー指示: 実装済みの部分は指示書に従わなくてよい。未実装の機能のみ指示書に従う。コンテキストがリセットされても自動で続行する。

### 実施順（指示書の Phase 順を維持）
1. [x] Phase2-a 実在路線データ: OpenFlights routes.dat（ODbL, 2014年時点, 予定時間なし）→ `scripts/build-routes.mjs` → `public/data/routes.json`。予定飛行時間は推定（距離帯中央値の折れ線モデル、`domain/flight-time.ts`）。UI では「就航実績あり（OpenFlights 2014）」と「推定（路線データなし）」を必ず区別。
   - Jonty/airline-route-data（予定時間付き・毎週更新）は LICENSE がないため**組み込まない**。推定式の係数算出の統計にのみ参照（データは配布しない）。
   - 推定式: 距離帯中央値 (0,20) (190,50) (453,75) (802,103) (1423,150) (2668,245) (5455,445) (9309,715) を線形補間、5分単位に丸め。
2. [x] Phase2-b 区間(Leg)/旅行(Trip): 区間の予定時間 > 学習時間なら分割して複数回で飛ぶ。早期終了は上空で停止し次回同じ地点から再開（**以前のダイバート仕様は廃止**）。区間は sessions と同一トランザクションで更新。
3. [x] Phase2-c 候補検索: 学習時間 ± 許容幅（初期 ±10分、設定可）、分割便、推定候補、最終目的地への進捗、Dijkstra による経由ルート提案、到達不可時の説明と提案。
4. [x] Phase3: NASA Blue Marble（GIBS WMTS, z0-8）を低ズームの地球儀に、高ズームで Sentinel-2 に切替。EOX 2016 版（CC BY 4.0 とされる）と Mapbox Satellite の比較を docs/MAP_PROVIDERS.md に。描画品質設定、到着予定時刻・現在位置表示。
5. [x] Phase5: FlightLog 共有画像（Canvas, 1080x1920/1080x1350/1200x675, Web Share）、UTM 記録、分析イベント基盤（送信先未接続）、同意管理・プライバシーポリシー、先行登録 LP（送信先は環境変数。未設定なら受付停止）、i18n 基盤（ja/en）。
6. [x] Phase6: entitlements（課金状態はサーバー判定前提）、紹介・ソーシャルのデータ型、docs/ARCHITECTURE.md、ライセンス・コスト表。

### 外部サービスが必要なもの（要ユーザー承認・未契約）
- 正確な予定飛行時間（時刻表）: OAG / Cirium / FlightAware AeroAPI 等の有料 API + サーバー（APIキーをクライアントに置かない）
- 先行登録の保存先・分析の送信先: Supabase / PostHog / Plausible 等
- Mapbox Satellite（APIキー・従量課金）

## 未完了・次にやること

1. **公開済み**: https://taigo921.github.io/studyflight/ （LP: /studyflight/lp/、main への push で自動デプロイ）。この作業環境からは github.io・地図配信元に接続できないため、表示確認はユーザー端末で行う
2. **要ユーザー承認（外部サービス）**: 先行登録・分析の送信先、時刻表 API、高解像度衛星画像、Supabase 同期、課金（Stripe / Apple）。docs/LICENSES_AND_COSTS.md
3. 衛星画像の既定は 2024 版（CC BY-NC-SA 4.0、非商用のみ）。**有料化・広告など商用要素を入れる前に** 2016 版・EOX 商用ライセンス・Mapbox のいずれかへ切替（docs/MAP_PROVIDERS.md）
4. 既存画面の文字列を i18n 辞書（src/i18n/ja.ts, en.ts）へ移行。現在の英語対応: ナビ・共有・LP・プライバシー・同意・設定の言語欄
5. iPhone 実機（Safari / ホーム画面 PWA）での検証: safe area、キーボード、バックグラウンド復帰、Wake Lock、Web Share（画像）、衛星画像
6. VoiceOver・Lighthouse 計測、タイムゾーン変更の E2E

## ブロッカー

- なし（公開済み）。iPhone 実機での確認結果待ち。
- 実機 iPhone での検証はこの環境では不可。

## 実装履歴

| 日付 | 変更 | テスト結果 | 課題 |
|---|---|---|---|
| 2026-10-27 | 設計書パッケージ作成 | 未実行 | 実装未着手 |
| 2026-10-27 | Phase 0〜3 実装、Phase 4（PWA/SW/E2E/README） | lint/型/unit 70/build/E2E 7 すべて成功 | 実機検証・デプロイは要許可 |
| 2026-10-27 | サブパス配信（NEXT_PUBLIC_BASE_PATH）対応、GitHub Pages ワークフロー追加 | /studyflight 配下で 3D・SW・データ取得を確認、ルート配信の E2E 7 件も再成功 | リポジトリ作成待ち |
| 2026-10-28 | GitHub に push、Pages 有効化、Actions でデプロイ | CI: lint/型/テスト/ビルド/デプロイ 成功 | 実機確認待ち |
| 2026-10-28 | 統合指示書 Phase6: 利用権判定（サーバー発行前提）、紹介・ソーシャルの型、docs/ARCHITECTURE.md・LICENSES_AND_COSTS.md | lint/型/unit/build/E2E 成功 | 課金・同期は未実装（要承認） |
| 2026-10-28 | 統合指示書 Phase5: 共有画像・UTM・分析イベント・同意・プライバシー・LP/先行登録・ja/en 土台 | lint/型/unit 120/build/E2E 12+3D 1 成功 | 送信先は要承認。既存画面の英語化は未完 |
| 2026-10-28 | 機体の動きがぎこちない → カメラ更新を 0.5秒ごと → 約30fps（高画質は毎フレーム、省電力は0.25秒）。低高度で地面が速く流れるときのカクつきを解消 | lint/型/unit 125/build/E2E 13+3D 1 | 実機でのバッテリー・発熱を要確認 |
| 2026-10-28 | ログの記録削除: 確認ダイアログが記録シートの裏に出ていた → 確認を同じシート内に表示。確認ダイアログを画面のシートより手前に描画。シートを overflow-clip にしてスクロールずれ防止 | lint/型/unit 125/build/E2E 13+3D 1 | — |
| 2026-10-28 | ホーム画面アイコンをユーザー提供画像（エンジン×本）に変更。元画像 assets/app-icon.png（白背景・角丸を除いた全面の正方形）から scripts/generate-icons.mjs で生成。URL に ?v=2 | build/E2E | iPhone は一度ホーム画面から削除して追加し直す必要あり |
| 2026-10-28 | 実機フィードバック: 2016 版の雲の残り・拡大時の Blue Marble のぼやけ・下部文字の読みにくさ → 既定を 2024 版に戻す、Blue Marble は z8 まで、タイルキャッシュ自動、下部グラデーション強化 | lint/型/unit/build/E2E | 配信元の応答速度は実機で要確認 |
| 2026-10-28 | 統合指示書 Phase3: Blue Marble 地球儀、衛星画像 2016 版（CC BY 4.0）既定、配信元比較 docs/MAP_PROVIDERS.md、描画品質設定、ETA・現在位置 | lint/型/unit 104/build/E2E 9+3D 1 成功 | 実機での画像表示確認、商用時の EOX 確認 |
| 2026-10-28 | 統合指示書 Phase2: 実在路線・推定予定時間・区間/旅行・分割飛行と再開・候補検索UI・設定 | lint/型/unit 95/build/E2E 9+3D 1 成功 | 時刻表ベースの予定時間は有料API要承認 |
| 2026-10-28 | 旅の仕組み（時間→行き先候補、現在地、軌跡、ダイバート） | unit 80 / E2E 9 成功 | 実機での操作感の確認待ち |
| 2026-10-28 | 衛星画像・3D地形・カメラ3種・座席表・地図で行き先選択・チェックイン演出 | unit 81 / E2E 10（3回連続成功） | 衛星画像の実機表示確認待ち |

## 未決事項

- 正式アプリ名・ロゴ（暫定名: StudyFlight、ロゴはオリジナルで作成済み）
- 外部地図タイルを導入するか（現状は不要）
- 複数端末同期の導入時期（MVP完了後に判断）
