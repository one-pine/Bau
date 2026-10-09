// アイコン・スプラッシュの元画像（assets/*.png）を SVG から生成する。
// 使い方: node assets/src/build.mjs <playwright のパス>  →  npx capacitor-assets generate
// 注意: capacitor-assets は public/manifest.webmanifest と public/icon.svg も上書き・削除するので、実行後に差分を確認する。
// デザイン確定後に実行する（2026-10 時点では未生成）。
import fs from 'node:fs'
import path from 'node:path'
const pw = await import(process.argv[2] ?? 'playwright')
const { chromium } = pw.default ?? pw
const dir = path.dirname(new URL(import.meta.url).pathname)
const mark = fs.readFileSync(path.join(dir, 'mark.svgfrag'), 'utf8')
const PAPER = '#f2eee3'

// mark は 512×512 の座標系。size の正方形の中央に scale 倍で置く
const svg = (size, bg, scale) => {
  const off = (size - 512 * scale) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}
<g transform="translate(${off} ${off}) scale(${scale})">${mark}</g></svg>`
}
const solid = (size, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="${bg}"/></svg>`

const out = path.join(dir, '..')
const jobs = [
  ['icon-only.png', 1024, svg(1024, PAPER, 2)],
  // Android アダプティブアイコンは中央 66% が安全領域
  ['icon-foreground.png', 1024, svg(1024, null, 1.25)],
  ['icon-background.png', 1024, solid(1024, PAPER)],
  ['splash.png', 2732, svg(2732, PAPER, 1.2)],
  ['splash-dark.png', 2732, svg(2732, '#121212', 1.2).replace('fill="#111"', 'fill="#f2eee3"')],
]
const browser = await chromium.launch()
for (const [name, size, markup] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${markup}`)
  await page.screenshot({ path: path.join(out, name), omitBackground: true })
  await page.close()
}
await browser.close()
console.log('generated', jobs.map((j) => j[0]).join(', '))
