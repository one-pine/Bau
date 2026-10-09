export type ShapeKind = 'circle' | 'triangle' | 'square' | 'line'

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
}

export type GridMode = '8' | '12' | 'golden'

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
  /** 0 = オリジナル、それ以外は万華鏡の複製 */
  copy: number
}
