import { describe, expect, it } from 'vitest'
import { contrastRatio, hexToRgb, rgbToHsl } from './color'
import { areaFactor, clampApex, triangleDims } from './geometry'
import { solveLayout } from './layout'
import {
  angleColor,
  applyContrastMode,
  applyTone,
  correspondenceColor,
  lineTemperatureColor,
  monoSteps,
  resolveColors,
} from './palette'
import { DEFAULT_WEIGHTS, extensionError, hueFamily } from './rules'
import type { RGB, Settings, Shape, ShapeKind } from './types'

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
  id: `p${n++}`,
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

const hue = (rgb: RGB) => rgbToHsl(rgb)[0]
const sat = (rgb: RGB) => rgbToHsl(rgb)[1]
const light = (rgb: RGB) => rgbToHsl(rgb)[2]
const isGrey = (rgb: RGB) => Math.abs(rgb[0] - rgb[1]) < 1 && Math.abs(rgb[1] - rgb[2]) < 1
const hueDist = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)

describe('geometry', () => {
  it('acute triangles are tall, obtuse triangles are wide', () => {
    const acute = triangleDims(100, 30)
    const obtuse = triangleDims(100, 140)
    expect(acute.h).toBeGreaterThan(acute.b)
    expect(obtuse.b).toBeGreaterThan(obtuse.h)
    expect(Math.max(acute.b, acute.h)).toBeCloseTo(100)
  })

  it('every kind has a positive area and apex is clamped', () => {
    const kinds: ShapeKind[] = ['circle', 'triangle', 'square', 'line', 'trapezoid', 'spherical', 'ellipse']
    for (const k of kinds) expect(areaFactor(k)).toBeGreaterThan(0)
    expect(areaFactor('spherical')).toBeCloseTo((Math.PI - Math.sqrt(3)) / 2)
    expect(clampApex(5)).toBe(20)
    expect(clampApex(undefined)).toBe(60)
  })
})

describe('Kandinsky: angle and colour (N3)', () => {
  it('acute/equilateral is yellow, right is red, obtuse is blue', () => {
    expect(hueFamily(angleColor(40))).toBe('yellow')
    expect(hueFamily(angleColor(60))).toBe('yellow')
    expect(hueFamily(angleColor(90))).toBe('red')
    expect(hueFamily(angleColor(140))).toBe('blue')
  })

  it('changes continuously between them', () => {
    const between = angleColor(75)
    expect(hueFamily(between)).toBe('orange')
  })
})

describe('Kandinsky: line temperature (N2)', () => {
  it('horizontal is cold, vertical is warm', () => {
    expect(hueFamily(lineTemperatureColor(0))).toBe('blue')
    expect(hueFamily(lineTemperatureColor(90))).toBe('red')
    expect(hueFamily(lineTemperatureColor(180))).toBe('blue')
  })
})

describe('Itten: six forms, six colours (N4)', () => {
  it('maps the secondary forms to secondary colours', () => {
    expect(hueFamily(correspondenceColor({ kind: 'trapezoid', rotation: 0 }))).toBe('orange')
    expect(hueFamily(correspondenceColor({ kind: 'spherical', rotation: 0 }))).toBe('green')
    expect(hueFamily(correspondenceColor({ kind: 'ellipse', rotation: 0 }))).toBe('violet')
    expect(hueFamily(correspondenceColor({ kind: 'square', rotation: 0 }))).toBe('red')
  })
})

describe('Itten: contrast modes (N5)', () => {
  const bg = hexToRgb('#f2eee3')
  const shapes = [
    shape({ kind: 'circle', size: 89 }),
    shape({ kind: 'triangle', size: 55 }),
    shape({ kind: 'square', size: 34 }),
    shape({ kind: 'ellipse', size: 21 }),
  ]
  const colors = shapes.map((s) => correspondenceColor(s))

  it('hue: everything becomes a saturated pure hue', () => {
    for (const c of applyContrastMode(shapes, colors, 'hue', bg)) expect(sat(c)).toBeGreaterThan(0.8)
  })

  it('light–dark: lightness spreads over the steps, largest furthest from the background', () => {
    const out = applyContrastMode(shapes, colors, 'lightDark', bg)
    const ls = out.map(light)
    expect(Math.max(...ls) - Math.min(...ls)).toBeGreaterThan(0.5)
    expect(contrastRatio(out[0], bg)).toBeGreaterThan(contrastRatio(out[3], bg))
  })

  it('cold–warm: angular forms warm, round forms cold', () => {
    const out = applyContrastMode(shapes, colors, 'coldWarm', bg)
    expect(hueDist(hue(out[1]), 22)).toBeLessThan(40) // triangle
    expect(hueDist(hue(out[2]), 22)).toBeLessThan(40) // square
    expect(hueDist(hue(out[0]), 210)).toBeLessThan(40) // circle
  })

  it('complementary: only the lead hue and its complement', () => {
    const out = applyContrastMode(shapes, colors, 'complementary', bg)
    expect(hueDist(hue(out[0]), hue(out[1]))).toBeGreaterThan(170)
    expect(hueDist(hue(out[0]), hue(out[2]))).toBeLessThan(2)
  })

  it('simultaneous: one colour, the rest grey of the same lightness', () => {
    const out = applyContrastMode(shapes, colors, 'simultaneous', bg)
    expect(isGrey(out[0])).toBe(false)
    for (const c of out.slice(1)) {
      expect(isGrey(c)).toBe(true)
      expect(light(c)).toBeCloseTo(light(out[0]), 2)
    }
  })

  it('saturation: only the lead stays vivid', () => {
    const out = applyContrastMode(shapes, colors, 'saturation', bg)
    expect(sat(out[0])).toBeGreaterThan(0.85)
    for (const c of out.slice(1)) expect(sat(c)).toBeLessThan(0.2)
  })
})

describe('Itten: contrast of extension (N6)', () => {
  it('is zero for a single hue and grows when proportions are off', () => {
    const yellow = hexToRgb('#f2c230')
    const violet = hexToRgb('#6b3fa0')
    const it = (color: RGB, size: number) => ({ kind: 'circle' as const, size, apex: 60, color, alpha: 1 })
    expect(extensionError([it(yellow, 100)])).toBe(0)
    const harmonious = extensionError([it(yellow, 100 * Math.sqrt(3)), it(violet, 100 * Math.sqrt(9))])
    const off = extensionError([it(yellow, 300), it(violet, 100)])
    expect(harmonious).toBeCloseTo(0, 5)
    expect(off).toBeGreaterThan(0.5)
  })

  it('extension mode shrinks the big yellow shape relative to violet', () => {
    const yellow = shape({ kind: 'triangle', size: 144, x: 0.3, y: 0.3 })
    const violet = shape({ kind: 'ellipse', size: 34, x: 0.7, y: 0.7 })
    const W = 800
    const plain = solveLayout([yellow, violet], base, W, W, null)
    const ext = solveLayout([yellow, violet], { ...base, contrastMode: 'extension' }, W, W, null)
    const ratio = (r: typeof plain) => r.visuals.get(yellow.id)!.size / r.visuals.get(violet.id)!.size
    expect(ratio(ext)).toBeLessThan(ratio(plain))
    expect(ext.report!.rules.extension.raw).toBeLessThan(plain.report!.rules.extension.raw)
  })
})

describe('tone (N25)', () => {
  const bg = hexToRgb('#f2eee3')
  const shapes = [shape({ kind: 'circle', size: 89 }), shape({ kind: 'triangle', size: 55 }), shape({ kind: 'square', size: 34 })]
  const colors = shapes.map((s) => correspondenceColor(s))

  it('mono turns every colour into one of 7 greys, keeping the order of lightness', () => {
    const out = applyTone(shapes, colors, 'mono', bg)
    const steps = monoSteps(bg).map((v) => Math.round(v * 255))
    for (const c of out) {
      expect(isGrey(c)).toBe(true)
      expect(steps).toContain(Math.round(c[0]))
    }
    // 黄（明るい）＞ 赤 ＞ 青（暗い）の順が保たれる
    expect(out[1][0]).toBeGreaterThan(out[2][0])
    expect(out[2][0]).toBeGreaterThan(out[0][0])
  })

  it('mono spreads the greys when the colours are all alike', () => {
    const same = shapes.map(() => hexToRgb('#d7261e'))
    const out = applyTone(shapes, same, 'mono', bg)
    expect(new Set(out.map((c) => Math.round(c[0]))).size).toBe(3)
  })

  it('accent keeps exactly one colour: the largest shape', () => {
    const out = applyTone(shapes, colors, 'accent', bg)
    expect(isGrey(out[0])).toBe(false)
    expect(out.slice(1).every(isGrey)).toBe(true)
  })

  it('applies in chaos mode too, and the whole pipeline stays inside the gamut', () => {
    const out = resolveColors(shapes, { ...base, mode: 'chaos', tone: 'mono' }, { theory: false })
    expect(out.every(isGrey)).toBe(true)
    for (const c of resolveColors(shapes, { ...base, contrastMode: 'hue' }, { theory: true })) {
      for (const v of c) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(255.0001)
      }
    }
  })
})
