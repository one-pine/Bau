/**
 * Bauhaus Layout Engine
 *
 * 生の入力 (Shape[]) から、各図形が最終的に落ち着くべき姿 (Visual) を計算する純粋関数群。
 *   1. モジュール・グリッド・スナップ   … 8×8 / 12×12 / 黄金比分割の交点・対角線上へ吸着
 *   2. フィボナッチ・サイズ規格化       … 8, 13, 21, 34, 55, 89, 144, 233
 *   3. カンディンスキーの色彩・形態対応 … △=黄 □=赤 ○=青、色の視覚的重みで重心を中央へ
 *   4. イッテンの色彩対比               … 背景との明暗・補色対比が足りない色を自動補正
 */
import { contrastRatio, hexToRgb, hslToRgb, luminance, rgbToHsl } from './color'
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

// ───────────────────────── レイアウト本体

export function resolveColor(shape: Shape, settings: Settings): string {
  return settings.correspondence && !shape.colorLocked ? KANDINSKY[shape.kind] : shape.color
}

/**
 * 全図形の目標状態を計算する。
 * anchorId は直前に追加・変更された図形で、重心調整の際に「動かさない」図形として扱う。
 */
export function computeLayout(
  shapes: Shape[],
  settings: Settings,
  W: number,
  H: number,
  anchorId: string | null,
): Map<string, Visual> {
  const out = new Map<string, Visual>()
  if (W <= 0 || H <= 0) return out
  const u = unitPx(W, H)
  const bg = hexToRgb(settings.background)

  if (settings.mode === 'chaos') {
    for (const s of shapes) {
      const r = mulberry32(s.seed ^ settings.chaosSeed)
      out.set(s.id, {
        x: clamp(s.x + (r() - 0.5) * 0.5, 0.04, 0.96) * W,
        y: clamp(s.y + (r() - 0.5) * 0.5, 0.04, 0.96) * H,
        size: s.size * (0.5 + r() * 1.2) * u,
        rotation: s.rotation + (r() - 0.5) * 140,
        color: hexToRgb(s.color),
        alpha: s.alpha * (0.65 + r() * 0.35),
      })
    }
    return out
  }

  // 1 & 2: グリッドスナップ + フィボナッチ
  const pts = snapPoints(W, H, settings.grid)
  const occ = new Array(pts.length).fill(0)
  const penalty = 0.2 * Math.min(W, H)
  const order = [...shapes].sort((a, b) => (a.id === anchorId ? -1 : b.id === anchorId ? 1 : 0))
  const working: { s: Shape; v: Visual; fib: number }[] = []

  for (const s of order) {
    const px = s.x * W
    const py = s.y * H
    let bi = 0
    let bc = Infinity
    pts.forEach((p, i) => {
      const c = Math.hypot(p.x - px, p.y - py) * (p.diagonal ? 0.88 : 1) + occ[i] * penalty
      if (c < bc) {
        bc = c
        bi = i
      }
    })
    occ[bi]++
    const fib = snapFib(s.size)
    working.push({
      s,
      fib,
      v: {
        x: pts[bi].x,
        y: pts[bi].y,
        size: fib * u,
        rotation: s.kind === 'circle' ? 0 : Math.round(s.rotation / 45) * 45,
        color: hexToRgb(resolveColor(s, settings)),
        alpha: s.alpha,
      },
    })
  }

  // 3: 視覚的重みによる重心バランス (反転・シフト・サイズ段階変更)
  balance(working, W, H, u, anchorId)

  // 4: 背景との対比補正
  for (const w of working) {
    w.v.color = ittenAdjust(w.v.color, bg, w.s.contrast)
    out.set(w.s.id, w.v)
  }
  return out
}

function balance(
  items: { s: Shape; v: Visual; fib: number }[],
  W: number,
  H: number,
  u: number,
  anchorId: string | null,
) {
  if (items.length < 2) return
  const cx = W / 2
  const cy = H / 2
  const tol = 0.02 * Math.min(W, H)
  const mirrored = new Set<string>()
  const resized = new Set<string>()

  let M = 0
  let MX = 0
  let MY = 0
  const masses = items.map((it) => visualMass(it.s.kind, it.v))
  items.forEach((it, i) => {
    M += masses[i]
    MX += masses[i] * it.v.x
    MY += masses[i] * it.v.y
  })
  if (M <= 0) return

  for (let iter = 0; iter < items.length * 2 + 4; iter++) {
    const dx = MX / M - cx
    const dy = MY / M - cy
    const err = Math.hypot(dx, dy)
    if (err < tol) return

    let best: { i: number; x: number; y: number; fib: number; m: number; err: number } | null = null
    items.forEach((it, i) => {
      if (it.s.id === anchorId) return
      const m0 = masses[i]
      const cands: { x: number; y: number; fib: number }[] = []
      if (!mirrored.has(it.s.id)) {
        cands.push({ x: W - it.v.x, y: it.v.y, fib: it.fib })
        cands.push({ x: it.v.x, y: H - it.v.y, fib: it.fib })
        cands.push({ x: W - it.v.x, y: H - it.v.y, fib: it.fib })
      }
      if (!resized.has(it.s.id)) {
        const heavySide = (it.v.x - cx) * dx + (it.v.y - cy) * dy > 0
        cands.push({ x: it.v.x, y: it.v.y, fib: fibStep(it.fib, heavySide ? -1 : 1) })
      }
      for (const c of cands) {
        const m1 = visualMass(it.s.kind, { ...it.v, size: c.fib * u })
        const nM = M - m0 + m1
        const nx = (MX - m0 * it.v.x + m1 * c.x) / nM - cx
        const ny = (MY - m0 * it.v.y + m1 * c.y) / nM - cy
        const e = Math.hypot(nx, ny)
        if (!best || e < best.err) best = { i, ...c, m: m1, err: e }
      }
    })
    if (!best) return
    const b = best as { i: number; x: number; y: number; fib: number; m: number; err: number }
    if (b.err > err - 1) return

    const it = items[b.i]
    if (b.fib !== it.fib) resized.add(it.s.id)
    else mirrored.add(it.s.id)
    M += b.m - masses[b.i]
    MX += b.m * b.x - masses[b.i] * it.v.x
    MY += b.m * b.y - masses[b.i] * it.v.y
    masses[b.i] = b.m
    it.v.x = b.x
    it.v.y = b.y
    it.fib = b.fib
    it.v.size = b.fib * u
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}
