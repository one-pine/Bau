/**
 * レイアウト・ソルバー
 *
 * 1. 色の段（palette.ts）：形と色の対応 → 背景との対比補正 → イッテンの対比モード → 色調（位置に依存しない）
 * 2. 初期配置：各図形を、ルールのコストが最も低いグリッド点へ順に置く（貪欲法）
 * 3. 局所探索：図形を 1 つずつ「近くの交点へ移す／反転する／フィボナッチ 1 段変える／90° 回す／ほかの図形と入れ替える」を試し、
 *    重み付きコストの合計が下がる手を採用する。改善がなくなるまで繰り返す
 *
 * 直前に操作された図形（anchor）は動かさない。ほかの図形が連鎖的に動いて全体を整える。
 */
import { FIB, mulberry32, snapFib, snapPoints, unitPx, visualMass, type SnapPoint } from './bauhaus'
import { clampApex } from './geometry'
import { deriveChildren } from './groups'
import { resolveColors } from './palette'
import {
  DEFAULT_WEIGHTS,
  NO_INSETS,
  RULES,
  balanceTarget,
  makeItem,
  orientation,
  perceivedCenter,
  type Insets,
  type Item,
  type RuleContext,
} from './rules'
import type { RGB, RuleId, Settings, Shape, Visual } from './types'

export interface RuleReport {
  /** 重みを掛ける前のコスト */
  raw: number
  /** 重みを掛けたコスト */
  weighted: number
}

export interface LayoutResult {
  visuals: Map<string, Visual>
  /** 秩序モードのときだけ。ルールごとのコスト（理論ガイド・指揮者が使う） */
  report: {
    total: number
    rules: Record<RuleId, RuleReport>
    /** 局所探索で採用した手の数 */
    moves: number
    /** 知覚上の重心と均衡の目標点（px） */
    center: { x: number; y: number } | null
    target: { x: number; y: number } | null
  } | null
}

const NEIGHBORS = 8
const MAX_SWEEPS = 8
/** 候補の評価回数の上限。時間ではなく回数で打ち切るので結果は常に同じになる */
const EVAL_BUDGET = 12000
const EPS = 1e-6

export function solveLayout(
  shapes: Shape[],
  settings: Settings,
  W: number,
  H: number,
  anchorId: string | null,
  insets: Insets = NO_INSETS,
): LayoutResult {
  const visuals = new Map<string, Visual>()
  if (W <= 0 || H <= 0) return { visuals, report: null }
  const u = unitPx(W, H)

  if (settings.mode === 'chaos') {
    // カオスでは理論を外す（ユーザーの色そのまま）。ただし色調（モノトーン）は保つ
    const colors = resolveColors(shapes, settings, { theory: false })
    shapes.forEach((s, i) => {
      if (s.parent) return
      const r = mulberry32(s.seed ^ settings.chaosSeed)
      visuals.set(s.id, {
        x: clamp(s.x + (r() - 0.5) * 0.5, 0.04, 0.96) * W,
        y: clamp(s.y + (r() - 0.5) * 0.5, 0.04, 0.96) * H,
        size: s.size * (0.5 + r() * 1.2) * u,
        rotation: s.rotation + (r() - 0.5) * 140,
        color: colors[i],
        alpha: s.alpha * (0.65 + r() * 0.35),
        apex: clampApex((s.apex ?? 60) + (r() - 0.5) * 60),
      })
    })
    deriveChildren(shapes, visuals, colorMap(shapes, colors))
    return { visuals, report: null }
  }

  const points = snapPoints(W, H, settings.grid)
  const ctx: RuleContext = { W, H, minDim: Math.min(W, H), points, settings, insets }
  const weights = { ...DEFAULT_WEIGHTS, ...settings.weights }
  // 対比モード「面積」のときは、面積の対比ルールを有効にする（ふだんは大きさを変えないよう 0）
  if (settings.contrastMode === 'extension') weights.extension = Math.max(weights.extension, 1.5)
  const local = RULES.filter((r) => r.kind === 'local' && weights[r.id] > 0)
  const global = RULES.filter((r) => r.kind === 'global' && weights[r.id] > 0)
  const neighbors = buildNeighbors(points)
  const mirrorOf = buildMirrors(points, W, H)

  // 1. 色の段
  const colors = resolveColors(shapes, settings, { theory: true })
  // グループの子はレイアウトの対象にしない（親に付いて動く）
  const roots = shapes.flatMap((s, i) => (s.parent ? [] : [{ s, i }]))
  const items: Item[] = roots.map(({ s, i }) => {
    const color = colors[i]
    const fib = FIB.indexOf(snapFib(s.size))
    return makeItem(s, {
      rawX: s.x * W,
      rawY: s.y * H,
      rawFib: fib,
      point: 0,
      fib,
      x: 0,
      y: 0,
      size: FIB[fib] * u,
      rotation: s.kind === 'circle' ? 0 : Math.round(s.rotation / 45) * 45,
      rawRotation: s.kind === 'circle' ? 0 : Math.round(s.rotation / 45) * 45,
      apex: clampApex(s.apex),
      color,
      alpha: s.alpha,
      anchor: s.id === anchorId,
    })
  })

  // グループの重さ：親の上に重なって描かれる子（オマージュの内側の正方形）は数えず、
  // 離れて並ぶ子（散歩する線の線分）の重さは親に足す
  for (const it of items) {
    let extra = 0
    shapes.forEach((c, ci) => {
      if (c.parent !== it.shape.id || !c.rel || c.rel.light !== undefined) return
      extra += visualMass(c.kind, { size: c.rel.scale, color: colors[ci], alpha: c.alpha, apex: c.apex })
    })
    it.massCoef += extra
  }

  const place = (it: Item, point: number, fib: number) => {
    it.point = point
    it.fib = fib
    it.x = points[point].x
    it.y = points[point].y
    it.size = FIB[fib] * u
  }

  /** 図形 i が関わるローカル項（unary ＋ ほかの図形との pair）の重み付き合計 */
  const localTerms = (i: number, among: Item[]) => {
    const it = among[i]
    let c = 0
    for (const r of local) {
      if (r.kind !== 'local') continue
      const w = weights[r.id]
      if (r.unary) c += w * r.unary(it, ctx)
      if (r.pair) for (let j = 0; j < among.length; j++) if (j !== i) c += w * r.pair(it, among[j], ctx)
    }
    return c
  }
  const globalCost = (among: Item[]) => {
    let c = 0
    for (const r of global) if (r.kind === 'global') c += weights[r.id] * r.cost(among, ctx)
    return c
  }

  // 2. 初期配置（アンカーを先に、その後は配列順）
  const order = [...items.keys()].sort((a, b) => Number(items[b].anchor) - Number(items[a].anchor))
  const placed: Item[] = []
  for (const i of order) {
    const it = items[i]
    placed.push(it)
    const k = placed.length - 1
    let best = 0
    let bestC = Infinity
    for (let p = 0; p < points.length; p++) {
      place(it, p, it.rawFib)
      const c = localTerms(k, placed)
      if (c < bestC) {
        bestC = c
        best = p
      }
    }
    place(it, best, it.rawFib)
  }

  // 3. 局所探索
  let moves = 0
  let evals = 0
  search: for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    let improved = false
    for (let i = 0; i < items.length; i++) {
      if (evals > EVAL_BUDGET) break search
      const it = items[i]
      if (it.anchor) continue
      const p0 = it.point
      const f0 = it.fib
      const localBefore = localTerms(i, items)
      const globalBefore = globalCost(items)
      const before = localBefore + globalBefore
      const r0 = it.rotation
      const cands: [number, number, number][] = []
      for (const p of neighbors[p0]) cands.push([p, f0, r0])
      for (const p of mirrorOf[p0]) cands.push([p, f0, r0])
      if (f0 > 0) cands.push([p0, f0 - 1, r0])
      if (f0 < FIB.length - 1) cands.push([p0, f0 + 1, r0])
      // 向きを持つ形（線・楕円・台形・細長い三角形）は 90° 回す手も試す（方向の対比のため）
      if (orientation(it).e >= 0.15) cands.push([p0, f0, r0 + 90], [p0, f0, r0 - 90])

      let best: [number, number, number] | null = null
      let bestDelta = -EPS
      for (const [p, f, r] of cands) {
        evals++
        place(it, p, f)
        it.rotation = r
        const delta = localTerms(i, items) + globalCost(items) - before
        if (delta < bestDelta) {
          bestDelta = delta
          best = [p, f, r]
        }
      }
      it.rotation = r0
      place(it, p0, f0)

      // 入れ替え：2 つの図形の位置を交換する（重いものを下げつつ重心を保つ、といった協調した動き）
      let swapWith = -1
      for (let j = 0; j < items.length; j++) {
        const other = items[j]
        // 同じ形・同じ大きさとの入れ替えは意味がないので省く
        if (j === i || other.anchor || other.point === p0 || (other.kind === it.kind && other.fib === f0)) continue
        evals += 2
        const q0 = other.point
        const before2 = localBefore + localTerms(j, items) + globalBefore
        place(it, q0, f0)
        place(other, p0, other.fib)
        const delta = localTerms(i, items) + localTerms(j, items) + globalCost(items) - before2
        place(other, q0, other.fib)
        place(it, p0, f0)
        if (delta < bestDelta) {
          bestDelta = delta
          swapWith = j
          best = null
        }
      }

      if (swapWith >= 0) {
        const other = items[swapWith]
        const q0 = other.point
        place(it, q0, f0)
        place(other, p0, other.fib)
      } else if (best) {
        place(it, best[0], best[1])
        it.rotation = best[2]
      }
      if (swapWith >= 0 || best) {
        moves++
        improved = true
      }
    }
    if (!improved) break
  }

  // 回された直線は「線の温度」の色を新しい向きで塗り直す
  const turned = items.filter((it) => it.kind === 'line' && it.rotation !== it.rawRotation)
  if (turned.length) {
    const rotated = shapes.map((s) => {
      const it = turned.find((t) => t.shape.id === s.id)
      return it ? { ...s, rotation: it.rotation } : s
    })
    const recolored = resolveColors(rotated, settings, { theory: true })
    for (const it of turned) {
      const idx = shapes.findIndex((s) => s.id === it.shape.id)
      it.color = recolored[idx]
      colors[idx] = recolored[idx]
    }
  }

  for (const it of items) {
    visuals.set(it.shape.id, {
      x: it.x,
      y: it.y,
      size: it.size,
      rotation: it.rotation,
      color: it.color,
      alpha: it.alpha,
      apex: it.apex,
    })
  }
  deriveChildren(shapes, visuals, colorMap(shapes, colors))
  return { visuals, report: buildReport(items, ctx, weights, moves) }
}

/** 互換用：目標状態だけを返す */
export function computeLayout(shapes: Shape[], settings: Settings, W: number, H: number, anchorId: string | null) {
  return solveLayout(shapes, settings, W, H, anchorId).visuals
}

function buildReport(items: Item[], ctx: RuleContext, weights: Record<RuleId, number>, moves: number): LayoutResult['report'] {
  const rules = {} as Record<RuleId, { raw: number; weighted: number }>
  let total = 0
  for (const r of RULES) {
    let raw = 0
    if (r.kind === 'global') raw = r.cost(items, ctx)
    else {
      for (let i = 0; i < items.length; i++) {
        if (r.unary) raw += r.unary(items[i], ctx)
        if (r.pair) for (let j = i + 1; j < items.length; j++) raw += r.pair(items[i], items[j], ctx)
      }
    }
    const weighted = raw * (weights[r.id] ?? 0)
    rules[r.id] = { raw, weighted }
    total += weighted
  }
  const center = items.length ? perceivedCenter(items, ctx.W, ctx.H) : null
  const target = center ? balanceTarget(center, ctx.W, ctx.H, ctx.settings.dynamism, ctx.settings.tension) : null
  return { total, rules, moves, center: center && { x: center.x, y: center.y }, target }
}

function buildNeighbors(points: SnapPoint[]): number[][] {
  return points.map((p, i) =>
    points
      .map((q, j) => ({ j, d: Math.hypot(p.x - q.x, p.y - q.y) }))
      .filter((e) => e.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, NEIGHBORS)
      .map((e) => e.j),
  )
}

/** 左右・上下・点対称の反転先。グリッドは対称なので、反転先も必ずグリッド点になる */
function buildMirrors(points: SnapPoint[], W: number, H: number): number[][] {
  const key = (x: number, y: number) => `${Math.round(x * 100)},${Math.round(y * 100)}`
  const index = new Map(points.map((p, i) => [key(p.x, p.y), i]))
  return points.map((p, i) =>
    [key(W - p.x, p.y), key(p.x, H - p.y), key(W - p.x, H - p.y)]
      .map((k) => index.get(k))
      .filter((j): j is number => j !== undefined && j !== i),
  )
}

function colorMap(shapes: Shape[], colors: RGB[]) {
  return new Map(shapes.map((s, i) => [s.id, colors[i]]))
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}
