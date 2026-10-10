import { gridFractions } from './bauhaus'
import { rgbCss } from './color'
import { flowOffset } from './flow'
import type { DrawOp, Settings, Shape, ShapeKind, View, Visual } from './types'

export interface OpsInput {
  shapes: Shape[]
  visuals: Map<string, Visual>
  W: number
  H: number
  time: number
  /** 0..1 Auto Flow の効き具合（トグル時にフェード） */
  flowAmt: number
  /** 0..1 万華鏡複製の不透明度（トグル時にフェード） */
  symAmt: number
  folds: number
  mirror: boolean
}

/** 現在の状態から描画命令の列を作る。Canvas / SVG / ヒットテストで共有する。 */
export function buildOps(o: OpsInput): DrawOp[] {
  const ops: DrawOp[] = []
  const cx = o.W / 2
  const cy = o.H / 2
  for (const s of o.shapes) {
    const v = o.visuals.get(s.id)
    if (!v) continue
    let x = v.x
    let y = v.y
    let size = v.size
    let rot = v.rotation
    if (o.flowAmt > 0.001) {
      const f = flowOffset(s.kind, v.size, v.rotation, s.seed, o.time)
      x += f.dx * o.flowAmt
      y += f.dy * o.flowAmt
      rot += f.drot * o.flowAmt
      size *= 1 + (f.dscale - 1) * o.flowAmt
    }
    ops.push({ id: s.id, kind: s.kind, x, y, size, rotation: rot, color: v.color, alpha: v.alpha, copy: 0 })

    if (o.symAmt > 0.001) {
      const px = x - cx
      const py = y - cy
      let copy = 1
      for (let k = 0; k < o.folds; k++) {
        const a = (Math.PI * 2 * k) / o.folds
        const ca = Math.cos(a)
        const sa = Math.sin(a)
        for (const reflect of o.mirror ? [false, true] : [false]) {
          if (k === 0 && !reflect) continue
          const qx = px
          const qy = reflect ? -py : py
          const r = reflect ? 180 - rot : rot
          ops.push({
            id: s.id,
            kind: s.kind,
            x: cx + qx * ca - qy * sa,
            y: cy + qx * sa + qy * ca,
            size,
            rotation: r + (a * 180) / Math.PI,
            color: v.color,
            // 複製は少しだけ透かして、中心付近で重なっても潰れないようにする
            alpha: v.alpha * o.symAmt * 0.82,
            copy: copy++,
          })
        }
      }
    }
  }
  return ops
}

export function lineThickness(size: number, W: number, H: number) {
  return Math.max(2, size * 0.045 + (Math.min(W, H) / 400) * 2)
}

export function tracePath(ctx: CanvasRenderingContext2D, kind: ShapeKind, size: number) {
  const h = size / 2
  ctx.beginPath()
  switch (kind) {
    case 'circle':
      ctx.arc(0, 0, h, 0, Math.PI * 2)
      break
    case 'square':
      ctx.rect(-h, -h, size, size)
      break
    case 'triangle': {
      const th = (size * Math.sqrt(3)) / 2
      ctx.moveTo(0, (-th * 2) / 3)
      ctx.lineTo(h, th / 3)
      ctx.lineTo(-h, th / 3)
      ctx.closePath()
      break
    }
    case 'line':
      ctx.moveTo(-h, 0)
      ctx.lineTo(h, 0)
      break
  }
}

export function drawOp(ctx: CanvasRenderingContext2D, op: DrawOp, W: number, H: number) {
  ctx.save()
  ctx.translate(op.x, op.y)
  ctx.rotate((op.rotation * Math.PI) / 180)
  ctx.globalAlpha = op.alpha
  tracePath(ctx, op.kind, op.size)
  if (op.kind === 'line') {
    ctx.strokeStyle = rgbCss(op.color)
    ctx.lineWidth = lineThickness(op.size, W, H)
    ctx.lineCap = 'butt'
    ctx.stroke()
  } else {
    ctx.fillStyle = rgbCss(op.color)
    ctx.fill()
  }
  ctx.restore()
}

export function applyView(ctx: CanvasRenderingContext2D, view: View, W: number, H: number) {
  ctx.translate(W / 2 + view.panX, H / 2 + view.panY)
  ctx.rotate(view.rotation)
  ctx.scale(view.zoom, view.zoom)
  ctx.translate(-W / 2, -H / 2)
}

/** 画面座標 → ワールド座標（ビューのズーム・回転・パンを逆変換） */
export function screenToWorld(x: number, y: number, view: View, W: number, H: number) {
  let dx = x - W / 2 - view.panX
  let dy = y - H / 2 - view.panY
  const c = Math.cos(-view.rotation)
  const s = Math.sin(-view.rotation)
  ;[dx, dy] = [dx * c - dy * s, dx * s + dy * c]
  return { x: dx / view.zoom + W / 2, y: dy / view.zoom + H / 2 }
}

export function drawGrid(ctx: CanvasRenderingContext2D, settings: Settings, W: number, H: number, alpha: number, dark: boolean) {
  if (alpha <= 0.001) return
  const fr = gridFractions(settings.grid)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const f of fr) {
    ctx.moveTo(f * W, 0)
    ctx.lineTo(f * W, H)
    ctx.moveTo(0, f * H)
    ctx.lineTo(W, f * H)
  }
  ctx.stroke()
  ctx.setLineDash([2, 6])
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(W, H)
  ctx.moveTo(W, 0)
  ctx.lineTo(0, H)
  ctx.stroke()
  ctx.restore()
}

/**
 * N15 天秤（クレーの「重さと対重」）。均衡の目標点を支点にして、知覚上の重心のずれで竿が傾く。
 * 重心が目標点より右にあれば右の皿が下がる。上下のずれは支点から重心への点線で示す。
 */
export function drawBalance(
  ctx: CanvasRenderingContext2D,
  balance: { center: { x: number; y: number }; target: { x: number; y: number } } | null,
  W: number,
  H: number,
  alpha: number,
  dark: boolean,
) {
  if (!balance || alpha <= 0.001) return
  const { center: c, target: t } = balance
  const ink = dark ? '255,255,255' : '0,0,0'
  const minDim = Math.min(W, H)
  const tilt = Math.max(-0.45, Math.min(0.45, ((c.x - t.x) / minDim) * 6))
  const L = 34

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineWidth = 1

  // 画面中心（静的な均衡の基準）
  ctx.strokeStyle = `rgba(${ink},0.25)`
  ctx.beginPath()
  ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2)
  ctx.stroke()

  // 支点
  ctx.fillStyle = `rgba(${ink},0.55)`
  ctx.beginPath()
  ctx.moveTo(t.x, t.y)
  ctx.lineTo(t.x + 7, t.y + 10)
  ctx.lineTo(t.x - 7, t.y + 10)
  ctx.closePath()
  ctx.fill()

  // 竿と皿
  ctx.translate(t.x, t.y)
  ctx.rotate(tilt)
  ctx.strokeStyle = `rgba(${ink},0.7)`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(-L, 0)
  ctx.lineTo(L, 0)
  ctx.stroke()
  ctx.fillStyle = `rgba(${ink},0.7)`
  for (const e of [-L, L]) {
    ctx.beginPath()
    ctx.arc(e, 0, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // 重心と、支点からのずれ
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = `rgba(${ink},0.45)`
  ctx.setLineDash([2, 3])
  ctx.beginPath()
  ctx.moveTo(t.x, t.y)
  ctx.lineTo(c.x, c.y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = `rgba(${ink},0.85)`
  ctx.beginPath()
  ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function hitTest(ops: DrawOp[], x: number, y: number, minRadius: number): string | null {
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i]
    if (op.copy !== 0) continue
    const r = Math.max(minRadius, op.size / 2)
    if (op.kind === 'line') {
      const a = (op.rotation * Math.PI) / 180
      const dx = x - op.x
      const dy = y - op.y
      const along = dx * Math.cos(a) + dy * Math.sin(a)
      const across = -dx * Math.sin(a) + dy * Math.cos(a)
      if (Math.abs(along) <= op.size / 2 + minRadius / 2 && Math.abs(across) <= minRadius) return op.id
    } else if (Math.hypot(x - op.x, y - op.y) <= r) {
      return op.id
    }
  }
  return null
}
