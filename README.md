# StudyFlight — Codex / Claude Code 開発キット

> 作成日: 2026-10-27 / プロジェクト名は仮称。独自ブランドとして開発する。

## これは何か

FocusFlightの「集中を旅として体験する」という発想から出発し、学習管理・飛行体験・ゲーム要素を統合する**独自Webアプリ**の実装指示書一式です。完成コードではありません。

## ファイル構成

- `PRODUCT_SPEC.md` — プロダクト要件、UX、画面、データモデル、アルゴリズム、品質基準
- `STYLE_GUIDE.md` — 画面デザイン・コンポーネント・アニメーション・アクセシビリティ
- `AGENTS.md` — Codex等のコーディングエージェントが守る作業指示
- `CLAUDE.md` — Claude Code用の入口。実装規約は `AGENTS.md` に一元化
- `TASKS.md` — 段階的な実装タスクと検収条件
- `CONTINUATION.md` — 進捗と中断再開の引き継ぎ用テンプレート
- `KICKOFF_PROMPT.md` — Codex / Claude Codeに最初に入力するプロンプト

## 使い方

1. 空のフォルダ `studyflight` を作成し、この7ファイルをルート直下にコピーする。
2. CodexまたはClaude Codeでそのフォルダを開く。
3. `KICKOFF_PROMPT.md` の内容を最初のメッセージとして送る。
4. コーディングエージェントに `PRODUCT_SPEC.md`、`STYLE_GUIDE.md`、`TASKS.md` を参照させて実装を進める。
5. 区切りごとに `CONTINUATION.md` と `TASKS.md` を更新させる。

## 実装方針

MVPはログイン不要・ローカル保存・iPhone優先。機能が安定してからユーザー登録と端末間同期を追加する。外部サービスのAPIキー、契約、公開デプロイは必要な時点で事前に確認する。

## 技術的な重要事項

- iOSを含むブラウザでは、タブを閉じたりバックグラウンドに移るとJavaScriptの実行が止まる／制限される場合がある。`setInterval` の回数ではなく保存した時刻からタイマーを復元する。
- PWAは他アプリを強制ブロックできない。アプリ外での実際の集中を保証しない。
- 地図タイルの利用規約、帰属表示、オフラインキャッシュ制限を遵守する。
- 画面・ロゴ・固有アートワークは独自制作。既存アプリの素材やブランドを複製しない。

## 参照ドキュメント

- Next.js PWA: https://nextjs.org/docs/app/guides/progressive-web-apps
- MapLibre GL JS globe: https://maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-a-vector-map/
- Page Visibility API: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- 空港データ OurAirports (public domain): https://ourairports.com/data/
- OSMタイル利用規約: https://operations.osmfoundation.org/policies/tiles/
- Supabase RLS（後続フェーズ）: https://supabase.com/docs/guides/database/postgres/row-level-security
