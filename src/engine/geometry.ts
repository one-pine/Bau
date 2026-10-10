/**
 * 図形の寸法（描画・書き出し・重さの計算で共有する唯一の定義）
 *
 * size は図形の「大きさ」（px）。図形の中心（重心）を原点に置いたときの寸法を返す。
 * イッテンの 6 形（□ △ ○ ＋ 台形・球面三角形・楕円）と直線（docs/bauhaus-theory.md §2-3）。
 */
import type { ShapeKind } from './types'

export const PHI_INV = 2 / (1 + Math.sqrt(5)) // 0.618

/** 三角形の頂角（度）。60 で正三角形。カンディンスキー：鋭角＝黄、直角＝赤、鈍角＝青 */
export const DEFAULT_APEX = 60
export const MIN_APEX = 20
export const MAX_APEX = 160

export function clampApex(apex: number | undefined): number {
  return Math.min(MAX_APEX, Math.max(MIN_APEX, apex ?? DEFAULT_APEX))
}

/**
 * 頂角 apex の二等辺三角形の底辺 b と高さ h。長い方の辺が size になるようにする
 * （鋭角は縦長、鈍角は横長になる）。
 */
export function triangleDims(size: number, apex?: number) {
  const a = (clampApex(apex) * Math.PI) / 180
  let b = size
  let h = size / 2 / Math.tan(a / 2)
  if (h > size) {
    h = size
    b = 2 * size * Math.tan(a / 2)
  }
  return { b, h }
}

/** 三角形の頂点（重心が原点、頂点が上） */
export function trianglePoints(size: number, apex?: number): [number, number][] {
  const { b, h } = triangleDims(size, apex)
  return [
    [0, (-h * 2) / 3],
    [b / 2, h / 3],
    [-b / 2, h / 3],
  ]
}

/** 台形：下辺 size、上辺 size/2、高さ size×0.618（黄金比） */
export function trapezoidPoints(size: number): [number, number][] {
  const h = size * PHI_INV
  return [
    [-size / 4, -h / 2],
    [size / 4, -h / 2],
    [size / 2, h / 2],
    [-size / 2, h / 2],
  ]
}

/**
 * 球面三角形（ルーローの三角形）：幅 size の正三角形の各辺を、向かいの頂点を中心とする円弧にした形。
 * vertices は重心が原点の正三角形の頂点 [上, 右下, 左下]。
 * 各辺の円弧：右下→左下（中心 上, 60°→120°）、左下→上（中心 右下, 180°→240°）、上→右下（中心 左下, 300°→360°）
 */
export function sphericalVertices(size: number): [number, number][] {
  const s = size
  return [
    [0, -s / Math.sqrt(3)],
    [s / 2, s / (2 * Math.sqrt(3))],
    [-s / 2, s / (2 * Math.sqrt(3))],
  ]
}

/** 楕円：横半径 size/2、縦半径 size/2×0.618（黄金比） */
export function ellipseRadii(size: number) {
  return { rx: size / 2, ry: (size / 2) * PHI_INV }
}

/** 面積 ÷ size²（重さ・面積の対比の計算用） */
export function areaFactor(kind: ShapeKind, apex?: number): number {
  switch (kind) {
    case 'circle':
      return Math.PI / 4
    case 'square':
      return 1
    case 'triangle': {
      const { b, h } = triangleDims(1, apex)
      return (b * h) / 2
    }
    case 'trapezoid':
      return 0.75 * PHI_INV
    case 'spherical':
      return (Math.PI - Math.sqrt(3)) / 2
    case 'ellipse':
      return (Math.PI / 4) * PHI_INV
    case 'line':
      return 0.06
  }
}

/** 形が「角ばっているか」（鋭角・直角を持つ＝暖色側）。カンディンスキーの角度と色、イッテンの寒暖対比で使う */
export function isAngular(kind: ShapeKind): boolean {
  return kind === 'triangle' || kind === 'square' || kind === 'trapezoid'
}
