import { useEffect, useMemo, useRef, useState } from 'react'
import { unitPx } from '../engine/bauhaus'
import { computeFeatures } from '../engine/features'
import { solveLayout } from '../engine/layout'
import { visualBalance } from '../engine/rules'
import { lerpRgb } from '../engine/color'
import { blendOp, isDark } from '../engine/export'
import {
  applyView,
  buildOps,
  drawBalance,
  drawGrid,
  drawOp,
  hitTest,
  screenToWorld,
  tracePath,
} from '../engine/render'
import type { DrawOp, ShapeKind, View, Visual } from '../engine/types'
import { haptic } from '../platform'
import { runtime } from '../state/runtime'
import { actions, checkpoint, store, useStore } from '../state/store'

/** 書き出しなど、キャンバス外から最新フレームを参照するための共有ランタイム */
export const stageRuntime = { ops: [] as DrawOp[], W: 0, H: 0 }

type Pt = { x: number; y: number }

type Gesture =
  | { type: 'none' }
  | { type: 'pending'; hit: string | null; start: Pt; world: Pt; t0: number }
  | { type: 'drag'; id: string; startWorld: Pt; baseX: number; baseY: number }
  | { type: 'draw'; kind: ShapeKind; a: Pt; b: Pt }
  | {
      type: 'pinch'
      target: string | null
      d0: number
      a0: number
      mid0: Pt
      baseSize: number
      baseRot: number
      baseView: View
    }

/** 上のバー＋状態ラベルと、下のツールバーで隠れる幅。図形はこの内側に収める（枠のルール） */
const UI_INSETS = { top: 100, right: 0, bottom: 72, left: 0 }

const TAP_SLOP = 9
const LONG_PRESS_MS = 480
/** 1 秒あたりの追従率。大きいほど速く目標へ落ち着く */
const EASE_POS = 5.5
const EASE_COLOR = 4

export default function CanvasStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ W: 0, H: 0 })
  const shapes = useStore((s) => s.shapes)
  const settings = useStore((s) => s.settings)
  const anchorId = useStore((s) => s.anchorId)

  const layout = useMemo(
    () => solveLayout(shapes, settings, size.W, size.H, anchorId, UI_INSETS),
    [shapes, settings, size, anchorId],
  )
  const targets = layout.visuals
  const targetsRef = useRef(targets)
  targetsRef.current = targets

  // 理論ガイド・指揮者のために、いまの画面の評価を共有する
  useEffect(() => {
    const entries = shapes.flatMap((s) => (targets.has(s.id) ? [{ kind: s.kind, v: targets.get(s.id)! }] : []))
    runtime.set({ report: layout.report, features: computeFeatures(entries, size.W, size.H) })
  }, [layout, shapes, targets, size])

  const visuals = useRef(new Map<string, Visual>())
  const pointers = useRef(new Map<number, Pt>())
  const gesture = useRef<Gesture>({ type: 'none' })
  const longPress = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dragGhost = useRef<Pt | null>(null)

  // ── サイズ追従（DPR 対応）
  useEffect(() => {
    const canvas = canvasRef.current!
    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      canvas.width = Math.round(r.width * dpr)
      canvas.height = Math.round(r.height * dpr)
      setSize({ W: r.width, H: r.height })
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // ── アニメーションループ
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let last = performance.now()
    let flowAmt = store.get().settings.flow ? 1 : 0
    let symAmt = store.get().settings.symmetry ? 1 : 0
    let gridAmt = 0
    let flowClock = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const st = store.get()
      const { settings, shapes, view, selectedId } = st
      const W = canvas.clientWidth
      const H = canvas.clientHeight
      if (!W || !H) return
      const dpr = canvas.width / W

      const kp = 1 - Math.exp(-dt * EASE_POS)
      const kc = 1 - Math.exp(-dt * EASE_COLOR)
      const kf = 1 - Math.exp(-dt * 2.2)
      flowAmt += ((settings.flow ? 1 : 0) - flowAmt) * kf
      symAmt += ((settings.symmetry ? 1 : 0) - symAmt) * kf
      gridAmt += ((settings.mode === 'order' && settings.showGrid ? 1 : 0) - gridAmt) * kf
      flowClock += dt * flowAmt

      // current → target の LERP
      const vis = visuals.current
      const tg = targetsRef.current
      const alive = new Set<string>()
      for (const s of shapes) {
        const t = tg.get(s.id)
        if (!t) continue
        alive.add(s.id)
        let v = vis.get(s.id)
        if (!v) {
          v = { x: s.x * W, y: s.y * H, size: 0, rotation: t.rotation - 30, color: t.color, alpha: 0 }
          vis.set(s.id, v)
        }
        v.x += (t.x - v.x) * kp
        v.y += (t.y - v.y) * kp
        v.size += (t.size - v.size) * kp
        let dr = t.rotation - v.rotation
        dr = ((((dr + 180) % 360) + 360) % 360) - 180
        v.rotation += dr * kp
        v.alpha += (t.alpha - v.alpha) * kp
        v.color = lerpRgb(v.color, t.color, kc)
      }
      for (const id of vis.keys()) if (!alive.has(id)) vis.delete(id)

      const ops = buildOps({
        shapes,
        visuals: vis,
        W,
        H,
        time: flowClock,
        flowAmt,
        symAmt,
        folds: settings.folds,
        mirror: settings.mirror,
      })
      stageRuntime.ops = ops
      stageRuntime.W = W
      stageRuntime.H = H

      const dark = isDark(settings.background)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = settings.background
      ctx.fillRect(0, 0, W, H)
      applyView(ctx, view, W, H)
      drawGrid(ctx, settings, W, H, gridAmt, dark)

      ctx.globalCompositeOperation = blendOp(settings)
      for (const op of ops) drawOp(ctx, op, W, H)
      ctx.globalCompositeOperation = 'source-over'

      const bal = visualBalance(
        shapes.flatMap((s) => (vis.has(s.id) ? [{ kind: s.kind, v: vis.get(s.id)! }] : [])),
        settings,
        W,
        H,
      )
      drawBalance(ctx, shapes.length >= 2 ? bal : null, W, H, gridAmt, dark)

      const ink = dark ? '#ffffff' : '#111111'
      // 選択中の図形
      const sel = selectedId && ops.find((o) => o.id === selectedId && o.copy === 0)
      if (sel) {
        ctx.save()
        ctx.translate(sel.x, sel.y)
        ctx.rotate((sel.rotation * Math.PI) / 180)
        const r = Math.max(14, sel.size / 2) + 8
        ctx.strokeStyle = ink
        ctx.lineWidth = 1.25 / view.zoom
        ctx.setLineDash([4, 4])
        ctx.lineDashOffset = -now / 60
        ctx.strokeRect(-r, -r, r * 2, r * 2)
        ctx.restore()
      }
      // ドラッグ中の指の位置（グリッドへ吸着する前の生の位置）
      if (dragGhost.current) {
        ctx.save()
        ctx.strokeStyle = ink
        ctx.globalAlpha = 0.4
        ctx.lineWidth = 1 / view.zoom
        ctx.beginPath()
        ctx.arc(dragGhost.current.x, dragGhost.current.y, 10, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
      // スワイプ描画中のプレビュー
      const g = gesture.current
      if (g.type === 'draw') {
        const d = draftGeometry(g)
        ctx.save()
        ctx.translate(d.x, d.y)
        ctx.rotate((d.rotation * Math.PI) / 180)
        tracePath(ctx, g.kind, d.size)
        ctx.strokeStyle = ink
        ctx.globalAlpha = 0.7
        ctx.setLineDash([5, 5])
        ctx.lineWidth = 1.5 / view.zoom
        ctx.stroke()
        ctx.restore()
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  // ── 入力
  const local = (e: React.PointerEvent | PointerEvent): Pt => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const toWorld = (p: Pt) => screenToWorld(p.x, p.y, store.get().view, size.W, size.H)

  const cancelLongPress = () => clearTimeout(longPress.current)

  const startPinch = () => {
    const [p1, p2] = [...pointers.current.values()]
    const st = store.get()
    const g = gesture.current
    const target = g.type === 'drag' ? g.id : g.type === 'pending' && g.hit ? g.hit : st.selectedId
    const shape = target ? st.shapes.find((s) => s.id === target) : undefined
    if (shape) {
      checkpoint()
      actions.select(shape.id)
    }
    dragGhost.current = null
    gesture.current = {
      type: 'pinch',
      target: shape?.id ?? null,
      d0: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1,
      a0: Math.atan2(p2.y - p1.y, p2.x - p1.x),
      mid0: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
      baseSize: shape?.size ?? 0,
      baseRot: shape?.rotation ?? 0,
      baseView: st.view,
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    cancelLongPress()
    if (pointers.current.size >= 2) {
      startPinch()
      return
    }
    const w = toWorld(p)
    const zoom = store.get().view.zoom
    const hit = hitTest(stageRuntime.ops, w.x, w.y, 22 / zoom)
    gesture.current = { type: 'pending', hit, start: p, world: w, t0: performance.now() }
    longPress.current = setTimeout(() => {
      const g = gesture.current
      if (g.type === 'pending' && g.hit) {
        haptic('medium')
        actions.openEditor(g.hit)
        gesture.current = { type: 'none' }
      }
    }, LONG_PRESS_MS)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    const g = gesture.current
    const st = store.get()

    if (g.type === 'pinch' && pointers.current.size >= 2) {
      const [p1, p2] = [...pointers.current.values()]
      const scale = Math.hypot(p2.x - p1.x, p2.y - p1.y) / g.d0
      const da = Math.atan2(p2.y - p1.y, p2.x - p1.x) - g.a0
      if (g.target) {
        actions.updateShape(g.target, {
          size: clamp(g.baseSize * scale, 5, 320),
          rotation: g.baseRot + (da * 180) / Math.PI,
        })
      } else {
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
        actions.setView({
          zoom: clamp(g.baseView.zoom * scale, 0.4, 4),
          rotation: g.baseView.rotation + da,
          panX: g.baseView.panX + mid.x - g.mid0.x,
          panY: g.baseView.panY + mid.y - g.mid0.y,
        })
      }
      return
    }

    if (g.type === 'pending') {
      if (Math.hypot(p.x - g.start.x, p.y - g.start.y) < TAP_SLOP) return
      cancelLongPress()
      if (g.hit) {
        const s = st.shapes.find((x) => x.id === g.hit)
        if (!s) return
        checkpoint()
        actions.select(s.id)
        gesture.current = { type: 'drag', id: s.id, startWorld: g.world, baseX: s.x, baseY: s.y }
      } else {
        gesture.current = { type: 'draw', kind: st.tool, a: g.world, b: toWorld(p) }
      }
      return
    }

    if (g.type === 'drag') {
      const w = toWorld(p)
      dragGhost.current = w
      actions.updateShape(g.id, {
        x: g.baseX + (w.x - g.startWorld.x) / size.W,
        y: g.baseY + (w.y - g.startWorld.y) / size.H,
      })
      return
    }

    if (g.type === 'draw') g.b = toWorld(p)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    cancelLongPress()
    const g = gesture.current
    dragGhost.current = null

    if (g.type === 'pinch') {
      // 片方の指が残っていても、次のタッチまで何もしない
      gesture.current = { type: 'none' }
      return
    }
    if (g.type === 'pending') {
      if (g.hit) {
        actions.select(store.get().selectedId === g.hit ? null : g.hit)
      } else {
        actions.addShape({ x: g.world.x / size.W, y: g.world.y / size.H })
        haptic()
      }
    } else if (g.type === 'draw') {
      const d = draftGeometry(g)
      const u = unitPx(size.W, size.H)
      if (d.size / u >= 4) {
        actions.addShape({
          kind: g.kind,
          x: d.x / size.W,
          y: d.y / size.H,
          size: d.size / u,
          rotation: d.rotation,
        })
      }
    }
    gesture.current = { type: 'none' }
  }

  const onWheel = (e: React.WheelEvent) => {
    const v = store.get().view
    actions.setView({ ...v, zoom: clamp(v.zoom * Math.exp(-e.deltaY * 0.0015), 0.4, 4) })
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onContextMenu={(e) => e.preventDefault()}
    />
  )
}

/** スワイプの始点・終点から図形の中心・サイズ・角度を求める */
function draftGeometry(g: { kind: ShapeKind; a: Pt; b: Pt }) {
  const dx = g.b.x - g.a.x
  const dy = g.b.y - g.a.y
  const len = Math.hypot(dx, dy)
  if (g.kind === 'line') {
    return { x: (g.a.x + g.b.x) / 2, y: (g.a.y + g.b.y) / 2, size: len, rotation: (Math.atan2(dy, dx) * 180) / Math.PI }
  }
  // 始点を中心に、スワイプ方向へ「向き」を持たせる（三角形は頂点がスワイプ方向を向く）
  return { x: g.a.x, y: g.a.y, size: len * 2, rotation: (Math.atan2(dx, -dy) * 180) / Math.PI }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}
