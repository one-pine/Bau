/**
 * 画面の特徴量
 *
 * 指揮者（プリセット自動切り替え、docs/roadmap.md §2-5）が「いまの画面にどの師匠が必要か」を判断する材料。
 * 形の種類と数（ルール E）、画面の診断（ルール B）で使う値をまとめて計算する。
 */
import { rgbToHex } from './color'
import { perceivedCenter, tensionScore } from './rules'
import type { ShapeKind, Visual } from './types'

export const KINDS: ShapeKind[] = ['circle', 'triangle', 'square', 'line']

export interface Features {
  count: number
  byKind: Record<ShapeKind, number>
  /** 形の種類ごとの割合（合計 1） */
  shares: Record<ShapeKind, number>
  /** 形の種類の多様性。0＝1 種類だけ … 1＝全種類が同数（正規化エントロピー） */
  diversity: number
  /** △□○ がどれだけ同数に近いか。0 … 1（シュレンマーの三つ組） */
  triad: number
  /** 知覚上の重心の、画面中央からのずれ（短辺に対する比） */
  centerOffset: number
  /** 重いものが下・右にある度合い。正＝安定、負＝劇的 */
  tension: number
  /** 図形の組のうち、重なっている組の割合 */
  overlap: number
  /** 図形の総面積 ÷ 画面の面積 */
  density: number
  /** 使われている色の数 */
  colors: number
  /** 大きさの種類の数（規格の多様性） */
  sizes: number
}

const AREA: Record<ShapeKind, number> = { circle: Math.PI / 4, square: 1, triangle: Math.sqrt(3) / 4, line: 0.06 }

export function computeFeatures(items: { kind: ShapeKind; v: Visual }[], W: number, H: number): Features {
  const byKind: Record<ShapeKind, number> = { circle: 0, triangle: 0, square: 0, line: 0 }
  for (const { kind } of items) byKind[kind]++
  const count = items.length
  const shares = Object.fromEntries(KINDS.map((k) => [k, count ? byKind[k] / count : 0])) as Record<ShapeKind, number>

  let entropy = 0
  for (const k of KINDS) if (shares[k] > 0) entropy -= shares[k] * Math.log(shares[k])
  const diversity = entropy / Math.log(KINDS.length)

  const t3 = byKind.circle + byKind.triangle + byKind.square
  const triad = t3 >= 3 ? 1 - (Math.max(byKind.circle, byKind.triangle, byKind.square) - Math.min(byKind.circle, byKind.triangle, byKind.square)) / t3 : 0

  // 重さは色にも依存するので、目安として明度の重みを掛ける（rules.ts と同じ式の近似）
  const massItems = items.map(({ kind, v }) => {
    const lum = (0.2126 * v.color[0] + 0.7152 * v.color[1] + 0.0722 * v.color[2]) / 255
    return { massCoef: AREA[kind] * (0.35 + 0.9 * (1 - lum)) * v.alpha, size: v.size, x: v.x, y: v.y }
  })
  const minDim = Math.min(W, H)
  const c = perceivedCenter(massItems, W, H)
  const centerOffset = c ? Math.hypot(c.x - W / 2, c.y - H / 2) / minDim : 0

  let pairs = 0
  let overlapping = 0
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      pairs++
      const a = items[i].v
      const b = items[j].v
      if (Math.hypot(a.x - b.x, a.y - b.y) < (a.size + b.size) / 2 * 0.9) overlapping++
    }
  }

  let area = 0
  for (const { kind, v } of items) area += AREA[kind] * v.size * v.size
  return {
    count,
    byKind,
    shares,
    diversity,
    triad,
    centerOffset,
    tension: tensionScore(massItems, W, H),
    overlap: pairs ? overlapping / pairs : 0,
    density: W > 0 && H > 0 ? area / (W * H) : 0,
    colors: new Set(items.map(({ v }) => rgbToHex(v.color))).size,
    sizes: new Set(items.map(({ v }) => Math.round(v.size))).size,
  }
}
