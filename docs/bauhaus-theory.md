# バウハウス造形理論 — 調査メモとルール化案

このアプリの「理論エンジン」の仕様の土台にするための調査メモ。
各項目に **確認度** を付けている：

- ✅ 確認済み … 原典の英訳の引用や、複数の信頼できる資料で確認できた
- 🔶 要確認 … 二次資料の要約のみ、または記憶に基づく。原典での確認が必要
- 🛠 創作 … 理論ではなく、アプリのための解釈・アルゴリズム

---

## 0. 現在の実装（v0.1）との対応

| 現在のルール | 根拠 | 確認度 |
| --- | --- | --- |
| △＝黄、□＝赤、○＝青 | カンディンスキーの 1923 年バウハウスでのアンケート、イッテンの色彩論 | ✅ |
| 色の重さ 青＞赤＞黄、重心を画面中央へ | 知覚心理学の一般論＋独自の式 | 🛠 |
| 8×8 / 12×12 グリッド | バウハウス後のスイス・スタイル | 🛠（借用） |
| 黄金比・フィボナッチ | 古典〜ル・コルビュジエ | 🛠（借用） |
| イッテンの明暗対比・補色対比 | イッテンの 7 つの対比のうち 2 つ | ✅（部分的） |
| △ 鋭い往復、○ 円運動 | カンディンスキーの形態の性格づけ | 🔶 |

**最大の問題**：重心を中央に置くと「静的な均衡」になる。カンディンスキー自身は、上下の重さの差が「劇的な緊張」を生むと書いている（§1）。中心からずれた緊張のある均衡に変えるべき。

---

## 1. カンディンスキー『点と線から面へ』（1926、バウハウス叢書 9）

### 1-1. 基礎平面（Grundfläche）の 4 方向の性格 — 🔶（二次資料で一致）
- **上**：ゆるみ・軽さ・解放・自由。形は小さく散らばって見える
- **下**：凝縮・重さ・束縛。形は大きく重く見える
- **左**：ゆるみ・軽さ・解放。左への動きは「遠くへ出ていく」
- **右**：凝縮・重さ・束縛。右への動きは「内へ戻る」、遅く疲れた動き
- 上下の差は「劇化（ドラマ）」を生む。**重い形を上に、軽い形を下に置く**と、逆向きの手段によって相対的な均衡が得られる

**ルール化案**
- 画面に「重さの場」を持たせる。同じ図形でも、右下では重く、左上では軽く数える
- 重心の目標点を、画面中央ではなく場の重さで補正した点にする（動的均衡）
- モード切替：「安定」（重いものは下・右へ）⇄「劇的」（重いものを上・左へ）

### 1-2. 線の温度 — ✅（英訳の引用あり）
- **水平線**：冷たい支え。平らに広がる
- **垂直線**：高さ。暖かい
- **対角線**：冷と暖の両方を持つ
- ※ 逆に書いている二次資料（Bridges 2013 の論文）もあるが、英訳本文の引用に従う

**ルール化案**：直線の色温度を角度から決める（水平に近いほど寒色、垂直に近いほど暖色）。画面全体の「冷暖バランス」を指標にして、線の回転のスナップを選ぶ。

### 1-3. 角度と色 — ✅（複数資料で一致）
- **鋭角＝黄**（最も暖かい、攻撃的。鋭角を合わせると正三角形になる）
- **直角＝赤**（冷暖の中間、平面的。正方形を作る）
- **鈍角＝青**（受動的で前への張力がない。円に近づく）

**ルール化案**：三角形を「鋭い・正・鈍い」に変形できるようにし、色を角度から連続的に決める（黄→赤→青のグラデーション）。多角形の頂点角の平均で色を決めることもできる。

### 1-4. 実証研究による検証 — ✅
トレント大学の研究では、一般の人で「□＝赤」「△＝黄」の対応は確かめられたが、**「○＝青」は確かめられなかった**。「鋭角＝暖色、鈍角＝寒色」は確かめられた。
→ ○の色は、プリセットとして固定するよりユーザーが変えやすくしてもよい。

---

## 2. イッテン（予備課程 Vorkurs、『色彩の芸術』）

### 2-1. 7 つの色彩対比 — ✅
1. 色相の対比
2. 明暗の対比（予備課程の中心テーマ）
3. 寒暖の対比
4. 補色の対比
5. 同時対比（シュヴルール由来）
6. 彩度の対比
7. 面積（量）の対比（ゲーテ由来）

**ルール化案**：「対比モード」を 7 つから選べるようにする。モードごとに配色の決め方を変える。
- 寒暖モード：画面を寒色群と暖色群に分け、上下・左右に振り分ける（§1-1 と組み合わせる）
- 彩度モード：1 色だけ高彩度、残りは灰色を混ぜる
- 同時対比モード：同じ色を異なる背景色の領域に置き、違って見える現象を見せる

### 2-2. 面積の対比（ゲーテの明度比）— 🔶（比率の数値は要確認）
明るい色ほど少ない面積で釣り合う。よく引用される数値（イッテンがゲーテから引いたもの）：

| 色 | 明度値 | 調和する面積比 |
| --- | --- | --- |
| 黄 | 9 | 3 |
| 橙 | 8 | 4 |
| 赤 | 6 | 6 |
| 紫 | 3 | 9 |
| 青 | 4 | 8 |
| 緑 | 6 | 6 |

**ルール化案**：画面上の色ごとの総面積を集計し、上の比に近づくようフィボナッチ段階でサイズを調整する。今の「重心」とは別の軸の、**色量のバランス**になる。

### 2-3. 6 つの形と 6 つの色 — ✅
□＝赤、△＝黄、○＝青、**台形＝橙、球面三角形＝緑、楕円＝紫**。
「色をその形で描くと効果が強まる」とされる。

**ルール化案**：図形を 6 種類に増やし、二次色（橙・緑・紫）の対応を加える。形の語彙が倍になる。

---

## 3. ヨゼフ・アルバース（バウハウスで教え、のちイェール大学）

### 3-1. 『色彩の相互作用』（1963）— ✅
- 色は相対的で、隣の色によって変わる（「一つの色は多くの顔を持つ」）
- 振動する境界（vibrating boundaries）、消える境界（同じ明るさの色同士）、透明の錯覚

**ルール化案**
- **透明の錯覚**：2 つの図形が重なった部分に、2 色の中間色を計算して塗る（乗算ではなく、アルバース流の「透けて見える」色）
- **境界の振動**：同じ明度の補色が接したら、それを検出して強調する演出を入れる

### 3-2. 「正方形へのオマージュ」の構成規則 — ✅
- 10 単位のモジュール。入れ子の正方形の余白は **下：横：上 ＝ 1：2：3**
- 内側の正方形が下に寄るので「重力と静けさ」が生まれる
- 3 重または 4 重の正方形で、4 つの構成パターンがある

**ルール化案**：「アルバース」ツール。□をタップすると 1：2：3 の規則で入れ子の正方形を生成し、内側ほど明度を段階的に変える。

---

## 4. モホリ＝ナジ

### 4-1. 光・空間・調整器（Light-Space Modulator, 1922–30）— ✅
- 別名の一つが **「空間の万華鏡（Space Kaleidoscope）」**
- 回転する構造体の、動く反射面・透過面に光を当て、影と光の変化を作る
- 透明な素材と反射する素材、重ね合わせ（多重露光）、「動きの中の視覚（Vision in Motion）」

**ルール化案**
- このアプリの万華鏡モードの理論的な柱にできる（「モホリ＝ナジの空間の万華鏡」）
- **光源モード**：仮想の光源が回り、図形が影を落とす。半透明の図形は色付きの影を落とす
- 図形を透明素材として重ね、重なりを強調する

---

## 5. ヒルシュフェルト＝マック／シュヴェルトフェーガー「反射光の色彩遊戯」（1922–23〜）— ✅
- 色の付いた形・点・線を、リズムのある順序でスクリーン上に動かす
- 専用の装置を 4 人の学生が楽譜（台本）に従って操作し、自作の音楽と同期させた
- 1925 年ベルリンの「絶対映画」上映会でも上演された

**ルール化案**
- **スコア（楽譜）モード**：Auto Flow を、拍子に同期した「楽章」構成にする（例：3 楽章で、テンポと色調が変わる）
- **音**：図形ごとに音色を割り当て（下記 §6）、出現や動きに合わせて鳴らす

---

## 6. 色と音の共感覚（カンディンスキー『芸術における精神的なもの』1911）— 🔶（記憶に基づく）
- 黄＝トランペットのような鋭さ、前に出て広がる（遠心的）
- 青＝深いオルガンやチェロ、奥へ引く（求心的）
- 赤＝力強く、内に燃える（チューバ、太鼓など）

**ルール化案**：Web Audio で、△＝高く鋭い音、○＝深く持続する音、□＝打楽器的な音、─＝持続する単音。重心のずれや緊張度で和音や不協和を変える。

---

## 7. シュレンマー「三つ組のバレエ」（1922 初演）— ✅
- 「人体は動く建築」。幾何学・立体幾何が基礎
- **衣装（形）が動きを決める**。人形のような機械的な動きを好んだ
- 数字の 3：3 幕、3 人、12 の踊り、18 の衣装。幕ごとの色調は 黄 → ピンク → 黒（軽やか → 荘厳 → 神秘）

**ルール化案**
- 「形が動きを決める」は Auto Flow の正当な根拠になる（今の実装の理論的な裏付け）
- **三つ組構成**：図形を 3 つ単位で組にして対称・反復させる。場面が 3 つの色調（黄 → ピンク → 黒）を巡回する

---

## 8. クレー『教育スケッチブック』（1925、バウハウス叢書 2）— 🔶（構成は確認、用語の詳細は要確認）
- 4 章構成：線と構造／次元と均衡／重力の曲線／運動と色彩のエネルギー
- 能動的な線（「線を散歩に連れ出す」）、受動的な線、中間の線
- 天秤のような均衡（重さと対重）、重力から解き放たれた運動

**ルール化案**
- **散歩する線**ツール：ユーザーが引いた線を、クレー的な規則（曲がる・分岐する・戻る）で自律的に伸ばす
- **天秤の可視化**：重心を、画面中央の支点に載った天秤として表示する

---

## 9. 提案する優先順位

効果が大きく、今のエンジンに無理なく足せる順：

1. **基礎平面の重さの場（§1-1）** … 静的均衡を動的均衡に変え、構図の質を一番大きく変える
2. **面積の対比（§2-2）** … 色量のバランスという新しい軸。サイズ調整に直結する
3. **6 形 6 色（§2-3）＋角度と色（§1-3）** … 形の語彙を増やす
4. **モホリ＝ナジの光と透明（§4）＋アルバースの透明の錯覚（§3-1）** … 見た目の表現力が大きく上がる
5. **音とスコア（§5, §6）** … 体験を一段変える。Web Audio で実装できる
6. **アルバース・ツール、散歩する線、三つ組構成** … 遊びの幅を広げる個別機能

---

## 出典
- Kandinsky, *Point and Line to Plane*（1926／英訳 1947）: [Bauhaus Book 9](https://www.bauhaus-bookshelf.org/bauhaus-book-9-vassily-kandinsky-point-and-line-to-plane_pdf.html), [Line chapter summary](https://centros.edu.xunta.gal/eoivigo/aulavirtual/pluginfile.php/2667/mod_page/content/15/Kandinsky%20Line%20SUMMARY.pdf), [Study blog (Basic Plane)](http://sgstudyblog.blogspot.com/2016/06/art-wassily-kandinsky-point-and-line-to.html), [KABK thesis ch.3](http://kabk.github.io/govt-theses-15-viktorija-liaudanskaite-media-art-in-the-light-of-kandinskys-theory-of-interactivity/chapter3.html)
- Kattchee, *Kandinsky, Math Artist?*（Bridges 2013）: [PDF](https://archive.bridgesmathart.org/2013/bridges2013-473.pdf)
- 角度と色の実証研究（トレント大学）: [The Hue of Angles](https://iris.unitn.it/retrieve/e3835199-5c5b-72ef-e053-3705fe0ad821/ARTP-1030_the%20Hue%20of%20Angels.pdf)
- Itten: [Wikipedia](https://en.wikipedia.org/wiki/Johannes_Itten), [Color Worqx](https://worqx.com/color/itten.htm), [The Art Story](https://www.theartstory.org/artist/itten-johannes/), [Color and Form（Niggli）](https://niggli.ch/en/products/farbe-und-form), [OLLI color theory handout](https://www.olli-dc.org/uploads/PDFs/2024_Spring/599_Miklitsch/599colortheoryweek3handout.pdf)
- Albers: [Interaction of Color（Center for Book Arts）](https://collections.centerforbookarts.org/Detail/objects/3482), [Princeton Art Museum](https://artmuseum.princeton.edu/art/collections/objects/39364), [Waddington Custot](https://www.waddingtoncustot.com/usr/documents/exhibitions/press_release_url/37/albers2007.pdf), [Lempertz](https://www.lempertz.com/nl/catalogi/lot/1079-1/406-josef-albers.html)
- Moholy-Nagy: [Van Abbemuseum](https://vanabbemuseum.nl/en/collection/licht-raum-modulator), [Kirkpatrick 1988](https://Monoskop.org/images/f/f5/Kirkpatrick_Dianne_1988_Time_and_Space_in_the_Work_of_Laszlo_Moholy-Nagy.pdf), [Williams（Weimar）](https://e-pub.uni-weimar.de/opus4/files/1297/williams_pdfa.pdf)
- Hirschfeld-Mack: [Wikipedia](https://en.wikipedia.org/wiki/Ludwig_Hirschfeld-Mack), [Moving Image Source](https://movingimagesource.us/articles/painting-with-light-20091119), [Univ. of Melbourne](https://blogs.unimelb.edu.au/librarycollections/?p=4761)
- Schlemmer: [Wikipedia](https://en.wikipedia.org/wiki/Triadisches_Ballett), [schlemmer.org](https://www.schlemmer.org/triadic-ballet), [Harvard GSD](https://www.gsd.harvard.edu/?p=2450587)
- Klee: [Wikipedia](https://en.wikipedia.org/wiki/Pedagogical_Sketchbook), [Lars Müller](https://www.lars-mueller-publishers.com/pedagogical-sketchbook), [The Collector](https://www.thecollector.com/what-was-paul-klee-pedagogical-sketchbook/)
