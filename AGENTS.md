# AGENTS.md — コーディングエージェント共通規約

あなたはこのリポジトリの実装担当シニアフルスタックエンジニア／UIエンジニアです。`PRODUCT_SPEC.md` と `STYLE_GUIDE.md` と `TASKS.md` を読んでから作業してください。指示が衝突した場合は、ユーザーの直近の明示的な指示を最優先し、次に安全性・プライバシー・ライセンス・データ保護、次に `PRODUCT_SPEC.md`、次に `STYLE_GUIDE.md` を優先してください。

## 目的

**動くアプリ**を実装する。美しい静的モックを完成品として提出しない。UI・タイマー・永続化・地図・分析・PWAを段階的に統合する。

## 作業方法

1. 必ず最初にリポジトリの構成、Git状態、既存変更、`TASKS.md`、`CONTINUATION.md`を確認する。既存変更を消さない。
2. 最小の縦方向の機能スライスで実装する。例: 科目選択→フライト開始→一時停止→着陸→DB→履歴までを先に通す。
3. 1つのフェーズ/まとまった機能の完了後に `TASKS.md` を更新し、`CONTINUATION.md` に実装内容・未完了・再開手順を書く。
4. 仕様の曖昧さはユーザー体験と保守性を優先して合理的に補い、補った前提を `CONTINUATION.md` に記録する。
5. 外部APIの契約やAPIキー、決済、GitHubリポジトリ作成、公開デプロイ、破壊的コマンドはユーザーに無断で行わない。
6. 既存の参考アプリの商標、アセット、画面の丸写しはしない。世界観は独自に制作する。
7. 必要な依存関係は公式ドキュメントと互換性を確認。未使用の大規模なライブラリは追加しない。
8. TypeScript strict。UIロジックとドメインロジックを分離。曖昧なany、不可視の共有mutable stateを避ける。
9. 時刻、状態遷移、集計、報酬、日付境界、Geo計算は純粋関数にし、Vitestで網羅する。
10. 進捗報告では `完成 / 検証済み / 未検証 / ブロッカー` を分け、テストを未実行なら正直に示す。

## 最重要の技術制約

- タイマーの真実源は**永続化した時刻・activeセグメント**。`setInterval`カウントで累積しない。
- `completed` のセッションとポイント計上は二重発行しない。
- セッションの状態遷移は `PRODUCT_SPEC.md` の定義に従う。
- 実際の集中時間と、タイマーが進んだ時間は同一とは保証できない。UIでは事実以上の表現をしない。
- 大圏ルート・180°経線・地図障害・オフラインをテストする。
- レンダリング重い地図は遅延読込。WebGLが死んでもタイマーが使用可能な構造にする。
- 将来のクラウド同期を考え、端末内でIDを安定生成する。セッションは冪等に移行できる設計にする。
- 初期ユーザー体験はログイン不要。空港データはライセンス上使えるものだけを採用する。
- OSMの公開タイルをオフライン事前ダウンロードしない。商用利用や高負荷アクセスも勝手に仮定しない。

## 推奨ディレクトリ

```
src/
  app/                 # App Router pages and layout
  components/          # 共有UI
    flight/            # Boarding / Globe / Timer / Landing
    analytics/
    passport/
  features/            # hooks + view models
  domain/              # pure functions: session, scoring, time, geo, stats
  data/                # Dexie adapters, seed, migrations
  lib/                 # infrastructure, env, utilities
  styles/
public/                # PWA icons, licensed audio/assets
scripts/               # airport CSV normalization
src/**/__tests__/
e2e/
```

**上記はガイド。既存構成を尊重し、筋の良い代替案があれば変えてよい。**

## テストゲート（各フェーズ終了時）

- `lint`
- `tsc --noEmit`（`typecheck`スクリプト経由でも可）
- `vitest run`（unit）
- `next build`
- 対象E2E（準備できたフェーズからPlaywright）

コマンドは実際の `package.json` に合わせ、存在しないコマンドを通ったことにしない。

## 継続作業

`CONTINUATION.md` に最低限次を記録：フェーズ、完了済みの実装、現在実装中のファイル、失敗したテスト、次に実行するコマンド、保留中の設計判断、外部サービスのブロッカー。途中中断時も可能な限り更新し、再開時は必ず読む。CodexやClaude Codeの利用制限解除を自動検知する機能はこのファイルだけでは実現しない。
<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
