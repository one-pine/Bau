import { describe, expect, it } from 'vitest'
import {
  centerOfMass,
  colorWeight,
  computeLayout,
  FIB,
  gridFractions,
  ittenAdjust,
  KANDINSKY,
  snapFib,
  snapPoints,
} from './bauhaus'
import { contrastRatio, hexToRgb } from './color'
import type { Settings, Shape } from './types'

const settings: Settings = {
  mode: 'order',
  grid: '8',
  showGrid: true,
  correspondence: true,
  background: '#f2eee3',
  blend: 'normal',
  symmetry: false,
  folds: 4,
  mirror: true,
  flow: false,
  chaosSeed: 1,
}

const shape = (p: Partial<Shape>): Shape => ({
  id: Math.random().toString(36).slice(2),
  kind: 'circle',
  x: 0.5,
  y: 0.5,
  size: 50,
  rotation: 0,
  color: '#141414',
  colorLocked: false,
  alpha: 1,
  contrast: 0,
  seed: 1,
  ...p,
})

describe('fibonacci sizing', () => {
  it('snaps to the nearest Fibonacci size', () => {
    expect(snapFib(50)).toBe(55)
    expect(snapFib(17)).toBe(21)
    expect(snapFib(1)).toBe(8)
    expect(snapFib(9999)).toBe(233)
  })
})

describe('grid', () => {
  it('8×8 has 7 inner lines', () => {
    expect(gridFractions('8')).toHaveLength(7)
  })
  it('golden grid is symmetric and uses 1/φ', () => {
    const g = gridFractions('golden')
    expect(g.some((f) => Math.abs(f - 0.618034) < 1e-5)).toBe(true)
    g.forEach((f) => expect(g.some((h) => Math.abs(h - (1 - f)) < 1e-9)).toBe(true))
  })
  it('marks diagonal points', () => {
    expect(snapPoints(100, 100, '8').filter((p) => p.diagonal)).toHaveLength(13)
  })
})

describe('Kandinsky weight', () => {
  it('orders blue > red > yellow', () => {
    const w = (k: keyof typeof KANDINSKY) => colorWeight(hexToRgb(KANDINSKY[k]))
    expect(w('circle')).toBeGreaterThan(w('square'))
    expect(w('square')).toBeGreaterThan(w('triangle'))
  })
})

describe('Itten contrast', () => {
  it('fixes a colour that vanishes into the background', () => {
    const bg = hexToRgb('#121212')
    const fixed = ittenAdjust(hexToRgb('#141414'), bg, 0)
    expect(contrastRatio(fixed, bg)).toBeGreaterThanOrEqual(1.35)
  })
  it('stronger contrast setting demands a stronger ratio', () => {
    const bg = hexToRgb('#f2eee3')
    const fixed = ittenAdjust(hexToRgb('#f2c230'), bg, 1)
    expect(contrastRatio(fixed, bg)).toBeGreaterThanOrEqual(5)
  })
})

describe('computeLayout', () => {
  const W = 800
  const H = 800

  it('places every shape on a grid point with a Fibonacci size', () => {
    const shapes = [shape({ x: 0.13, y: 0.2, size: 40 }), shape({ x: 0.77, y: 0.61, size: 100, kind: 'square' })]
    const out = computeLayout(shapes, settings, W, H, null)
    const fr = gridFractions('8').map((f) => f * W)
    for (const v of out.values()) {
      expect(fr.some((g) => Math.abs(g - v.x) < 1e-6)).toBe(true)
      expect(fr.some((g) => Math.abs(g - v.y) < 1e-6)).toBe(true)
      expect(FIB).toContain(v.size / 2)
    }
  })

  it('applies Kandinsky colours unless locked', () => {
    const a = shape({ kind: 'triangle' })
    const b = shape({ kind: 'triangle', color: '#2e7d4f', colorLocked: true, x: 0.2 })
    const out = computeLayout([a, b], settings, W, H, null)
    expect(contrastRatio(out.get(a.id)!.color, hexToRgb(KANDINSKY.triangle))).toBeLessThan(1.1)
    expect(contrastRatio(out.get(b.id)!.color, hexToRgb('#2e7d4f'))).toBeLessThan(1.1)
  })

  it('does not stack shapes on one point while free points remain', () => {
    const shapes = Array.from({ length: 5 }, (_, i) => shape({ x: 0.5 + i * 0.001, y: 0.5 }))
    const out = computeLayout(shapes, settings, W, H, null)
    const keys = new Set([...out.values()].map((v) => `${v.x},${v.y}`))
    expect(keys.size).toBe(5)
  })

  it('pulls the visual centre of mass towards the middle', () => {
    // 全部を左上に寄せて置く → バランス調整で重心が中央に近づくはず
    const shapes = [
      shape({ x: 0.1, y: 0.1, size: 144, kind: 'circle' }),
      shape({ x: 0.2, y: 0.15, size: 89, kind: 'square' }),
      shape({ x: 0.15, y: 0.25, size: 55, kind: 'triangle' }),
      shape({ x: 0.3, y: 0.1, size: 34, kind: 'circle' }),
    ]
    const naive = computeLayout(shapes, { ...settings, mode: 'order' }, W, H, shapes[0].id)
    const com = centerOfMass(shapes.map((s) => ({ kind: s.kind, v: naive.get(s.id)! })))!
    const before = Math.hypot(0.15 * W - W / 2, 0.15 * H - H / 2)
    const after = Math.hypot(com.x - W / 2, com.y - H / 2)
    expect(after).toBeLessThan(before * 0.5)
    // アンカーは動かさない（最寄りのグリッド点に留まる）
    expect(naive.get(shapes[0].id)!.x).toBe(W / 8)
  })

  it('chaos mode is deterministic for the same seed', () => {
    const shapes = [shape({}), shape({ x: 0.3, seed: 42 })]
    const a = computeLayout(shapes, { ...settings, mode: 'chaos' }, W, H, null)
    const b = computeLayout(shapes, { ...settings, mode: 'chaos' }, W, H, null)
    expect([...a.values()]).toEqual([...b.values()])
  })
})
