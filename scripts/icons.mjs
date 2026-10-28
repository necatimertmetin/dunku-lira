// Renders the PNG icon and the social preview image (with real numbers) from SVG.
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

await sharp(readFileSync('public/favicon.svg'), { density: 600 }).resize(192, 192).png().toFile('public/icon-192.png')

const s = JSON.parse(readFileSync('src/data/series.json', 'utf8'))
const last = s.cpiLast
const from = `${Number(last.slice(0, 4)) - 10}${last.slice(4)}`
const today = Math.round((100 * s.cpi[last]) / s.cpi[from])
const fmt = (n) => new Intl.NumberFormat('tr-TR').format(n)
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#14120f"/>
  <rect x="80" y="80" width="80" height="80" rx="22" fill="#b4232a"/>
  <path d="M110 97v46M110 114l22-10M110 127l22-10M110 143c15 0 22-8 22-20" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="182" y="137" font-family="Segoe UI, Arial" font-size="56" font-weight="800" fill="#efebe4">Dünkü Lira</text>
  <text x="80" y="290" font-family="Segoe UI, Arial" font-size="46" font-weight="700" fill="#a59e92">10 yıl önceki 100 TL bugün</text>
  <text x="80" y="420" font-family="Segoe UI, Arial" font-size="130" font-weight="800" fill="#f05a5f">${fmt(today)} TL</text>
  <text x="80" y="540" font-family="Segoe UI, Arial" font-size="30" fill="#a59e92">Enflasyon, dolar ve maaş hesaplayıcı · TÜİK verisi</text>
</svg>`
await sharp(Buffer.from(og)).png().toFile('public/og.png')
console.log('icons written, 100 TL ->', today)
