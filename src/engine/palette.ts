/**
 * 色の段（配置の前に適用する）
 *
 *  1. 形と色の対応（カンディンスキー／イッテン）
 *     - イッテンの 6 形 6 色：□赤 △黄 ○青 台形橙 球面三角形緑 楕円紫（§2-3）
 *     - 角度と色：三角形は頂角で 鋭角（60° 以下）＝黄 → 直角＝赤 → 鈍角（120° 以上）＝青 と連続的に変わる（§1-3）
 *     - 線の温度：水平＝冷たい（青）、垂直＝暖かい（赤）、斜め＝両方（§1-2）
 *  2. 背景との対比補正（ittenAdjust）
 *  3. イッテンの色彩対比モード（§2-1）
 *  4. 色調：カラー／モノトーン／モノトーン＋1 色（roadmap §2-6）
 */
import { ittenAdjust, KANDINSKY } from './bauhaus'
import { hexToRgb, hslToRgb, lerpRgb, luminance, rgbToHex, rgbToHsl } from './color'
import { clampApex, isAngular } from './geometry'
import type { RGB, Settings, Shape } from './types'

// ───────────────────────── 1. 形と色の対応

/** 色相環の上で、暖色 → 寒色へ進む経路（黄 45° → 赤 2° → 紫 → 青 218°）。HSL の [色相, 彩度, 明度] */
const YELLOW: [number, number, number] = [45, 0.87, 0.57]
const RED: [number, number, number] = [2, 0.76, 0.48]
const BLUE: [number, number, number] = [218 - 360, 0.68, 0.37]

function lerpHsl(a: [number, number, number], b: [number, number, number], t: number): RGB {
  return hslToRgb(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
}

/**
 * カンディンスキーの角度と色：鋭角＝黄、直角＝赤、鈍角＝青。
 * 正三角形（60°）は鋭角でできた形なので黄。60°→90° で黄→赤、90°→120° で赤→青と、色相環に沿って連続的に変わる。
 */
export function angleColor(apex: number): RGB {
  const a = clampApex(apex)
  if (a <= 60) return lerpHsl(YELLOW, YELLOW, 0)
  if (a <= 90) return lerpHsl(YELLOW, RED, (a - 60) / 30)
  if (a <= 120) return lerpHsl(RED, BLUE, (a - 90) / 30)
  return lerpHsl(BLUE, BLUE, 0)
}

const COLD_LINE = hexToRgb('#1b2f6b')
const WARM_LINE = hexToRgb('#b3201a')

/** 線の温度：水平に近いほど冷たい青、垂直に近いほど暖かい赤 */
export function lineTemperatureColor(rotation: number): RGB {
  const r = (((rotation % 180) + 180) % 180) * (Math.PI / 180)
  const vertical = Math.abs(Math.sin(r)) // 0＝水平 … 1＝垂直
  return lerpRgb(COLD_LINE, WARM_LINE, vertical)
}

/** 形から決まる色（対応論が ON のとき） */
export function correspondenceColor(shape: Pick<Shape, 'kind' | 'apex' | 'rotation'>): RGB {
  if (shape.kind === 'triangle') return angleColor(shape.apex ?? 60)
  if (shape.kind === 'line') return lineTemperatureColor(shape.rotation)
  return hexToRgb(KANDINSKY[shape.kind])
}

/** 対応論とユーザーの色の選択から、図形の基本の色を決める */
export function baseColor(shape: Shape, settings: Pick<Settings, 'correspondence'>): RGB {
  return settings.correspondence && !shape.colorLocked ? correspondenceColor(shape) : hexToRgb(shape.color)
}

export function resolveColor(shape: Shape, settings: Pick<Settings, 'correspondence'>): string {
  return rgbToHex(baseColor(shape, settings))
}

// ───────────────────────── 3. イッテンの色彩対比

/** イッテンの 6 つの基本色相（度） */
const ITTEN_HUES = [50, 28, 2, 280, 218, 140] // 黄・橙・赤・紫・青・緑

const hueDist = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)
const isChromatic = (rgb: RGB) => rgbToHsl(rgb)[1] > 0.15
const isWarmHue = (h: number) => hueDist(h, 30) < 90

/**
 * 図形の「重要度」の順番（大きい順、同じなら先に置いた順）。
 * 対比モードで「主役の 1 色」を選ぶときや、明暗の段階を割り当てるときに使う。
 * 直前に触った図形ではなく大きさで決めるので、操作のたびに主役が入れ替わらない。
 */
export function importanceOrder(shapes: Shape[]): number[] {
  return [...shapes.keys()].sort((a, b) => shapes[b].size - shapes[a].size || a - b)
}

export function applyContrastMode(shapes: Shape[], colors: RGB[], mode: Settings['contrastMode'], bg: RGB): RGB[] {
  if (mode === 'none' || mode === 'extension' || shapes.length === 0) return colors
  const order = importanceOrder(shapes)
  const lead = order.find((i) => isChromatic(colors[i])) ?? order[0]
  const [leadH, , leadL] = rgbToHsl(colors[lead])
  const out = colors.slice()

  switch (mode) {
    case 'hue':
      // 純色同士：最も近いイッテンの基本色相へ寄せ、彩度を最大近くに
      for (let i = 0; i < out.length; i++) {
        const [h, s, l] = rgbToHsl(out[i])
        if (s < 0.08) continue
        const snapped = ITTEN_HUES.reduce((a, b) => (hueDist(h, b) < hueDist(h, a) ? b : a))
        out[i] = hslToRgb(snapped, 0.88, Math.min(0.6, Math.max(0.42, l)))
      }
      break
    case 'lightDark': {
      // 明暗の対比：重要な図形ほど背景から遠い明るさに。7 段階をまんべんなく使う
      const steps = monoSteps(bg)
      const light = luminance(bg) > 0.35
      order.forEach((idx, rank) => {
        const [h, s] = rgbToHsl(out[idx])
        const k = order.length > 1 ? Math.round((rank * 6) / (order.length - 1)) : 0
        out[idx] = hslToRgb(h, s, steps[light ? k : 6 - k])
      })
      break
    }
    case 'coldWarm':
      // 寒暖の対比：角ばった形は暖色（橙寄り）、丸い形は寒色（青寄り）へ押し出す
      for (let i = 0; i < out.length; i++) {
        const [h, s, l] = rgbToHsl(out[i])
        const warm = s < 0.08 ? isAngular(shapes[i].kind) : isWarmHue(h)
        const target = warm ? 22 : 210
        const t = 0.55
        const d = ((target - h + 540) % 360) - 180
        out[i] = hslToRgb(h + d * t, Math.max(0.7, s), Math.min(0.6, Math.max(0.35, l)))
      }
      break
    case 'complementary':
      // 補色の対比：主役の色相と、その補色の 2 色だけで交互に
      order.forEach((idx, rank) => {
        const h = rank % 2 === 0 ? leadH : leadH + 180
        out[idx] = hslToRgb(h, 0.75, 0.5)
      })
      break
    case 'simultaneous':
      // 同時対比：主役だけ色を持ち、ほかは主役と同じ明るさの灰色（灰色が補色を帯びて見える）
      for (let i = 0; i < out.length; i++) if (i !== lead) out[i] = hslToRgb(0, 0, leadL)
      break
    case 'saturation':
      // 彩度の対比：主役だけ鮮やか、ほかは灰色を混ぜて彩度を落とす
      for (let i = 0; i < out.length; i++) {
        const [h, s, l] = rgbToHsl(out[i])
        out[i] = i === lead ? hslToRgb(h, Math.max(0.9, s), l) : hslToRgb(h, s * 0.18, l)
      }
      break
  }
  return out
}

// ───────────────────────── 4. 色調

/** モノトーンの 7 段階の明るさ（イッテンの色彩球の 7 つの明度段階）。背景と重ならない範囲を使う */
export function monoSteps(bg: RGB): number[] {
  const light = luminance(bg) > 0.35
  const lo = light ? 0.08 : 0.2
  const hi = light ? 0.74 : 0.92
  return Array.from({ length: 7 }, (_, i) => lo + ((hi - lo) * i) / 6)
}

/** 色の見かけの明るさを保った灰色の値（0..1） */
function greyValue(rgb: RGB): number {
  return Math.pow(luminance(rgb), 1 / 2.2)
}

export function applyTone(shapes: Shape[], colors: RGB[], tone: Settings['tone'], bg: RGB): RGB[] {
  if (tone === 'color' || colors.length === 0) return colors
  const steps = monoSteps(bg)
  const values = colors.map(greyValue)
  const nearest = (v: number) => steps.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))
  let quantized = values.map(nearest)

  // 同じ灰色ばかりなら、元の明るさの順を保ったまま 7 段階に散らす
  const distinct = new Set(quantized).size
  if (colors.length > 1 && distinct < Math.min(colors.length, 3)) {
    const byValue = [...values.keys()].sort((a, b) => values[a] - values[b])
    quantized = values.slice()
    byValue.forEach((idx, rank) => {
      quantized[idx] = steps[Math.round((rank * 6) / (byValue.length - 1))]
    })
  }

  const accent = tone === 'accent' ? (importanceOrder(shapes).find((i) => isChromatic(colors[i])) ?? -1) : -1
  return colors.map((c, i) => {
    if (i === accent) return c
    const g = quantized[i] * 255
    return [g, g, g] as RGB
  })
}

// ───────────────────────── まとめ

/**
 * 図形ごとの最終的な色。layout.ts と、カオスモードの両方から使う。
 * 背景との対比補正を先に行い、そのあとで対比モードを適用する
 * （同時対比の「主役と同じ明るさの灰色」が、無彩色向けの強い補正で塗り替えられないように）。
 */
export function resolveColors(shapes: Shape[], settings: Settings, options: { theory: boolean }): RGB[] {
  const bg = hexToRgb(settings.background)
  let colors = shapes.map((s) => (options.theory ? baseColor(s, settings) : hexToRgb(s.color)))
  if (options.theory) {
    colors = colors.map((c, i) => ittenAdjust(c, bg, shapes[i].contrast))
    colors = applyContrastMode(shapes, colors, settings.contrastMode, bg)
  }
  return applyTone(shapes, colors, settings.tone, bg)
}
