# フレンド機能（Firebase）の設定手順

> 公開版は設定済み（プロジェクト `study-flight`、Web 用設定は `src/lib/firebase.ts` の DEFAULTS）。別のプロジェクトに切り替えるときだけ、下の手順 5 の Variables で上書きする。ルールを変えたら Firestore の「ルール」に貼り直すこと。

フレンド・記録の共有・同乗フライトは Firebase を使います。下の手順を一度だけ行うと、公開ページでフレンド機能が使えるようになります（未設定の間は「準備中」と表示されます）。

費用: 無料の Spark プランで始められます（クレジットカード不要）。Firestore の無料枠は 1 日あたりの読み取り・書き込み回数と保存容量に上限があります。友達どうしで使う規模なら収まる見込みですが、最新の上限は Firebase の料金ページで確認してください。

## 1. プロジェクトを作る

1. https://console.firebase.google.com/ を開き、Google アカウントでログイン
2. 「プロジェクトを作成」→ 名前（例: `studyflight`）→ Google アナリティクスは「無効」でよい → 作成

## 2. ログイン方法（匿名）を有効にする

1. 左メニュー「構築」→「Authentication」→「始める」
2. 「Sign-in method」タブ →「匿名」→ 有効にする → 保存
3. 「Settings」タブ →「承認済みドメイン」→「ドメインを追加」→ `taigo921.github.io`

## 3. データベース（Firestore）を作る

1. 左メニュー「構築」→「Firestore Database」→「データベースを作成」
2. ロケーション: `asia-northeast1`（東京）→「本番環境モード」で作成
3. 「ルール」タブを開き、リポジトリの `firestore.rules` の中身をすべて貼り付けて「公開」
   - ルールはエミュレータでテスト済みです（`npm run test:rules`）。ルールを変えたときは同じように貼り直します

## 4. Web アプリを登録して設定値を控える

1. プロジェクトの概要 → 歯車「プロジェクトの設定」→「マイアプリ」→ `</>`（ウェブ）
2. アプリ名（例: `StudyFlight Web`）→ 登録（Firebase Hosting は不要）
3. 表示される `firebaseConfig` の `apiKey`・`authDomain`・`projectId`・`appId` を控える
   - これらはアプリに埋め込む前提の識別子で、秘密の鍵ではありません。データの守りは手順 3 のルールです

## 5. GitHub に設定値を登録する

1. https://github.com/taigo921/studyflight → Settings → Secrets and variables → Actions →「Variables」タブ
2. 「New repository variable」で次の 4 つを登録

| Name | Value |
|---|---|
| `FIREBASE_API_KEY` | apiKey |
| `FIREBASE_AUTH_DOMAIN` | authDomain |
| `FIREBASE_PROJECT_ID` | projectId |
| `FIREBASE_APP_ID` | appId |

3. Actions タブ →「Deploy to GitHub Pages」→「Run workflow」で再公開（または次の push で自動）

## 使い方

- ホームの右上（人のアイコン）→ フレンド → 表示名を決めて「はじめる」
- 「招待リンクを送る」を LINE などで送ると、相手が開いたときに申請が届きます（フレンドコードの入力でも可）
- 同乗フライト: 行き先を選んだあと「友達と一緒に乗る」→ 招待するフレンドを選ぶ。友達は招待から座席を選んで乗り、機長が「全員で出発する」と全員が同時に出発します

## 注意

- ログインは匿名です。端末のデータ（Safari のサイトデータ）を消すとフレンド関係も消えます
- 公開されるのは表示名と学習記録の要約（日別の時間・連続日数・最近の便）だけです。メモ・タスク名は送りません。科目名は設定で非公開にできます
- ローカルでの検証: `npm run test:rules`（ルール）、`npm run test:e2e:social`（2 台の端末を想定した画面テスト）。どちらも Firebase エミュレータを使い、本番には接続しません

## ルールの自動反映（GitHub Actions）

`firestore.rules` を変えて main に push すると、CI がエミュレータでルールテストを通したあと本番に反映する（`npm run deploy:rules`）。
必要なのはリポジトリのシークレット `FIREBASE_SERVICE_ACCOUNT`（サービスアカウントの JSON の中身）だけ。未設定なら反映はスキップされる。

鍵の作り方: Firebase コンソール → 歯車 → プロジェクトの設定 →「サービス アカウント」→「新しい秘密鍵を生成」。
鍵は強い権限を持つので、チャットや Git に貼らない。GitHub の Settings → Secrets and variables → Actions →「Secrets」に登録する。
