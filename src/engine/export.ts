import { rgbCss } from './color'
import { ellipseRadii, sphericalVertices, trapezoidPoints, trianglePoints } from './geometry'
import { drawOp, lineThickness } from './render'
import type { DrawOp, Settings } from './types'
import { saveBlob, saveText } from '../platform'

function stamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/** 高解像度 PNG（表示サイズ × scale、最大 8192px） */
export async function exportPng(ops: DrawOp[], settings: Settings, W: number, H: number, scale = 4) {
  const s = Math.min(scale, 8192 / Math.max(W, H))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * s)
  canvas.height = Math.round(H * s)
  const ctx = canvas.getContext('2d')!
  ctx.scale(s, s)
  ctx.fillStyle = settings.background
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = blendOp(settings)
  for (const op of ops) drawOp(ctx, op, W, H)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) return
  await saveBlob(blob, `bau-${stamp()}.png`)
}

export function blendOp(settings: Settings): GlobalCompositeOperation {
  if (settings.blend !== 'multiply') return 'source-over'
  return isDark(settings.background) ? 'screen' : 'multiply'
}

export function isDark(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  const l = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return l < 110
}

const f = (n: number) => +n.toFixed(2)
const pts = (ps: [number, number][]) => ps.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')

export function opsToSvg(ops: DrawOp[], settings: Settings, W: number, H: number): string {
  const blend = blendOp(settings)
  const style = blend === 'source-over' ? '' : `\n  <style>.s > * { mix-blend-mode: ${blend}; }</style>`
  const body = ops
    .map((op) => {
      const t = `translate(${f(op.x)} ${f(op.y)}) rotate(${f(op.rotation)})`
      const fill = rgbCss(op.color)
      const o = (op.alpha < 1 ? ` opacity="${f(op.alpha)}"` : '') + (op.solid ? ' style="mix-blend-mode:normal"' : '')
      const h = op.size / 2
      switch (op.kind) {
        case 'circle':
          return `<circle transform="${t}" r="${f(h)}" fill="${fill}"${o}/>`
        case 'square':
          return `<rect transform="${t}" x="${f(-h)}" y="${f(-h)}" width="${f(op.size)}" height="${f(op.size)}" fill="${fill}"${o}/>`
        case 'triangle':
          return `<polygon transform="${t}" points="${pts(trianglePoints(op.size, op.apex))}" fill="${fill}"${o}/>`
        case 'trapezoid':
          return `<polygon transform="${t}" points="${pts(trapezoidPoints(op.size))}" fill="${fill}"${o}/>`
        case 'spherical': {
          const [top, right, left] = sphericalVertices(op.size)
          const r = f(op.size)
          const p = (v: [number, number]) => `${f(v[0])} ${f(v[1])}`
          return `<path transform="${t}" d="M${p(right)} A${r} ${r} 0 0 1 ${p(left)} A${r} ${r} 0 0 1 ${p(top)} A${r} ${r} 0 0 1 ${p(right)}Z" fill="${fill}"${o}/>`
        }
        case 'ellipse': {
          const { rx, ry } = ellipseRadii(op.size)
          return `<ellipse transform="${t}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${o}/>`
        }
        case 'line':
          return `<line transform="${t}" x1="${f(-h)}" y1="0" x2="${f(h)}" y2="0" stroke="${fill}" stroke-width="${f(lineThickness(op.size, W, H))}"${o}/>`
      }
    })
    .join('\n    ')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}" height="${f(H)}" viewBox="0 0 ${f(W)} ${f(H)}">
  <rect width="100%" height="100%" fill="${settings.background}"/>${style}
  <g class="s">
    ${body}
  </g>
</svg>
`
}

export async function exportSvg(ops: DrawOp[], settings: Settings, W: number, H: number) {
  await saveText(opsToSvg(ops, settings, W, H), `bau-${stamp()}.svg`, 'image/svg+xml')
}
