// Builds src/data/series.json:
//  - cpi: Türkiye CPI index (2015 = 100), monthly, from the OECD SDMX API
//    (which republishes TÜİK), extended with the newest TÜİK monthly changes
//    from data/tuik-monthly.json
//  - usd, eur: monthly average TRY price of 1 USD / 1 EUR, from Frankfurter (ECB)
// Run: node scripts/fetch-data.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const OUT = 'src/data/series.json'
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null

const START = '2005-01'
const OECD =
  'https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0/TUR.M.N.CPI.IX._T.N._Z' +
  `?startPeriod=${START}&dimensionAtObservation=AllDimensions&format=csvfilewithlabels`

async function get(url, as = 'json') {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'dunku-lira-data/1.0' } })
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return as === 'json' ? await res.json() : await res.text()
    } catch (err) {
      if (attempt === 5) throw err
      await new Promise((r) => setTimeout(r, 5000 * attempt))
    }
  }
}

function parseCsv(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/)
  const split = (l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, ''))
  const cols = split(head)
  return lines.map((l) => Object.fromEntries(split(l).map((v, i) => [cols[i], v])))
}

const nextMonth = (m) => {
  const [y, mo] = m.split('-').map(Number)
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
}

// --- CPI (OECD is flaky now and then: keep the last good OECD part if it fails)
let cpi = {}
try {
  for (const r of parseCsv(await get(OECD, 'text'))) cpi[r.TIME_PERIOD] = Number(r.OBS_VALUE)
} catch (err) {
  if (!previous) throw err
  console.warn(`OECD unavailable (${err.message}); reusing CPI up to ${previous.cpiOecdUntil}`)
  cpi = Object.fromEntries(Object.entries(previous.cpi).filter(([m]) => m <= previous.cpiOecdUntil))
}
const months = Object.keys(cpi).sort()
if (months.length < 200) throw new Error(`OECD CPI looks short: ${months.length} months`)
let last = months[months.length - 1]
const oecdLast = last

const tuik = JSON.parse(readFileSync('data/tuik-monthly.json', 'utf8'))
for (const m of Object.keys(tuik.changes).sort()) {
  if (cpi[m]) continue
  if (m !== nextMonth(last)) throw new Error(`Gap in CPI: have ${last}, next manual month is ${m}`)
  cpi[m] = Math.round(cpi[last] * (1 + tuik.changes[m] / 100) * 1000) / 1000
  last = m
}
for (const [m, pct] of Object.entries(tuik.checks)) {
  if (m.startsWith('_') || !cpi[m]) continue
  const dec = `${Number(m.slice(0, 4)) - 1}-12`
  const got = (cpi[m] / cpi[dec] - 1) * 100
  if (Math.abs(got - pct) > 0.15) throw new Error(`Cumulative check failed for ${m}: ${got.toFixed(2)} vs ${pct}`)
}

// --- FX (monthly averages)
const today = new Date().toISOString().slice(0, 10)
async function monthly(base) {
  const json = await get(`https://api.frankfurter.dev/v1/${START}-01..${today}?base=${base}&symbols=TRY`)
  const acc = {}
  for (const [day, r] of Object.entries(json.rates)) {
    const m = day.slice(0, 7)
    ;(acc[m] ??= []).push(r.TRY)
  }
  return Object.fromEntries(
    Object.entries(acc)
      .sort()
      .map(([m, v]) => [m, Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10000) / 10000]),
  )
}
const usd = await monthly('USD')
const eur = await monthly('EUR')

const out = {
  updated: today,
  cpiBase: '2015=100',
  cpiOecdUntil: oecdLast,
  cpiLast: last,
  cpi: Object.fromEntries(Object.entries(cpi).sort()),
  usd,
  eur,
}
writeFileSync(OUT, JSON.stringify(out) + '\n')
console.log(`CPI ${START}..${last} (OECD until ${oecdLast}), FX until ${Object.keys(usd).pop()}`)
