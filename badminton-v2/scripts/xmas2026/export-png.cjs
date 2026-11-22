// Exports every magnet on docs/xmas2026/ref-magnets-all.html to PNG files, using the page's own export code
// (magnetSVG(..., true) drawn to a 600 x 900 canvas), so the files are identical to the page's PNG buttons.
//   node scripts/xmas2026/export-png.cjs <out-dir> [hl|full]
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const ROOT = 'D:/ZZWES/wApps/Badminton_v2_app/badminton-v2'
const out = path.resolve(process.argv[2] || `${ROOT}/scripts/xmas2026/png`)
const mode = process.argv[3] || 'hl'
fs.mkdirSync(out, { recursive: true })

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto('file:///' + `${ROOT}/docs/xmas2026/ref-magnets-all.html`)
  const files = await page.evaluate(async (mode) => {
    MODE = mode
    const res = []
    for (const p of PLAYERS) for (const t of FRAMES) {
      const img = new Image()
      await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(magnetSVG(t, p, true)) })
      const c = document.createElement('canvas'); c.width = W; c.height = H
      c.getContext('2d').drawImage(img, 0, 0)
      const g = c.getContext('2d').getImageData(0, 0, W, H).data
      res.push({ name: `magnet-${slug(p.name)}-${t.id === 'candy' ? 'A' : 'D'}.png`, data: c.toDataURL('image/png').split(',')[1],
        photoAlpha: g[(350 * W + 300) * 4 + 3], cornerAlpha: g[3] })
    }
    return res
  }, mode)
  for (const f of files) fs.writeFileSync(path.join(out, f.name), Buffer.from(f.data, 'base64'))
  const bad = files.filter((f) => f.photoAlpha !== 0 || f.cornerAlpha !== 255).map((f) => f.name)
  console.log(`wrote ${files.length} PNGs to ${out} (mode ${mode}); bad renders: ${bad.length ? bad.join(', ') : 'none'}`)
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
