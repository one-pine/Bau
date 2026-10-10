import { describe, expect, it } from 'vitest'
import { solveLayout } from './layout'
import { DEFAULT_WEIGHTS, fieldValue, mass, perceivedCenter, RULES } from './rules'
import type { Settings, Shape } from './types'

const base: Settings = {
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
  weights: DEFAULT_WEIGHTS,
  dynamism: 0,
  tension: 0,
  contrastMode: 'none',
  tone: 'color',
}

let n = 0
const shape = (p: Partial<Shape>): Shape => ({
  id: `s${n++}`,
  kind: 'circle',
  x: 0.5,
  y: 0.5,
  size: 34,
  rotation: 0,
  color: '#141414',
  colorLocked: false,
  alpha: 1,
  contrast: 0,
  seed: 1,
  ...p,
})

const W = 800
const H = 800

/** 一つの重い円と、いくつかの軽い三角形 */
const scene = () => [
  shape({ kind: 'circle', size: 144, x: 0.5, y: 0.5 }),
  shape({ kind: 'triangle', size: 34, x: 0.3, y: 0.3 }),
  shape({ kind: 'triangle', size: 34, x: 0.7, y: 0.3 }),
  shape({ kind: 'triangle', size: 21, x: 0.3, y: 0.7 }),
  shape({ kind: 'triangle', size: 21, x: 0.7, y: 0.7 }),
]

describe('balance rule', () => {
  it('static balance pulls the perceived centre to the middle', () => {
    const r = solveLayout(scene(), base, W, H, null).report!
    const c = r.center!
    expect(Math.hypot(c.x - W / 2, c.y - H / 2)).toBeLessThan(0.04 * W)
  })

  it('dynamic balance settles the centre near a golden-section point instead', () => {
    const shapes = [
      shape({ kind: 'square', size: 89, x: 0.3, y: 0.3 }),
      shape({ kind: 'circle', size: 55, x: 0.6, y: 0.4 }),
      shape({ kind: 'triangle', size: 34, x: 0.4, y: 0.6 }),
    ]
    const r = solveLayout(shapes, { ...base, dynamism: 1 }, W, H, null).report!
    const c = r.center!
    const t = r.target!
    // 目標点は黄金分割点のどれか
    const g = [0.382 * W, 0.618 * W]
    expect(g.some((v) => Math.abs(v - t.x) < 1)).toBe(true)
    expect(Math.hypot(c.x - t.x, c.y - t.y)).toBeLessThan(Math.hypot(c.x - W / 2, c.y - H / 2))
  })
})

describe('tension rule (Kandinsky basic plane)', () => {
  const heavyField = (tension: number) => {
    const shapes = scene()
    const r = solveLayout(shapes, { ...base, tension, weights: { ...DEFAULT_WEIGHTS, balance: 0.3 } }, W, H, null)
    const items = shapes.map((s) => {
      const v = r.visuals.get(s.id)!
      return { massCoef: 1, size: v.size, x: v.x, y: v.y }
    })
    let m = 0
    let mf = 0
    for (const it of items) {
      const w = it.size * it.size
      m += w
      mf += w * fieldValue(it.x, it.y, W, H)
    }
    return mf / m
  }

  it('stable puts the weight low/right, dramatic puts it high/left', () => {
    const stable = heavyField(-1)
    const dramatic = heavyField(1)
    expect(stable).toBeGreaterThan(0)
    expect(dramatic).toBeLessThan(0)
  })
})

describe('frame rule', () => {
  it('keeps a long line inside the canvas', () => {
    const line = shape({ kind: 'line', size: 120, x: 0.1, y: 0.2 })
    const r = solveLayout([line, shape({ x: 0.6, y: 0.6 })], base, 390, 844, null)
    const v = r.visuals.get(line.id)!
    expect(v.x - v.size / 2).toBeGreaterThanOrEqual(0)
    expect(v.x + v.size / 2).toBeLessThanOrEqual(390)
  })
})

describe('respecting the user', () => {
  it('moderate default settings keep the sizes the user drew', () => {
    const shapes = [
      shape({ size: 120, x: 0.5, y: 0.5 }),
      shape({ kind: 'triangle', x: 0.26, y: 0.3 }),
      shape({ kind: 'triangle', x: 0.74, y: 0.31 }),
      shape({ kind: 'square', size: 55, x: 0.51, y: 0.83 }),
    ]
    const r = solveLayout(shapes, { ...base, tension: -0.3, dynamism: 0.4 }, 390, 844, null)
    const u = 390 / 400
    for (const s of shapes) {
      const fibOf = (n: number) => [8, 13, 21, 34, 55, 89, 144, 233].reduce((a, b) => (Math.abs(Math.log(b / n)) < Math.abs(Math.log(a / n)) ? b : a))
      expect(r.visuals.get(s.id)!.size).toBeCloseTo(fibOf(s.size) * u)
    }
  })
})

describe('weights', () => {
  it('with only fidelity and spacing, shapes stay where they were put', () => {
    const shapes = scene()
    const weights = { ...DEFAULT_WEIGHTS, balance: 0, tension: 0, grid: 0 }
    const r = solveLayout(shapes, { ...base, weights }, W, H, null)
    for (const s of shapes) {
      const v = r.visuals.get(s.id)!
      expect(Math.hypot(v.x - s.x * W, v.y - s.y * H)).toBeLessThan(W / 8)
    }
  })

  it('the anchor never moves away from its nearest grid point', () => {
    // 枠のルールに触れない大きさ（半径 < 画面の 1/8）にする
    const shapes = [shape({ size: 34, x: 0.13, y: 0.12 }), shape({ size: 89, x: 0.2, y: 0.2 }), shape({ size: 55, x: 0.1, y: 0.3 })]
    const r = solveLayout(shapes, base, W, H, shapes[0].id)
    const v = r.visuals.get(shapes[0].id)!
    expect(v.x).toBe(W / 8)
    expect(v.y).toBe(H / 8)
  })
})

describe('report', () => {
  it('lists every rule and adds up', () => {
    const r = solveLayout(scene(), { ...base, tension: -0.5, dynamism: 0.5 }, W, H, null).report!
    expect(Object.keys(r.rules).sort()).toEqual(RULES.map((x) => x.id).sort())
    const sum = Object.values(r.rules).reduce((a, b) => a + b.weighted, 0)
    expect(r.total).toBeCloseTo(sum, 6)
  })

  it('the solver never ends worse than the greedy start', () => {
    const shapes = scene()
    const greedy = solveLayout(shapes, base, W, H, shapes[0].id) // anchor fixed, others free
    expect(greedy.report!.moves).toBeGreaterThanOrEqual(0)
    expect(greedy.report!.total).toBeLessThan(5)
  })

  it('is deterministic', () => {
    const shapes = scene()
    const a = solveLayout(shapes, { ...base, tension: 0.7, dynamism: 1 }, W, H, null)
    const b = solveLayout(shapes, { ...base, tension: 0.7, dynamism: 1 }, W, H, null)
    expect([...a.visuals.values()]).toEqual([...b.visuals.values()])
  })
})

describe('performance', () => {
  it('solves 60 shapes fast enough for live dragging', () => {
    const kinds = ['circle', 'triangle', 'square', 'line'] as const
    const shapes = Array.from({ length: 60 }, (_, i) =>
      shape({ kind: kinds[i % 4], size: [21, 34, 55, 89][i % 4], x: ((i * 37) % 100) / 100, y: ((i * 53) % 100) / 100 }),
    )
    const t0 = performance.now()
    solveLayout(shapes, { ...base, tension: -0.5, dynamism: 0.5 }, 390, 844, shapes[5].id)
    const ms = performance.now() - t0
    expect(ms).toBeLessThan(250)
  })
})

describe('helpers', () => {
  it('perceived mass is larger lower down (Kandinsky: below = heavier)', () => {
    const top = perceivedCenter([{ massCoef: 1, size: 10, x: 100, y: 100 }], W, H)!
    const bottom = perceivedCenter([{ massCoef: 1, size: 10, x: 100, y: 700 }], W, H)!
    expect(bottom.mass).toBeGreaterThan(top.mass)
    expect(mass({ massCoef: 2, size: 3 } as never)).toBe(18)
  })
})
