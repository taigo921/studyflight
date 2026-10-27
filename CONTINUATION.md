# CONTINUATION — 作業再開メモ

更新日時: 2026-10-27 (JST)

## 現在の状態

- フェーズ: Phase 0〜3 完了、Phase 4 は実機検証以外ほぼ完了。Phase 5（同期）は未着手（要許可）
- コード: GitHub `taigo921/studyflight`（main）。公開 URL: https://taigo921.github.io/studyflight/
- テスト結果（最終実行）:
  - `npm run lint` … 0 errors / 0 warnings
  - `npm run typecheck` … OK
  - `npm test` … 80 tests passed
  - `npm run build` … 14 routes 静的エクスポート、SW 107 ファイルをプリキャッシュ
  - `npm run test:e2e` … 9 passed（iPhone 13 サイズの Chromium）

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

## 未完了・次にやること

1. **公開済み**: https://taigo921.github.io/studyflight/ （GitHub: taigo921/studyflight、main への push で自動デプロイ）。この作業環境からは github.io に接続できないため、表示確認はユーザー端末で行う
2. iPhone 実機（Safari / ホーム画面 PWA）での検証: safe area、キーボード、バックグラウンド復帰、Wake Lock、音声、IndexedDB 永続化
3. VoiceOver での読み上げ確認、Lighthouse（PWA/パフォーマンス/アクセシビリティ）計測
4. タイムゾーン変更の E2E（単体テストは済み）
5. 空港データ JSON（約480KB / gzip 175KB）の初回展開時間を低速端末で計測。必要なら分割読み込み
6. Phase 5（Supabase 同期）は許可後に着手

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
| 2026-10-28 | 旅の仕組み（時間→行き先候補、現在地、軌跡、ダイバート） | unit 80 / E2E 9 成功 | 実機での操作感の確認待ち |

## 未決事項

- 正式アプリ名・ロゴ（暫定名: StudyFlight、ロゴはオリジナルで作成済み）
- 外部地図タイルを導入するか（現状は不要）
- 複数端末同期の導入時期（MVP完了後に判断）
