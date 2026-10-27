# PRODUCT_SPEC — StudyFlight v1.0

## 0. プロダクト定義

**仮称:** StudyFlight  
**コンセプト:** 学習時間を仮想フライトに変換し、飛行体験・学習分析・成長実感を一つにつなぐ、モバイルファーストのPWA。  
**中心価値:** 1回の学習を「搭乗→飛行→着陸→記録」に変え、再訪問する理由をつくる。

### 目標ユーザー

長時間の自己学習を続けたい学生・社会人。医学・歯学など科目の多いユーザーにも適合するよう、科目・学習単元は自由に編集可能とする。

### 成功の定義

- 初回ユーザーがアカウント作成なしに**2分以内で最初のフライトを開始**できる。
- オフラインや画面切替後も学習セッションが欠損・重複しない。
- フライト完了から3タップ以内にログと科目別統計を確認できる。
- iPhone Safariとホーム画面追加PWAで重要操作ができる。

### 対象外（MVP）

- 別アプリの強制ブロック、端末のスクリーンタイム制御
- 実機のフライト追跡・リアルタイム航空便データ
- 実際の飛行所要時間の厳密なシミュレーション
- ユーザー同士のランキング、課金、SNS
- クラウドアカウントとリアルタイム端末間同期（後続フェーズ）

## 1. 体験フロー

```
初回 /onboarding（表示名任意・ホーム空港任意・科目作成）
           ↓
        /home
           ↓  [フライトを予約]
        /boarding （科目 / タスク / 出発地 / 目的地 / 時間）
           ↓  [搭乗券を発行] → [出発]
        /flight/[id] （集中タイマー + 3D地球儀 + 残り時間）
           ↓  [着陸 / 規定時間達成]
        /arrival/[id] （所要時間 / 航路 / マイル / 一言メモ）
           ↓
        /log → /analytics → /passport → /goals
```

ナビゲーション: ホーム / フライト / ログ / 分析 / パスポート。設定・目標はホームから遷移。フライト中はボトムナビ非表示で没入状態を優先。中断したフライトがあれば再開または破棄の導線を優先表示。

## 2. 画面仕様

| 画面 | 必須表示 | 主な操作 |
|---|---|---|
| `/onboarding` | コンセプト・利用開始、科目設定、ホーム空港 | スキップ可能、初回設定 |
| `/home` | 今日の集中時間、今日の目標進捗、継続日数、次のフライト、最近の記録 | 予約開始、未完了フライト復帰 |
| `/boarding` | 検索可能な出発/到着空港、科目、タスク、時間プリセット(25/45/60/90)、カスタム5–240分、座席の演出 | 搭乗券発行、出発 |
| `/flight/[id]` | 3D地球儀、仮想航空路線、飛行機アイコン、残り/経過時間、科目、目的地、進捗 | 一時停止、再開、早期着陸、放棄、ミュート |
| `/arrival/[id]` | 着陸演出、達成時間、獲得ポイント、フライト距離、振り返りメモ | 保存して閉じる、次を予約 |
| `/log` | 時系列・科目フィルター・日付フィルター・詳細 | 検索、記録詳細、誤操作修正・削除 |
| `/analytics` | 今日/週/月、科目別割合、学習時間推移、時間帯ヒートマップ（後半） | 期間変更、目標確認 |
| `/passport` | 訪問した空港・路線・国、獲得した称号、SkyPoints | 訪問履歴表示 |
| `/goals` | 1日の目標、週の目標、達成状況 | 目標の変更 |
| `/settings` | 表示名、時区、音声、動き軽減、データエクスポート・インポート・全削除 | 設定保存 |

### 学習科目の初期サンプル

生理学 / 生化学 / 微生物学 / 歯科保存学 / 口腔外科学 / 歯科補綴学 / その他。いずれも変更・追加・削除可能で、固定カテゴリに依存しない。最初に選んだ科目がない場合は「自由学習」を自動提供する。

## 3. MVPと拡張スコープ

### MVP（Phase 1–4）

- スマホに適した独自UIと最低限の初期設定
- 空港検索、搭乗券、科目、タスク、タイマー、飛行経路、着陸
- 科目別の記録、日/週/月の学習統計、目標、パスポート
- データのローカル永続化と復元、基本的な報酬システム

### 公開品質（Phase 5）

- PWA、オフラインシェル、アクセシビリティ、ユニット/E2E試験、iPhone検証
- 書き出し・読み込み、エラーハンドリング、データマイグレーション
- 低性能端末やWebGL非対応時の2D表示代替

### 後続拡張（Phase 6、許可があった場合）

- Supabase Auth + Postgres、端末間同期、RLS、データ移行
- カスタム通知、学習リマインダー、ウィジェット等の可否調査
- 科目ごとの目標強化、試験日までの学習計画、詳細アナリティクス

## 4. 技術スタック

- Next.js (App Router)、React、TypeScript (strict)、Tailwind CSS
- Zustand: **一時的UI状態のみ**。永続データの真実源はDexie/IndexedDB
- Dexie: ブラウザ内データベース、schema versionでマイグレーション
- Zod: 入力バリデーション、インポート検証
- MapLibre GL JS: Globe投影、航空路線GeoJSONレイヤー。SSR不可のマップをクライアント側だけで読み込み
- Vitest + React Testing Library + Playwright: テスト
- PWA Manifest + Service Worker: ホーム画面追加とアプリシェルのキャッシュ
- 開発・公開: Vercelを第一候補（公開は明示的な許可後）

**依存の方針:** パッケージとAPIは実装時に公式仕様を確認し、検証済みの相互互換バージョンを採用。最新番号を推測して固定しない。

## 5. データモデル（TypeScript概念スキーマ）

すべてのIDはUUID。タイムスタンプはISO 8601 UTC文字列で保存、表示は設定されたIANA timezoneへ変換する。

```ts
type UUID = string;
type SessionStatus = 'boarding' | 'active' | 'paused' | 'completed' | 'abandoned';

interface Subject {
  id: UUID; name: string; color: string; icon?: string;
  archivedAt?: string | null; createdAt: string; updatedAt: string;
}
interface StudyTask {
  id: UUID; subjectId: UUID; title: string;
  status: 'todo' | 'done'; estimatedMinutes?: number;
  createdAt: string; completedAt?: string | null; updatedAt: string;
}
interface Airport {
  id: string; name: string; municipality?: string; countryCode: string;
  iata?: string; icao?: string; lat: number; lng: number;
  type: 'large_airport' | 'medium_airport' | 'small_airport';
}
interface FlightSession {
  id: UUID; status: SessionStatus; subjectId: UUID; taskId?: UUID | null;
  originAirportId: string; destinationAirportId: string;
  plannedSeconds: number;
  startedAt?: string | null;
  activeSince?: string | null;  // active時のみ、最後にタイマーを進め始めた時刻
  accumulatedFocusSeconds: number; // 最後の停止までに確定した集中時間
  pausedAt?: string | null; completedAt?: string | null;
  actualFocusSeconds?: number | null; // 終了時に確定。plannedSecondsで上限
  completionType?: 'on_time' | 'early' | null;
  abandonmentReason?: string | null;
  distanceKm: number; earnedSkyPoints: number;
  note?: string; createdAt: string; updatedAt: string;
}
interface Goals {
  dailyFocusMinutes: number; weeklyFocusMinutes: number;
  minimumStreakMinutes: number; timezone: string;
}
interface Preferences {
  language: 'ja'; homeAirportId?: string; soundMode: 'off' | 'cabin' | 'rain' | 'white_noise';
  reducedMotion: boolean; mapMode: 'auto' | '3d' | '2d';
  backgroundBehavior: 'continue';
}
```

**整合性:** `earnedSkyPoints` は終了時に一度だけ計算して固定。集計時は `completed` のみ数える。着陸連打やリロードで重複レコードを作らず、IDを使って冪等に完了処理を実行する。削除前に確認を表示。将来同期に備え `updatedAt` を管理する。

### IndexedDB（Dexie）のテーブル

`subjects`, `tasks`, `airports`, `sessions`, `goals`, `preferences`, `appMetadata`。現在の飛行セッションは `sessions` から statusで取得する。**同時active/pausedフライトは最大1件**。原子的書き込み（transaction）で移行・終了処理を行う。

### 空港データ

OurAirports の公開データをビルド時に正規化する。位置座標あり・規定の airport type・空港名/IATA/ICAOで検索できるデータのみ採用。IATA未登録の空港も検索できるようICAO/名称で補完し、ユニークIDは `ident` などの安定IDを採用。テスト用の2〜3空港を固定データで用意し、本番用CSVを読み込めない場合でもUIが壊れないようにする。出典・更新日を記録。

## 6. タイマー・状態遷移

```
boarding --出発--> active --時間達成--> completed
                   |   ^                ^
                   v   |                |
                  paused --再開--------+ (activeへ)
                   |                    |
active / paused ---+--早期着陸----------+
active / paused ------放棄------------> abandoned
```

実装時には`early landing`から`completed`への遷移を明確にテストする。

### 時刻計算

`active` 時の表示経過秒数 = `min(plannedSeconds, accumulatedFocusSeconds + max(0, now - activeSince))`。`paused` は `accumulatedFocusSeconds` のみ。`completed` は `actualFocusSeconds`。

- `setInterval` は画面更新用であり、経過時間の真実源にしない。
- 再開・一時停止・完了はDexieトランザクションで保存する。表示は保存レコードから再計算する。
- ブラウザ復帰時（`visibilitychange`）、フォーカス復帰時、再起動時は時刻から復元する。
- **既定では背景へ移った場合も時計時間は進む**。実際に学習していたことの検証はしない旨をUIに明記する。
- `Date.now()`は端末時刻変更の影響を受け得る。負値防止・上限処理・異常時の通知を実装する。厳密な不正防止はMVP対象外。
- 同一画面を複数タブで開いたときは永続状態の書き込み競合を防ぐ。Web Locks APIが使える場合は利用し、使えないブラウザではタブ間通知 + トランザクション + 片方を読み取り専用にするなどの代替を検討する。
- カウントダウン0秒で着陸は**必ず1回**。タブが閉じていた場合は次に開いた時点で完了を確定し、終了予定時刻をもとに着陸時刻を扱う。
- 「早期着陸」は5分以上経過していれば完了扱い、未満は放棄扱いにする（確認ダイアログ付き）。放棄は得点・連続学習の対象外。基準は後に設定可能な設計とする。

### 勉強時間と完了の定義

- 単位は秒で保存し、集計も秒。表示の分単位への丸めは最後だけ。
- 計画時間に達した場合は `on_time`。
- 早期着陸（5分以上）は `early`。マイルは実際の集中時間のみ反映。
- 科目アーカイブ後も過去フライトの科目ラベルが消えないように参照を維持する（物理削除よりarchive推奨）。

## 7. 地球儀とフライトアルゴリズム

- MapLibre GL JS の globe projection を使用する。地図タイル・スタイルは環境変数等で切替可能にする。
- 出発地と到着地の緯度経度から球面線形補間（slerp）による**大圏航路**を算出し、128〜256点のGeoJSON LineStringで描画する。
- 180度経線越えは線分を適切に分割し、地球一周の直線ワープを防ぐ。
- 経過率 `progress = elapsed / plannedSeconds` (0…1) から位置と向きを算出。残距離や進捗を表示する。
- 航空機のアイコンは現実航空便を模しているような誤認表現をしない。航空高度等は演出値と明示。
- フライト距離はハーサイン距離kmで記録（約式。学習時間に比例しない）。
- 60fpsの常時処理は必須ではない。`requestAnimationFrame`を表示中に使い、非表示では停止する。タイマーは独立して動作させる。
- 低性能端末、`prefers-reduced-motion`、WebGL非対応では2D地図・SVG航路・文字進捗へフォールバック。高負荷の3D描画が失敗しても学習時間は消えない。

## 8. ゲーミフィケーション（公平かつ低負荷）

- **SkyPoints**: 完了した学習時間の**満1分につき1ポイント**。
- **到着ボーナス**: 計画時間20分以上、かつ80%以上達成、かつ正常終了したフライトに**+10ポイント**。1フライト1回限り。
- **飛行距離km**は旅の演出/記録の指標であり、SkyPointsには直接換算しない。
- **ランク**は累積SkyPointsで定義（仮：Cadet 0–99 / Navigator 100–499 / First Officer 500–1499 / Captain 1500+）。数値は定数で管理。
- 実績: 初飛行、10回着陸、5空港訪問、1000分達成、7日連続など。
- **連続学習日数**は設定タイムゾーンでの暦日ごとに、完了セッション合計が10分以上ある日を達成日とする。1日内で複数フライトがあっても1日として計算。
- データ修正時に累積統計を重複加算しない。原本 sessions から再計算する。

## 9. 目標と統計

- 日次目標60分、週次300分を初期値として編集可能にする。
- 今日の学習時間、週間達成率、学習科目別内訳、過去7/30日の推移、週間の連続日数を実装。
- 日・週の区切りはユーザー設定のIANAタイムゾーンを使用。週は月曜日始まり。
- 日付跨ぎセッションは**実際に集中した時間を各日に配分**（pause区間は除く）。厳密集計が必要なので、セッション単位に `focusSegments` テーブルを設け、各 active 区間の開始・終了日時を記録する。セグメントは `sessions` と一緒に原子的に更新し、重複・重なりを許さない。
- 途中でタイムゾーンが変更された場合は、その設定に基づいて表示集計を再計算。表示用集計値だけを真実源として保存しない。

### focusSegments 補足

`{ id, sessionId, startedAt, endedAt, durationSeconds }`。再開〜一時停止/着陸の区間に1レコード。現在進行中は `endedAt = null` を許し、表示時は now と計画残量で上限をかける。実際のタイムスタンプと丸め処理の整合を保つ。MVPでも日付跨ぎ・休憩を正確に扱えるよう導入する。

## 10. PWA/オフライン/プライバシー

- オフラインで**タイマー・空港選択（同梱データ）・記録・集計**が動く。
- 地図タイルはオフライン利用可能なライセンスのプロバイダでない限り事前一括ダウンロードしない。ネットがなければ静的・軽量な航路図に切替。
- iPhoneは「共有 → ホーム画面に追加」を分かりやすく案内する。
- 機内音はユーザーが音声再生ボタンを操作してから開始。iOSの自動再生制約を考慮する。
- PWAのプッシュ通知はブラウザ・インストール状態・許可・サーバー実装に依存。MVPでアプリ終了中の確実な着陸通知を保証しない。
- ログインなしの端末内保存はブラウザデータ削除で失われる可能性がある。JSONバックアップ・CSVエクスポートと復元テストを提供する。
- インポートはZodで検証。破損データ・重複ID・既存データとの衝突を安全に処理し、実行前にプレビューと確認を出す。
- 将来のSupabase採用時は認証に紐づく行のみアクセスできるRLSと操作権限のテストを必須とする。匿名キーに過剰な権限を与えない。

## 11. 検収基準（主要受入テスト）

1. 初期設定スキップから25分のフライトを始められる。
2. 10分後にページをリロードしても10分相当の進捗に戻り、二重保存されない。
3. 一時停止中、10分放置しても学習時間は増えない。
4. 画面ロックや別タブ移動後に復帰すると、設定の背景継続ルールで再計算される。
5. 25分達成時の完了処理を複数回実行してもポイントが一度だけ付く。
6. 早期着陸／放棄の計上ルールが守られる。
7. 日跨ぎ・週跨ぎ・タイムゾーン変更・科目アーカイブ後も統計が一貫する。
8. 緯度経度から大圏航路を描ける。日付変更線を越えるルートでもワープがない。
9. iPhone縦画面で主要操作が44px以上のタッチ領域を持つ。
10. WebGLが失敗してもタイマーと保存が正常に動く。
11. ネット接続なしで既存のオフラインシェルを開き、フライトを始めて記録できる（初回インストールやキャッシュ準備はオンライン）。
12. JSONエクスポート→新規環境にインポートで科目、ログ、ポイントが復元できる。
13. `lint`、`typecheck`、`unit test`、`build`、重要なPlaywright E2Eが成功する。
14. ロゴ・画像・UI素材に既存アプリからの無断流用がない。

## 12. 既知の制約

- WebのみでOSの他アプリをブロックしない。
- インストールやWeb Pushの可用性は環境次第。
- 音声はバックグラウンドで安定して流れると保証しない。
- ローカル保存のみでは端末間共有ができない。
- MapLibreは描画ライブラリであり、本番地図タイルの商用利用権まで提供するわけではない。
