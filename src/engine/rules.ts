/**
 * レイアウト・ルール
 *
 * 各理論を「構図の良くなさ（コスト）」を返す独立したルールとして書く。
 * ソルバー（layout.ts）は、重み付きコストの合計が下がる配置を探す。
 *
 * - LocalRule  … 図形 1 つ（unary）や図形 2 つの組（pair）だけで決まるコスト。差分計算が速い
 * - GlobalRule … 画面全体（重心など）で決まるコスト
 *
 * コストは「0 が理想、1 前後が目に見えてまずい状態」になるよう正規化する。
 */
import { visualMass, type SnapPoint } from './bauhaus'
import { rgbToHsl } from './color'
import { areaFactor, triangleDims } from './geometry'
import type { RGB, RuleId, RuleWeights, Settings, Shape, ShapeKind } from './types'

/** ソルバーが扱う図形 1 つ分の作業状態 */
export interface Item {
  shape: Shape
  kind: ShapeKind
  /** ユーザーが置いた位置（px） */
  rawX: number
  rawY: number
  /** ユーザーが指定した大きさに最も近いフィボナッチ段階 */
  rawFib: number
  /** ユーザーが付けた向き（45° 刻みに丸めたもの） */
  rawRotation: number
  /** 現在のグリッド点とフィボナッチ段階 */
  point: number
  fib: number
  x: number
  y: number
  size: number
  rotation: number
  /** 三角形の頂角（度） */
  apex: number
  color: RGB
  alpha: number
  /** 大きさ 1px あたりの重さ（色の重み × 形の面積係数 × 不透明度） */
  massCoef: number
  /** 直前に操作された図形。ソルバーは動かさない */
  anchor: boolean
}

/** 画面の端のうち、操作パネルなどで隠れる幅（px） */
export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

export interface RuleContext {
  W: number
  H: number
  minDim: number
  points: SnapPoint[]
  settings: Settings
  insets: Insets
}

export interface LocalRule {
  id: RuleId
  kind: 'local'
  label: string
  unary?(it: Item, ctx: RuleContext): number
  pair?(a: Item, b: Item, ctx: RuleContext): number
}

export interface GlobalRule {
  id: RuleId
  kind: 'global'
  label: string
  cost(items: Item[], ctx: RuleContext): number
}

export type Rule = LocalRule | GlobalRule

export const mass = (it: Item) => it.massCoef * it.size * it.size

// ───────────────────────── カンディンスキーの基礎平面

/**
 * 基礎平面上の位置の「重さの場」。下・右ほど正（重く、束縛的）、上・左ほど負（軽く、自由）。
 * カンディンスキー『点と線から面へ』の基礎平面の章（docs/bauhaus-theory.md §1-1）。
 * 上下の差の方が左右より強いとみなし、左右は半分の重みにしている（🛠）。
 */
export function fieldValue(x: number, y: number, W: number, H: number): number {
  return y / H - 0.5 + 0.5 * (x / W - 0.5)
}

/** 同じ形でも下・右にあるほど重く見える度合い */
const FIELD_STRENGTH = 0.4

export function perceivedMass(it: Pick<Item, 'massCoef' | 'size' | 'x' | 'y'>, W: number, H: number): number {
  return it.massCoef * it.size * it.size * (1 + FIELD_STRENGTH * fieldValue(it.x, it.y, W, H))
}

/**
 * 均衡の目標点。dynamism=0 で画面中央、1 で重心のある側の黄金分割点。
 * 緊張が安定側なら少し下へ、劇的側なら少し上へずらす（重いものが下にあれば重心も下がるのが自然なため）。
 */
export function balanceTarget(com: { x: number; y: number }, W: number, H: number, dynamism: number, tension = 0) {
  const g = 1 / ((1 + Math.sqrt(5)) / 2) // 0.618
  const gx = com.x < W / 2 ? (1 - g) * W : g * W
  const gy = com.y < H / 2 ? (1 - g) * H : g * H
  return {
    x: W / 2 + (gx - W / 2) * dynamism,
    y: H / 2 + (gy - H / 2) * dynamism - tension * 0.1 * H,
  }
}

export function perceivedCenter(items: Pick<Item, 'massCoef' | 'size' | 'x' | 'y'>[], W: number, H: number) {
  let m = 0
  let mx = 0
  let my = 0
  for (const it of items) {
    const w = perceivedMass(it, W, H)
    m += w
    mx += w * it.x
    my += w * it.y
  }
  return m > 0 ? { x: mx / m, y: my / m, mass: m } : null
}

// ───────────────────────── ルール本体

/** ユーザーの意図：置いた場所から離れるほど、指定した大きさから変わるほどコスト */
const fidelity: LocalRule = {
  id: 'fidelity',
  kind: 'local',
  label: '意図',
  unary(it, ctx) {
    const dx = it.x - it.rawX
    const dy = it.y - it.rawY
    const d = Math.sqrt(dx * dx + dy * dy) / ctx.minDim
    return d + 0.45 * Math.abs(it.fib - it.rawFib) + 0.25 * (turnBetween(it.rotation, it.rawRotation, it.kind) / 90)
  },
}

/** 2 つの向きの差（度）。直線と楕円は 180° 回すと同じ形なので 90° が最大 */
export function turnBetween(a: number, b: number, kind: ShapeKind): number {
  const period = kind === 'line' || kind === 'ellipse' ? 180 : 360
  const d = (((a - b) % period) + period) % period
  return Math.min(d, period - d)
}

/** E1 モジュール・グリッド：対角線上の交点を好む */
const grid: LocalRule = {
  id: 'grid',
  kind: 'local',
  label: 'グリッド',
  unary(it, ctx) {
    return ctx.points[it.point]?.diagonal ? 0 : 0.05
  },
}

/** 重なりと、同じ交点への集中を避ける。直線は細いので重なりを小さく見積もる */
const spacing: LocalRule = {
  id: 'spacing',
  kind: 'local',
  label: '間隔',
  pair(a, b, ctx) {
    if (a.point === b.point) return 1
    const ra = (a.size / 2) * (a.kind === 'line' ? 0.25 : 1)
    const rb = (b.size / 2) * (b.kind === 'line' ? 0.25 : 1)
    const dx = a.x - b.x
    const dy = a.y - b.y
    const overlap = ra + rb - Math.sqrt(dx * dx + dy * dy)
    return overlap > 0 ? (overlap / ctx.minDim) * 1.5 : 0
  },
}

/** 画面の枠（操作パネルで隠れる部分を除く）からはみ出した分だけコスト。直線は向きに応じた幅・高さで測る */
const frame: LocalRule = {
  id: 'frame',
  kind: 'local',
  label: '枠',
  unary(it, ctx) {
    const h = it.size / 2
    let ex = h
    let ey = h
    if (it.kind === 'line') {
      const a = (it.rotation * Math.PI) / 180
      ex = Math.abs(Math.cos(a)) * h
      ey = Math.abs(Math.sin(a)) * h
    }
    const { top, right, bottom, left } = ctx.insets
    const over =
      Math.max(0, left + ex - it.x) +
      Math.max(0, it.x + ex - (ctx.W - right)) +
      Math.max(0, top + ey - it.y) +
      Math.max(0, it.y + ey - (ctx.H - bottom))
    return (over / ctx.minDim) * 3
  },
}

/** E4/N1 均衡：知覚上の重心を目標点へ（静的＝中央、動的＝黄金分割点） */
const balance: GlobalRule = {
  id: 'balance',
  kind: 'global',
  label: '均衡',
  cost(items, ctx) {
    if (items.length < 2) return 0
    const c = perceivedCenter(items, ctx.W, ctx.H)
    if (!c) return 0
    const t = balanceTarget(c, ctx.W, ctx.H, ctx.settings.dynamism, ctx.settings.tension)
    const dx = c.x - t.x
    const dy = c.y - t.y
    return (Math.sqrt(dx * dx + dy * dy) / ctx.minDim) * 4
  },
}

/**
 * N1 基礎平面の緊張：重いものほど下・右（安定）、または上・左（劇的）に置く。
 * カンディンスキーは「重い形を上、軽い形を下に置くと劇的な緊張が生まれる」と書いている。
 * 重心の位置ではなく「重さと場所の偏り」を測るので、均衡（重心）のルールとは両立できる。
 */
export function tensionScore(items: Pick<Item, 'massCoef' | 'size' | 'x' | 'y'>[], W: number, H: number): number {
  if (items.length < 2) return 0
  let m = 0
  let mf = 0
  let f = 0
  for (const it of items) {
    const w = mass(it as Item)
    const v = fieldValue(it.x, it.y, W, H)
    m += w
    mf += w * v
    f += v
  }
  if (m <= 0) return 0
  // 重さで重み付けした場の値 − 単純平均の場の値。正なら重いものが下・右に寄っている
  return mf / m - f / items.length
}

const tension: GlobalRule = {
  id: 'tension',
  kind: 'global',
  label: '緊張',
  cost(items, ctx) {
    const t = ctx.settings.tension
    if (items.length < 2 || t === 0) return 0
    const want = t < 0 ? 1 : -1 // 安定なら重いものが下・右、劇的なら上・左
    // スコアの実用的な幅はおよそ ±0.3。目標側に 0.3 偏れば 0 になる
    return Math.abs(t) * Math.max(0, 0.3 - want * tensionScore(items, ctx.W, ctx.H)) * 8
  },
}

// ───────────────────────── N6 イッテンの面積の対比

/**
 * ゲーテの明度値から導かれる「調和する面積比」（黄 3 : 橙 4 : 赤 6 : 紫 9 : 青 8 : 緑 6）。
 * 明るい色ほど少ない面積で釣り合う。docs/bauhaus-theory.md §2-2（数値は 🔶 要確認）。
 */
export const GOETHE_AREA = { yellow: 3, orange: 4, red: 6, violet: 9, blue: 8, green: 6 } as const
export type HueFamily = keyof typeof GOETHE_AREA

/** 色相から 6 つの色の系統に分ける。彩度の低い色（灰色）は null */
export function hueFamily(rgb: RGB): HueFamily | null {
  const [h, s] = rgbToHsl(rgb)
  if (s < 0.15) return null
  if (h >= 345 || h < 15) return 'red'
  if (h < 40) return 'orange'
  if (h < 75) return 'yellow'
  if (h < 180) return 'green'
  if (h < 255) return 'blue'
  return 'violet'
}

/** 色の系統ごとの面積の割合と、ゲーテの比率との差（L1 距離）。系統が 2 つ未満なら 0 */
export function extensionError(items: Pick<Item, 'kind' | 'size' | 'apex' | 'color' | 'alpha'>[]): number {
  const area = new Map<HueFamily, number>()
  let total = 0
  for (const it of items) {
    const f = hueFamily(it.color)
    if (!f) continue
    const a = areaFactor(it.kind, it.apex) * it.size * it.size * it.alpha
    area.set(f, (area.get(f) ?? 0) + a)
    total += a
  }
  if (area.size < 2 || total <= 0) return 0
  let ideal = 0
  for (const f of area.keys()) ideal += GOETHE_AREA[f]
  let err = 0
  for (const [f, a] of area) err += Math.abs(a / total - GOETHE_AREA[f] / ideal)
  return err
}

const extension: GlobalRule = {
  id: 'extension',
  kind: 'global',
  label: '面積',
  cost(items) {
    return extensionError(items) * 3
  },
}

// ───────────────────────── N16 ハルトヴィヒの形の文法

/**
 * ハルトヴィヒのチェスセット（1924）では、駒の形がそのまま動き方を表す（docs/bauhaus-theory.md §10-1）。
 * ここでは「置いた場所から動くときの向き」に当てはめる。
 *   □・台形（ルーク）… 縦横にだけ動く
 *   △（ビショップ）… 斜めにだけ動く
 *   ─ … 自分の向きに沿ってだけ動く
 *   ○・球面三角形・楕円（クイーン）… どの向きにも動ける
 * 文法から外れた分（縦横の動きなら斜めの成分）だけコスト。
 */
export function grammarDeviation(it: Pick<Item, 'kind' | 'x' | 'y' | 'rawX' | 'rawY' | 'rotation'>): number {
  const dx = it.x - it.rawX
  const dy = it.y - it.rawY
  switch (it.kind) {
    case 'square':
    case 'trapezoid':
      return Math.min(Math.abs(dx), Math.abs(dy))
    case 'triangle':
      return Math.abs(Math.abs(dx) - Math.abs(dy)) / Math.SQRT2
    case 'line': {
      const r = (it.rotation * Math.PI) / 180
      return Math.abs(-dx * Math.sin(r) + dy * Math.cos(r))
    }
    default:
      return 0
  }
}

const grammar: LocalRule = {
  id: 'grammar',
  kind: 'local',
  label: '文法',
  unary(it, ctx) {
    return (grammarDeviation(it) / ctx.minDim) * 2
  },
}

// ───────────────────────── N19 ブラントの方向の対比

/**
 * 図形の「向き」：細長さ e（0＝向きなし … 1＝線）と、長い方の軸の角度（度）。
 * □・○・球面三角形は向きを持たない。三角形は頂角で縦長（鋭角）にも横長（鈍角）にもなる。
 */
export function orientation(it: Pick<Item, 'kind' | 'rotation' | 'apex'>): { e: number; axis: number } {
  switch (it.kind) {
    case 'line':
      return { e: 1, axis: it.rotation }
    case 'ellipse':
      return { e: 0.5, axis: it.rotation }
    case 'trapezoid':
      return { e: 0.3, axis: it.rotation }
    case 'triangle': {
      const { b, h } = triangleDims(1, it.apex)
      return h > b ? { e: 1 - b / h, axis: it.rotation + 90 } : { e: 1 - h / b, axis: it.rotation }
    }
    default:
      return { e: 0, axis: 0 }
  }
}

/**
 * 水平方向と垂直方向の「量」。ブラントのティーポットでは、水平な胴の量塊に対して取っ手が垂直のアクセントになる
 * （§10-4）。少ない方が全体の 2 割ほどのとき、方向の対比が最も効くとみなす（🛠）。
 */
export function directionBalance(items: Pick<Item, 'kind' | 'rotation' | 'apex' | 'size'>[]) {
  let h = 0
  let v = 0
  let n = 0
  for (const it of items) {
    const { e, axis } = orientation(it)
    if (e < 0.15) continue
    n++
    const c = Math.cos((2 * axis * Math.PI) / 180) // 1＝水平、-1＝垂直、0＝斜め
    const w = e * it.size
    if (c > 0) h += w * c
    else v += w * -c
  }
  const total = h + v
  return { horizontal: h, vertical: v, count: n, accent: total > 0 ? Math.min(h, v) / total : 0 }
}

export const ACCENT_TARGET = 0.2

const direction: GlobalRule = {
  id: 'direction',
  kind: 'global',
  label: '方向',
  cost(items) {
    const d = directionBalance(items)
    if (d.count < 3) return 0
    return Math.abs(d.accent - ACCENT_TARGET) * 3
  },
}

export const RULES: Rule[] = [fidelity, grid, spacing, frame, balance, tension, extension, grammar, direction]

export const DEFAULT_WEIGHTS: RuleWeights = {
  fidelity: 0.6,
  grid: 1,
  spacing: 1,
  frame: 1,
  balance: 1,
  tension: 1,
  // 面積の対比は大きさを変えるので、ふだんは 0。対比モード「面積」で有効になる（layout.ts）
  extension: 0,
  grammar: 0.4,
  direction: 0.5,
}

export const RULE_LABELS: Record<RuleId, string> = Object.fromEntries(RULES.map((r) => [r.id, r.label])) as Record<
  RuleId,
  string
>

/** 描画中の状態（アニメーション途中の値）から、重心と均衡の目標点を求める。天秤の表示に使う */
export function visualBalance(
  entries: { kind: ShapeKind; v: { x: number; y: number; size: number; color: RGB; alpha: number; apex?: number } }[],
  settings: Settings,
  W: number,
  H: number,
) {
  const items = entries.map(({ kind, v }) => ({
    massCoef: visualMass(kind, { size: 1, color: v.color, alpha: v.alpha, apex: v.apex }),
    size: v.size,
    x: v.x,
    y: v.y,
  }))
  const center = perceivedCenter(items, W, H)
  if (!center) return null
  return { center, target: balanceTarget(center, W, H, settings.dynamism, settings.tension) }
}

export function makeItem(shape: Shape, partial: Omit<Item, 'shape' | 'kind' | 'massCoef'> & { color: RGB }): Item {
  return {
    shape,
    kind: shape.kind,
    ...partial,
    massCoef: visualMass(shape.kind, { size: 1, color: partial.color, alpha: partial.alpha, apex: partial.apex }),
  }
}
