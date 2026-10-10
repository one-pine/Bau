import { describe, expect, it } from 'vitest'
import {
  deriveChild,
  familyIds,
  HOMAGE_LEVELS,
  homageRelations,
  reflectPoint,
  reflectRotation,
  rootOf,
  segmentsToRelations,
  sideOf,
  walkPath,
} from './groups'
import { solveLayout } from './layout'
import { ACCENT_TARGET, DEFAULT_WEIGHTS, directionBalance, grammarDeviation } from './rules'
import type { Settings, Shape, Visual } from './types'

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
  flowStyle: 'energy',
}

let n = 0
const shape = (p: Partial<Shape>): Shape => ({
  id: `g${n++}`,
  kind: 'square',
  x: 0.5,
  y: 0.5,
  size: 89,
  rotation: 0,
  color: '#d7261e',
  colorLocked: false,
  alpha: 1,
  contrast: 0,
  seed: 1,
  ...p,
})

const parentV: Visual = { x: 100, y: 100, size: 50, rotation: 0, color: [200, 40, 30], alpha: 1, apex: 60 }

describe('groups', () => {
  it('children follow the parent through moves, scale and rotation', () => {
    const rel = { dx: 1, dy: 0, scale: 0.5, rot: 10 }
    const a = deriveChild(parentV, rel)
    expect(a.x).toBeCloseTo(150)
    expect(a.size).toBe(25)
    const turned = deriveChild({ ...parentV, rotation: 90 }, rel)
    expect(turned.x).toBeCloseTo(100)
    expect(turned.y).toBeCloseTo(150)
    expect(turned.rotation).toBe(100)
  })

  it('finds the family and the root', () => {
    const p = shape({})
    const c1 = shape({ parent: p.id, rel: { dx: 0, dy: 0, scale: 0.5, rot: 0 } })
    const c2 = shape({ parent: c1.id, rel: { dx: 0, dy: 0, scale: 0.5, rot: 0 } })
    const other = shape({})
    expect(familyIds([p, c1, c2, other], p.id)).toEqual([p.id, c1.id, c2.id])
    expect(rootOf([p, c1, c2, other], c2.id)).toBe(p.id)
  })

  it('the solver lays out only the parent and the children stay attached', () => {
    const p = shape({ x: 0.31, y: 0.33 })
    const kids = homageRelations().map((rel) => shape({ parent: p.id, rel }))
    const other = shape({ kind: 'circle', size: 55, x: 0.7, y: 0.7 })
    const r = solveLayout([p, ...kids, other], base, 800, 800, null)
    const pv = r.visuals.get(p.id)!
    kids.forEach((k, i) => {
      const v = r.visuals.get(k.id)!
      expect(v.size).toBeCloseTo(pv.size * HOMAGE_LEVELS[i].scale)
      expect(v.y).toBeGreaterThan(pv.y) // 内側ほど下へ
    })
    expect(r.report!.rules.spacing).toBeDefined()
  })
})

describe('Albers: homage to the square (N9)', () => {
  it('uses the 1:2:3 margins (bottom : side : top) on a 10-unit module', () => {
    // 外側の幅を 10 とすると、各段の余白は 下 0.5 : 横 1 : 上 1.5
    let prev = { scale: 1, dy: 0 }
    for (const l of HOMAGE_LEVELS) {
      const side = ((prev.scale - l.scale) / 2) * 10
      const bottom = ((prev.scale / 2 + prev.dy) - (l.scale / 2 + l.dy)) * 10
      const top = ((l.dy - l.scale / 2) - (prev.dy - prev.scale / 2)) * 10
      expect(side).toBeCloseTo(1)
      expect(bottom).toBeCloseTo(0.5)
      expect(top).toBeCloseTo(1.5)
      prev = l
    }
  })

  it('inner squares get progressively lighter', () => {
    const p = shape({ x: 0.5, y: 0.5 })
    const kids = homageRelations().map((rel) => shape({ parent: p.id, rel }))
    const r = solveLayout([p, ...kids], base, 800, 800, null)
    const lum = (id: string) => r.visuals.get(id)!.color.reduce((a, b) => a + b, 0)
    expect(lum(kids[0].id)).toBeGreaterThan(lum(p.id))
    expect(lum(kids[2].id)).toBeGreaterThan(lum(kids[1].id))
  })
})

describe('Klee: walking line (N14)', () => {
  it('is a continuous path of 45°-step segments, deterministic per seed', () => {
    const a = walkPath(100, 100, 10, 1, 42)
    const b = walkPath(100, 100, 10, 1, 42)
    expect(a).toEqual(b)
    expect(a[0].rotation).toBe(0)
    for (let i = 0; i < a.length; i++) {
      expect(Math.abs(a[i].rotation % 45)).toBe(0)
      if (i > 0) {
        const end = (s: (typeof a)[0], k: 1 | -1) => ({
          x: s.x + (k * Math.cos((s.rotation * Math.PI) / 180) * s.length) / 2,
          y: s.y + (k * Math.sin((s.rotation * Math.PI) / 180) * s.length) / 2,
        })
        const prevEnd = end(a[i - 1], 1)
        const start = end(a[i], -1)
        expect(prevEnd.x).toBeCloseTo(start.x)
        expect(prevEnd.y).toBeCloseTo(start.y)
      }
    }
    expect(walkPath(100, 100, 10, 1, 7)).not.toEqual(a)
  })

  it('relations rebuild the same segments from the first one', () => {
    const segs = walkPath(200, 300, 45, 2, 3)
    const rels = segmentsToRelations(segs)
    const p: Visual = { ...parentV, x: segs[0].x, y: segs[0].y, size: segs[0].length, rotation: segs[0].rotation }
    rels.forEach((rel, i) => {
      const v = deriveChild(p, rel)
      expect(v.x).toBeCloseTo(segs[i + 1].x)
      expect(v.y).toBeCloseTo(segs[i + 1].y)
      expect(v.size).toBeCloseTo(segs[i + 1].length)
    })
  })
})

describe('Albers: fold (N24)', () => {
  it('reflects points and orientations across the fold line', () => {
    expect(reflectPoint(10, 5, 0, 0, 20, 0)).toEqual({ x: 10, y: -5 })
    const p = reflectPoint(3, 0, 0, 0, 10, 10) // y = x の直線
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(3)
    expect(reflectRotation(0, 0)).toBe(180) // 上向きの三角形を水平線で折ると下向き
    expect(sideOf(0, -5, 0, 0, 10, 0)).toBe(-sideOf(0, 5, 0, 0, 10, 0))
  })
})

describe('Hartwig: form grammar (N16)', () => {
  const at = (kind: Shape['kind'], dx: number, dy: number, rotation = 0) =>
    grammarDeviation({ kind, x: 100 + dx, y: 100 + dy, rawX: 100, rawY: 100, rotation })

  it('squares move like rooks, triangles like bishops, circles freely', () => {
    expect(at('square', 50, 0)).toBe(0)
    expect(at('square', 50, 50)).toBeGreaterThan(0)
    expect(at('triangle', 50, 50)).toBeCloseTo(0)
    expect(at('triangle', 50, 0)).toBeGreaterThan(0)
    expect(at('circle', 37, 11)).toBe(0)
    expect(at('line', 50, 0, 0)).toBeCloseTo(0)
    expect(at('line', 0, 50, 0)).toBeGreaterThan(0)
  })
})

describe('Brandt: direction contrast (N19)', () => {
  it('measures the share of the minority direction', () => {
    const lines = [0, 0, 0, 90].map((rotation) => ({ kind: 'line' as const, rotation, apex: 60, size: 100 }))
    const d = directionBalance(lines)
    expect(d.accent).toBeCloseTo(0.25)
    expect(directionBalance([{ kind: 'square', rotation: 0, apex: 60, size: 100 }]).count).toBe(0)
  })

  it('turns one line of an all-horizontal composition upright', () => {
    const lines = [0.2, 0.4, 0.6, 0.8].map((y, i) => shape({ kind: 'line', size: 89, x: 0.3 + i * 0.1, y, rotation: 0 }))
    const before = directionBalance(lines.map(() => ({ kind: 'line' as const, rotation: 0, apex: 60, size: 1 })))
    expect(before.accent).toBe(0)
    const r = solveLayout(lines, base, 800, 800, null)
    const after = directionBalance(lines.map((l) => ({ kind: 'line' as const, rotation: r.visuals.get(l.id)!.rotation, apex: 60, size: r.visuals.get(l.id)!.size })))
    expect(Math.abs(after.accent - ACCENT_TARGET)).toBeLessThan(Math.abs(before.accent - ACCENT_TARGET))
    // 回された線は垂直＝暖色（赤系）に塗り直される
    const upright = lines.find((l) => Math.abs(Math.cos((r.visuals.get(l.id)!.rotation * Math.PI) / 180)) < 0.1)!
    const c = r.visuals.get(upright.id)!.color
    expect(c[0]).toBeGreaterThan(c[2])
  })
})

describe('flow keeps groups together', () => {
  it('children move and turn with their root', async () => {
    const { buildOps } = await import('./render')
    const p = shape({ kind: 'square', x: 0.5, y: 0.5, seed: 5 })
    const kid = shape({ parent: p.id, rel: { dx: 0.3, dy: 0, scale: 0.5, rot: 0 }, seed: 99 })
    const visuals = new Map<string, Visual>([
      [p.id, { ...parentV, x: 400, y: 400, size: 100 }],
      [kid.id, { ...parentV, x: 430, y: 400, size: 50 }],
    ])
    for (const flowStyle of ['energy', 'chess'] as const) {
      for (const time of [0.3, 1.1, 2.9, 3.7]) {
        const ops = buildOps({ shapes: [p, kid], visuals, W: 800, H: 800, time, flowAmt: 1, symAmt: 0, folds: 4, mirror: false, flowStyle })
        const [a, b] = ops
        // 親と子の距離は 30px のまま（親が少し拡大縮小する分だけ一緒に伸び縮みする）
        const d = Math.hypot(b.x - a.x, b.y - a.y)
        expect(d).toBeGreaterThan(29.99)
        expect(d).toBeLessThan(30 * 1.09)
        expect(b.rotation - a.rotation).toBeCloseTo(0, 5)
      }
    }
  })
})

describe('chess flow (N16)', () => {
  it('each move follows the form grammar and returns to its square', async () => {
    const { chessOffset } = await import('./flow')
    for (let t = 0; t < 20; t += 0.37) {
      const sq = chessOffset('square', 0, 11, t, 50, 50)
      expect(Math.min(Math.abs(sq.dx), Math.abs(sq.dy))).toBeCloseTo(0)
      const tri = chessOffset('triangle', 0, 11, t, 50, 50)
      expect(Math.abs(tri.dx)).toBeCloseTo(Math.abs(tri.dy))
    }
    // 2 拍で元の場所へ戻る
    const back = chessOffset('square', 0, 0, 2 * 1.6 - 0.001, 50, 50)
    expect(Math.hypot(back.dx, back.dy)).toBeLessThan(1)
  })
})
