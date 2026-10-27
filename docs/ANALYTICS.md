# 分析イベントと指標

実装: `src/lib/analytics.ts`（イベント名の一元管理）、`src/lib/consent.ts`（同意）、`src/lib/attribution.ts`（UTM）。

## 原則

- 送信は **同意あり かつ `NEXT_PUBLIC_ANALYTICS_ENDPOINT` 設定時のみ**。現在は送信先未設定（外部サービス未契約・要承認）のため、何も送信・保存しない。
- 値は列挙・数値・真偽のみ（`sanitizeProps`）。科目名・タスク名・メモ・メール・空港の自由入力は送らない。
- `track()` は同期で即座に戻り、例外を投げない。フライトの状態変化はデータベースの保存確定後に記録する（タイマー・保存に影響しない）。
- 同意を取り消すと、未送信のイベントと匿名 ID を削除する。

## イベント（snake_case、「対象_動詞の過去形」）

| イベント | 主なプロパティ | 発生箇所 |
|---|---|---|
| app_opened | — | 起動（DB 準備完了後） |
| onboarding_completed | skipped, subjects, home_set | 初回設定 |
| boarding_pass_issued | planned_minutes, route_source, resumed_leg, split | 搭乗券発行 |
| flight_started | planned_minutes, resumed_leg | 出発 |
| flight_completed | completion_type, focus_minutes, planned_minutes, reached_destination | 着陸・学習終了 |
| flight_abandoned | reason, focus_minutes | 欠航・破棄 |
| trip_destination_set | — | 最終目的地の設定 |
| share_image_created | format, show_route, show_subject, show_date, show_name | 共有画像の生成 |
| share_completed | method (share/download), format | 共有・保存 |
| waitlist_submitted | platform, role | 先行登録 |
| pwa_installed | — | ホーム画面追加 |

全イベントに匿名 ID・起動ごとのセッション ID・最新の流入元（utm_source / medium / campaign）を付ける。

## 10の指標

1. DAU / WAU — app_opened の匿名 ID 数
2. 初回完了率 — onboarding_completed → 初回 flight_completed
3. フライト完了率 — flight_completed ÷ flight_started
4. 学習時間 — flight_completed.focus_minutes の合計・中央値
5. 離脱率 — flight_abandoned ÷ flight_started（理由別）
6. 分割飛行の利用率 — boarding_pass_issued.split / resumed_leg
7. 継続率（D1 / D7） — app_opened の再訪
8. 共有率 — share_completed ÷ flight_completed
9. LP 転換率 — waitlist_submitted ÷ LP 訪問（流入元別）
10. PWA 追加率 — pwa_installed ÷ app_opened（初回）
