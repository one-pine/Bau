/**
 * Auto Flow: 形態ごとの「物理エネルギー」に従った運動。
 * 目標状態は変えず、描画時のオフセットとして加える。
 *   △ 鋭い直線運動（頂点方向へ一定速度で往復）
 *   ○ 滑らかな円運動
 *   □ 静止と 90° の回転を交互に繰り返す（安定と緊張）
 *   ─ 振り子のような揺れ
 */
import type { ShapeKind } from './types'

export interface FlowOffset {
  dx: number
  dy: number
  drot: number
  dscale: number
}

const tri = (p: number) => 1 - 4 * Math.abs(Math.round(p - 0.25) - (p - 0.25))
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function flowOffset(kind: ShapeKind, size: number, rotation: number, seed: number, t: number): FlowOffset {
  const phase = (seed % 1000) / 1000
  switch (kind) {
    case 'triangle': {
      const r = (rotation * Math.PI) / 180
      const a = size * 0.7 * tri(t * 0.22 + phase)
      return { dx: Math.sin(r) * a, dy: -Math.cos(r) * a, drot: 0, dscale: 1 }
    }
    case 'circle': {
      const a = (t * 0.55 + phase) * Math.PI * 2 * (seed % 2 ? 1 : -1)
      const R = size * 0.45
      return { dx: Math.cos(a) * R, dy: Math.sin(a) * R, drot: 0, dscale: 1 + 0.05 * Math.sin(a * 2) }
    }
    case 'square': {
      const p = t / 3.2 + phase
      const step = Math.floor(p)
      const frac = p - step
      const turn = frac > 0.7 ? easeInOutCubic((frac - 0.7) / 0.3) : 0
      return { dx: 0, dy: 0, drot: (step + turn) * 90, dscale: 1 + 0.08 * Math.sin(Math.PI * Math.min(1, turn)) }
    }
    case 'line': {
      return { dx: 0, dy: 0, drot: 28 * Math.sin(t * 0.9 + phase * 6.28), dscale: 1 }
    }
  }
}
