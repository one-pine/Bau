# BAU — 引き継ぎメモ（Claude Code 用）

バウハウスの造形理論で、ユーザーが置いた図形がリアルタイムに再配置・変容する描画アプリ。Web（PWA）と、Capacitor で包んだ iOS / Android アプリとして配信する予定。

## まず読むもの
- `docs/decisions.md` … 決定事項・未決事項・未確認の項目（**最初に読む**）
- `docs/roadmap.md` … 約 33 個の理論の一覧、フェーズ計画、エンジン設計、指揮者（§2-5 プリセット自動切り替え）、色調モード（§2-6）
- `docs/bauhaus-theory.md` … 理論の調査と出典（✅ 確認済み／🔶 要確認／🛠 アプリ用の創作）
- `README.md` … 起動・操作・ストア向けビルド手順

## コマンド
```bash
npm install
npm run dev        # 開発サーバー
npm test           # 理論エンジンの単体テスト（vitest）
npm run build      # 型チェック＋本番ビルド
npx cap sync       # Web の変更をネイティブ側へ反映（build の後）
npx cap open android / ios
```

## 構成
- `src/engine/` … 理論エンジン。**描画や React に依存しない純粋関数に保つ**（Godot 移植とテストのため）
  - `bauhaus.ts` レイアウト理論、`flow.ts` 動き、`render.ts` Canvas 描画とヒットテスト、`export.ts` 書き出し、`color.ts` 色計算
- `src/state/store.ts` … 状態（useSyncExternalStore）、undo/redo、localStorage 保存
- `src/components/` … CanvasStage（描画ループとジェスチャー）、TopBar、Toolbar、EditSheet、SettingsSheet
- `src/platform.ts` / `src/native.ts` … Web とネイティブの差（書き出しは共有シート、触覚、戻るボタン、ステータスバー）
- `android/`, `ios/` … Capacitor のネイティブプロジェクト。アプリ ID `com.lomaloma.bau`（変更不可）
- `assets/src/` … アイコン・スプラッシュの生成スクリプト（**デザイン確定まで実行しない**）

## 約束事
- UI の文言は日本語。バウハウス的なミニマル UI（黒・白・オフホワイト、角は四角）
- サイズはフィボナッチ（8〜233、画面短辺＝400 ユニット）、色は `PALETTE` / `KANDINSKY`（`bauhaus.ts`）
- 理論を追加・変更したら、単体テストを書き、`docs/bauhaus-theory.md` と `docs/roadmap.md` を更新する
- 新しい決定は `docs/decisions.md` に追記する
- 作業ブランチ：`claude/cloud-session-credits-3r1r27`

## 次にやること
フェーズ 1：エンジンを「ルール＋コスト関数＋局所探索」に作り直す（`docs/roadmap.md` §2-1, §3）。
重みは連続値、各ルールのコストを記録、画面の特徴量と操作の記録を用意する（指揮者のため）。
