/**
 * 図形の種類。イッテンの 6 形（□赤 △黄 ○青 台形橙 球面三角形緑 楕円紫）と直線。
 * spherical は球面三角形（ルーローの三角形）。
 */
export type ShapeKind = 'circle' | 'triangle' | 'square' | 'line' | 'trapezoid' | 'spherical' | 'ellipse'

/** イッテンの 7 つの色彩対比（docs/bauhaus-theory.md §2-1）。none は対比を強調しない */
export type ContrastMode =
  | 'none'
  | 'hue' // 色相の対比：純色同士
  | 'lightDark' // 明暗の対比
  | 'coldWarm' // 寒暖の対比
  | 'complementary' // 補色の対比
  | 'simultaneous' // 同時対比：1 色と、同じ明るさの灰色
  | 'saturation' // 彩度の対比：1 色だけ鮮やか
  | 'extension' // 面積の対比：ゲーテの比率で色の量を釣り合わせる

/** 色調：カラー／モノトーン／モノトーン＋1 色（docs/roadmap.md §2-6） */
export type ToneMode = 'color' | 'mono' | 'accent'

/**
 * ユーザーが入力した「生の」図形データ。
 * 位置はキャンバスに対する正規化座標 (0..1)、サイズは「ユニット」(1unit = min(W,H)/400) で保持し、
 * 画面サイズが変わってもレイアウトエンジンが再計算できるようにしている。
 */
export interface Shape {
  id: string
  kind: ShapeKind
  x: number
  y: number
  size: number
  /** 度数法 */
  rotation: number
  /** ユーザーが選んだ色 (hex) */
  color: string
  /** true の場合、カンディンスキー対応モードでもユーザーの色を優先する */
  colorLocked: boolean
  alpha: number
  /** イッテンの対比をどれだけ強調するか 0..1 */
  contrast: number
  /** カオス配置・Auto Flow の位相に使う固定乱数 */
  seed: number
  /** 三角形の頂角（度）。省略時は 60（正三角形） */
  apex?: number
}

export type GridMode = '8' | '12' | 'golden'

/** レイアウト（配置）を評価するルールの ID。docs/roadmap.md の番号との対応はコメント参照 */
export type RuleId =
  | 'fidelity' // ユーザーの意図（置いた位置・大きさ）を尊重する
  | 'grid' // E1 モジュール・グリッド（対角線上の点を好む）
  | 'spacing' // 重なり・同じ点への集中を避ける
  | 'frame' // 画面の枠からはみ出さない
  | 'balance' // E4/N1 視覚的重みの重心を目標点へ
  | 'tension' // N1 カンディンスキーの基礎平面：重いものを下（安定）か上（劇的）へ
  | 'extension' // N6 イッテンの面積の対比：色ごとの面積をゲーテの比率へ

export type RuleWeights = Record<RuleId, number>

export interface Settings {
  mode: 'order' | 'chaos'
  grid: GridMode
  showGrid: boolean
  correspondence: boolean
  background: string
  blend: 'normal' | 'multiply'
  symmetry: boolean
  folds: number
  mirror: boolean
  flow: boolean
  chaosSeed: number
  /** 各ルールの重み（連続値。0 で無効） */
  weights: RuleWeights
  /** 均衡の目標：0＝画面中央（静的な均衡）… 1＝黄金分割点（動的な均衡） */
  dynamism: number
  /** 基礎平面の緊張：-1＝安定（重いものは下・右）… +1＝劇的（重いものを上・左） */
  tension: number
  /** イッテンの色彩対比のうち、どれを強調するか */
  contrastMode: ContrastMode
  /** 色調 */
  tone: ToneMode
}

export interface View {
  zoom: number
  rotation: number
  panX: number
  panY: number
}

export type RGB = [number, number, number]

/** 画面上で実際に描画される状態 (px)。target に向けて current が補間される。 */
export interface Visual {
  x: number
  y: number
  size: number
  rotation: number
  color: RGB
  alpha: number
  /** 三角形の頂角（度） */
  apex: number
}

/** 1 回分の描画命令。Canvas と SVG の両方がこれを消費する。 */
export interface DrawOp {
  id: string
  kind: ShapeKind
  x: number
  y: number
  size: number
  rotation: number
  color: RGB
  alpha: number
  apex: number
  /** 0 = オリジナル、それ以外は万華鏡の複製 */
  copy: number
}
