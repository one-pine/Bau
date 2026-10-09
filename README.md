# BAU — Bauhaus Kaleidoscope

ユーザーが置いた図形を、バウハウスの造形理論にもとづいてリアルタイムに再配置・変容させる描画 Web アプリ（モバイルファースト / PWA）。

## 起動

```bash
npm install
npm run dev       # 開発サーバー（同一 LAN のスマホからもアクセス可）
npm run build     # 本番ビルド（dist/）
npm run preview   # ビルド結果の確認（Service Worker 有効）
npm test          # レイアウトエンジンの単体テスト
```

## 操作

| 操作 | 動作 |
| --- | --- |
| タップ | 選択中のツール（○ △ □ ─）で図形を置く |
| スワイプ | 始点を中心に大きさと向きを描く（直線は始点→終点） |
| 図形をドラッグ | 移動。秩序モードではグリッドへ吸着し、周りの図形も連鎖して動く |
| 長押し | 加工メニュー（形態・色・サイズ・回転・透過・対比・複製・削除） |
| 2本指 | 図形選択中はその図形を拡大・回転、未選択なら画面全体をズーム・回転 |
| キーボード | `1`〜`4` ツール / `o` 秩序⇄カオス / `k` 万華鏡 / `f` Auto Flow / `⌘Z` 元に戻す / `Delete` 削除 |

上部バー：秩序⇄カオス、万華鏡、Auto Flow、書き出し（PNG ×4 / SVG）、理論設定。

## Bauhaus Layout Engine（`src/engine/bauhaus.ts`）

図形が追加・変更されるたびに `computeLayout()` が全図形の「目標状態」を計算し、描画ループが現在の状態をそこへ指数イージング（LERP）で近づける。

1. **モジュール・グリッド・スナップ**：8×8 / 12×12 / 黄金比（1/φ, 1/φ², 1/φ³）分割の交点へ吸着。対角線上の点を優先し、空いている点を選ぶので図形が重なりにくい。
2. **フィボナッチ規格化**：サイズを 8, 13, 21, 34, 55, 89, 144, 233（短辺 = 400 ユニット）へ丸める。回転は 45° 単位。
3. **カンディンスキーの対応論**：△＝黄、□＝赤、○＝青。色の視覚的重み（暗いほど・寒色ほど重い：青 > 赤 > 黄）× 面積で重心を求め、直前に操作した図形以外を「反転（左右・上下・点対称）」「フィボナッチ 1 段の拡大縮小」して重心を画面中央へ寄せる。
4. **イッテンの対比**：背景とのコントラスト比が不足する色は明度を背景から遠ざけ、それでも足りなければ背景の補色へ寄せる。無彩色には強い明暗対比を要求する。図形ごとの「対比」スライダーで要求値を上げられる。

## モード

- **カオス ⇄ 秩序**：カオスでは理論を外し、シード付き乱数で位置・サイズ・角度を散らす。トグルのたびに新しい配置になる。
- **万華鏡**：画面中心まわりに 2〜8 回の回転対称、必要に応じて線対称の複製を描く。
- **Auto Flow**（`src/engine/flow.ts`）：△ は頂点方向への鋭い往復、○ は円運動、□ は静止と 90° 回転の繰り返し、─ は振り子運動。

## 構成

```
src/
  engine/   types / color / bauhaus（レイアウト理論）/ flow / render（Canvas 描画・ヒットテスト）/ export（PNG・SVG）
  state/    store.ts（useSyncExternalStore ベースの小さなストア、undo/redo、localStorage 保存）
  components/ CanvasStage（描画ループとジェスチャー）/ TopBar / Toolbar / EditSheet / SettingsSheet
public/     manifest.webmanifest / sw.js / アイコン
```

技術：Vite + React + TypeScript、Tailwind CSS v4、Canvas 2D API、Framer Motion（UI）、Lucide React。

## ストア配信（Capacitor: iOS / Android）

同じ Web コードを Capacitor でネイティブアプリに包む。`android/` と `ios/` がネイティブプロジェクト。

```bash
npm run build && npx cap sync   # Web の変更をネイティブ側へ反映
npx cap open android            # Android Studio で開いてビルド・実機実行
npx cap open ios                # Xcode で開いてビルド（macOS が必要）
```

- アプリ ID は `capacitor.config.ts` の `appId`（`com.lomaloma.bau` で確定）。ストア公開後は変更できない。
- ネイティブでは書き出しが共有シートになり、「画像を保存」やほかのアプリへ送れる（`src/platform.ts`）。
- タップ・長押しで触覚フィードバック（Haptics）。フォントは端末内に同梱し、オフラインで動く。
- 配信に必要なもの：Apple Developer Program（年額）、Google Play Console（初回登録料）、アイコン各サイズ、スクリーンショット、プライバシーポリシー。
