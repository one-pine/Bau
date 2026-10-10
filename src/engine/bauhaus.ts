/**
 * Bauhaus Layout Engine — 基礎となる理論の部品
 *
 * 配置の計算そのものは layout.ts（ソルバー）と rules.ts（ルール）にある。
 * ここには、それらが使う理論の部品（グリッド、フィボナッチ、色の重さ、対比補正など）を置く。
 *   1. モジュール・グリッド・スナップ   … 8×8 / 12×12 / 黄金比分割の交点・対角線上へ吸着
 *   2. フィボナッチ・サイズ規格化       … 8, 13, 21, 34, 55, 89, 144, 233
 *   3. カンディンスキーの色彩・形態対応 … △=黄 □=赤 ○=青、色の視覚的重みで重心を中央へ
 *   4. イッテンの色彩対比               … 背景との明暗・補色対比が足りない色を自動補正
 */
import { contrastRatio, hslToRgb, luminance, rgbToHsl } from './color'
import type { GridMode, RGB, Settings, Shape, ShapeKind, Visual } from './types'

export const PHI = (1 + Math.sqrt(5)) / 2
export const FIB = [8, 13, 21, 34, 55, 89, 144, 233]

/** 図形サイズの単位 (px)。画面の短辺を 400 ユニットとみなす。 */
export function unitPx(W: number, H: number): number {
  return Math.min(W, H) / 400
}

export const KANDINSKY: Record<ShapeKind, string> = {
  triangle: '#f2c230',
  square: '#d7261e',
  circle: '#1e4fa0',
  line: '#141414',
}

export const PALETTE = [
  '#f2c230', // yellow
  '#d7261e', // red
  '#1e4fa0', // blue
  '#141414', // black
  '#ffffff', // white
  '#8c8a85', // grey
  '#e8762c', // orange
  '#2e7d4f', // green
]

export const BACKGROUNDS = [
  { name: 'オフホワイト', value: '#f2eee3' },
  { name: 'ホワイト', value: '#ffffff' },
  { name: 'ブラック', value: '#121212' },
  { name: 'イエロー', value: '#f2c230' },
]

// ───────────────────────── 2. フィボナッチ規格化

export function snapFib(size: number): number {
  let best = FIB[0]
  let bestD = Infinity
  for (const f of FIB) {
    const d = Math.abs(Math.log(size / f))
    if (d < bestD) {
      bestD = d
      best = f
    }
  }
  return best
}

export function fibStep(size: number, dir: 1 | -1): number {
  const i = FIB.indexOf(snapFib(size))
  return FIB[Math.min(FIB.length - 1, Math.max(0, i + dir))]
}

// ───────────────────────── 1. グリッド

/** グリッド線の位置 (0..1)。縦横で同じ分割を使うので交点の一部は対角線上に乗る。 */
export function gridFractions(mode: GridMode): number[] {
  if (mode === 'golden') {
    const out: number[] = []
    for (let k = 1; k <= 3; k++) {
      const f = 1 / Math.pow(PHI, k)
      out.push(f, 1 - f)
    }
    return out.sort((a, b) => a - b)
  }
  const n = Number(mode)
  return Array.from({ length: n - 1 }, (_, i) => (i + 1) / n)
}

export interface SnapPoint {
  x: number
  y: number
  diagonal: boolean
}

export function snapPoints(W: number, H: number, mode: GridMode): SnapPoint[] {
  const fr = gridFractions(mode)
  const pts: SnapPoint[] = []
  for (const fx of fr) {
    for (const fy of fr) {
      const diagonal = Math.abs(fx - fy) < 1e-9 || Math.abs(fx + fy - 1) < 1e-9
      pts.push({ x: fx * W, y: fy * H, diagonal })
    }
  }
  return pts
}

// ───────────────────────── 3. 視覚的重み

/** 色の視覚的重み。暗いほど・寒色ほど重い (青 > 赤 > 黄)。 */
export function colorWeight(rgb: RGB): number {
  const [h, s] = rgbToHsl(rgb)
  const cool = Math.max(0, Math.cos(((h - 225) * Math.PI) / 180)) * s
  return 0.35 + 0.9 * (1 - luminance(rgb)) + 0.2 * cool
}

const AREA: Record<ShapeKind, number> = {
  circle: Math.PI / 4,
  square: 1,
  triangle: Math.sqrt(3) / 4,
  line: 0.06,
}

export function visualMass(kind: ShapeKind, v: Pick<Visual, 'size' | 'color' | 'alpha'>): number {
  return colorWeight(v.color) * AREA[kind] * v.size * v.size * v.alpha
}

export function centerOfMass(
  items: { kind: ShapeKind; v: Visual }[],
): { x: number; y: number; mass: number } | null {
  let m = 0
  let mx = 0
  let my = 0
  for (const { kind, v } of items) {
    const w = visualMass(kind, v)
    m += w
    mx += w * v.x
    my += w * v.y
  }
  if (m <= 0) return null
  return { x: mx / m, y: my / m, mass: m }
}

// ───────────────────────── 4. イッテンの対比

/** 背景に対して必要なコントラスト比を満たすよう明度・彩度・色相を補正する。 */
export function ittenAdjust(rgb: RGB, bg: RGB, contrast: number): RGB {
  let [h, s, l] = rgbToHsl(rgb)
  // 無彩色（黒・灰・白）は色相で区別できないので、明暗対比をより強く要求する
  const required = Math.max(1.35 + contrast * 3.65, s < 0.12 ? 4.5 : 0)
  s = Math.min(1, s + contrast * 0.25 * (s > 0.05 ? 1 : 0))
  let out = hslToRgb(h, s, l)
  if (contrastRatio(out, bg) >= required) return out

  const dir = luminance(bg) > 0.35 ? -1 : 1
  const walk = (hue: number, sat: number, start: number): RGB | null => {
    for (let ll = start; ll >= 0.02 && ll <= 0.98; ll += dir * 0.02) {
      const c = hslToRgb(hue, sat, ll)
      if (contrastRatio(c, bg) >= required) return c
    }
    return null
  }
  const byLightness = walk(h, s, l)
  if (byLightness) return byLightness

  // 明暗だけで足りない → 背景の補色へ
  const [bh, bs] = rgbToHsl(bg)
  const comp = walk(bs > 0.2 ? bh + 180 : h, Math.max(s, 0.6), 0.5)
  out = comp ?? hslToRgb(h, s, dir < 0 ? 0.05 : 0.95)
  return out
}

// ───────────────────────── 乱数

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ───────────────────────── 色の解決（配置は layout.ts / rules.ts）

export function resolveColor(shape: Shape, settings: Settings): string {
  return settings.correspondence && !shape.colorLocked ? KANDINSKY[shape.kind] : shape.color
}
