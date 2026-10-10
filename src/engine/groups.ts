/**
 * グループ（親に付いて動く子の図形）と、それを使う 3 つの道具
 *
 * - 正方形へのオマージュ（アルバース、docs/bauhaus-theory.md §3-2）
 * - 散歩する線（クレー、§8）
 * - 折り（アルバースの予備課程、§10-8）
 *
 * 子はレイアウトの対象にならない。親の目標状態（位置・大きさ・回転・色）から子の姿を導く。
 */
import { mulberry32 } from './bauhaus'
import { hslToRgb, rgbToHsl } from './color'
import type { Relation, RGB, Shape, Visual } from './types'

export const isChild = (s: Shape) => !!s.parent

/** 親の座標系で表した相対位置から、子の姿を求める */
export function deriveChild(parent: Visual, rel: Relation): Visual {
  const r = (parent.rotation * Math.PI) / 180
  const lx = rel.dx * parent.size
  const ly = rel.dy * parent.size
  return {
    x: parent.x + lx * Math.cos(r) - ly * Math.sin(r),
    y: parent.y + lx * Math.sin(r) + ly * Math.cos(r),
    size: parent.size * rel.scale,
    rotation: parent.rotation + rel.rot,
    color: parent.color,
    alpha: parent.alpha,
    apex: parent.apex,
  }
}

/** 親の色の明るさをずらした、子の色（オマージュの段階的な色） */
export function shiftLight(color: RGB, light: number): RGB {
  const [h, s, l] = rgbToHsl(color)
  return hslToRgb(h, s, Math.min(0.92, Math.max(0.08, l + light)))
}

/** 子の目標状態を、親の目標状態から埋める（visuals を書き換える） */
export function deriveChildren(shapes: Shape[], visuals: Map<string, Visual>, colors?: Map<string, RGB>) {
  for (const s of shapes) {
    if (!s.parent || !s.rel) continue
    const pv = visuals.get(s.parent)
    if (!pv) continue
    const v = deriveChild(pv, s.rel)
    if (s.rel.light !== undefined) v.color = shiftLight(pv.color, s.rel.light)
    else if (colors?.has(s.id)) v.color = colors.get(s.id)!
    v.alpha = s.alpha
    if (s.kind === 'triangle') v.apex = s.apex ?? 60
    visuals.set(s.id, v)
  }
}

/** 親とその子孫の id（親が先） */
export function familyIds(shapes: Shape[], rootId: string): string[] {
  const out = [rootId]
  for (let i = 0; i < out.length; i++) for (const s of shapes) if (s.parent === out[i]) out.push(s.id)
  return out
}

export function rootOf(shapes: Shape[], id: string): string {
  let cur = shapes.find((s) => s.id === id)
  while (cur?.parent) {
    const p = shapes.find((s) => s.id === cur!.parent)
    if (!p) break
    cur = p
  }
  return cur?.id ?? id
}

// ───────────────────────── 正方形へのオマージュ

/**
 * 10 単位のモジュールで、幅 10・8・6・4 の 4 重の正方形。
 * 1 つ内側へ入るごとに 下 0.5 : 横 1 : 上 1.5（＝ 1 : 2 : 3）の余白を取るので、内側ほど下へ寄る。
 * 色は外側から内側へ明るさを段階的に変える。
 */
export const HOMAGE_LEVELS = [
  { scale: 0.8, dy: 0.05, light: 0.09 },
  { scale: 0.6, dy: 0.1, light: 0.18 },
  { scale: 0.4, dy: 0.15, light: 0.27 },
]

export function homageRelations(): Relation[] {
  return HOMAGE_LEVELS.map((l) => ({ dx: 0, dy: l.dy, scale: l.scale, rot: 0, light: l.light }))
}

// ───────────────────────── 散歩する線

export interface Segment {
  /** 線分の中心（px） */
  x: number
  y: number
  /** 長さ（px） */
  length: number
  rotation: number
}

/**
 * クレーの「線を散歩に連れ出す」（🛠 アプリのための解釈）。
 * 引いた方向（45° 刻み）から歩き始め、たいていはまっすぐか 45° だけ曲がり、ときどき直角に折れ、
 * まれに引き返すように鋭く曲がる。歩幅はフィボナッチ数列を行き来する。乱数は seed で決まる。
 */
export function walkPath(startX: number, startY: number, angleDeg: number, unitPx: number, seed: number, steps = 8): Segment[] {
  const rand = mulberry32(seed)
  const strides = [21, 34, 55, 34, 21, 13, 21, 34]
  let a = Math.round(angleDeg / 45) * 45
  let x = startX
  let y = startY
  const out: Segment[] = []
  for (let i = 0; i < steps; i++) {
    if (i > 0) {
      const r = rand()
      const sign = rand() < 0.5 ? -1 : 1
      if (r < 0.35) a += 0
      else if (r < 0.75) a += 45 * sign
      else if (r < 0.93) a += 90 * sign
      else a += 135 * sign
    }
    const len = strides[i % strides.length] * unitPx
    const rad = (a * Math.PI) / 180
    const nx = x + Math.cos(rad) * len
    const ny = y + Math.sin(rad) * len
    out.push({ x: (x + nx) / 2, y: (y + ny) / 2, length: len, rotation: a })
    x = nx
    y = ny
  }
  return out
}

/** 線分の並びを、最初の線分を親とする相対位置へ変換する */
export function segmentsToRelations(segs: Segment[]): Relation[] {
  const [p, ...rest] = segs
  const r = (-p.rotation * Math.PI) / 180
  return rest.map((s) => {
    const gx = s.x - p.x
    const gy = s.y - p.y
    return {
      dx: (gx * Math.cos(r) - gy * Math.sin(r)) / p.length,
      dy: (gx * Math.sin(r) + gy * Math.cos(r)) / p.length,
      scale: s.length / p.length,
      rot: s.rotation - p.rotation,
    }
  })
}

// ───────────────────────── 折り

/** 点を直線（a を通り、a→b の向き）に関して鏡映する */
export function reflectPoint(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy || 1
  const t = ((px - ax) * dx + (py - ay) * dy) / len2
  const fx = ax + dx * t
  const fy = ay + dy * t
  return { x: 2 * fx - px, y: 2 * fy - py }
}

/** 図形の向き（度）を、角度 lineDeg の直線に関して鏡映する。図形は自分の縦軸に対して左右対称なので 2θ − r + 180 */
export function reflectRotation(rotation: number, lineDeg: number) {
  return (((2 * lineDeg - rotation + 180) % 360) + 360) % 360
}

/** 点が直線 a→b の左側（画面座標で、進む向きに対して左）にあるか */
export function sideOf(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  return Math.sign((bx - ax) * (py - ay) - (by - ay) * (px - ax))
}
