export interface Series {
  updated: string
  cpiOecdUntil: string
  cpiLast: string
  /** "YYYY-MM" -> CPI index */
  cpi: Record<string, number>
  /** "YYYY-MM" -> average TRY price of 1 USD in that month */
  usd: Record<string, number>
  eur: Record<string, number>
}

export type Month = string // "YYYY-MM"

export function monthsBetween(a: Month, b: Month): number {
  const [ya, ma] = a.split('-').map(Number)
  const [yb, mb] = b.split('-').map(Number)
  return (yb - ya) * 12 + (mb - ma)
}

export interface Result {
  from: Month
  to: Month
  amount: number
  /** Same purchasing power at `to` */
  today: number
  /** Price level ratio to/from */
  ratio: number
  /** Cumulative inflation in % */
  inflationPct: number
  /** Average yearly inflation in % */
  yearlyPct: number
  /** Share of purchasing power lost, in % */
  lossPct: number
  usd?: { then: number; nowTry: number; rateThen: number; rateNow: number }
  eur?: { then: number; nowTry: number; rateThen: number; rateNow: number }
}

export interface Rates {
  usd: number
  eur: number
}

/**
 * What `amount` lira at `from` is worth at `to` (by CPI), and what it would be
 * if it had been changed to dollars/euros at `from` and back at today's rate.
 */
export function compute(s: Series, amount: number, from: Month, to: Month = s.cpiLast, now?: Rates): Result {
  const c0 = s.cpi[from]
  const c1 = s.cpi[to]
  if (!c0 || !c1) throw new Error(`No CPI for ${!c0 ? from : to}`)
  const ratio = c1 / c0
  const n = Math.max(1, monthsBetween(from, to))
  const res: Result = {
    from,
    to,
    amount,
    today: amount * ratio,
    ratio,
    inflationPct: (ratio - 1) * 100,
    yearlyPct: (Math.pow(ratio, 12 / n) - 1) * 100,
    lossPct: (1 - 1 / ratio) * 100,
  }
  const lastFx = (r: Record<string, number>) => r[Object.keys(r).sort().pop()!]
  for (const cur of ['usd', 'eur'] as const) {
    const rateThen = s[cur][from]
    if (!rateThen) continue
    const rateNow = now?.[cur] ?? lastFx(s[cur])
    const then = amount / rateThen
    res[cur] = { then, nowTry: then * rateNow, rateThen, rateNow }
  }
  return res
}

/** Today's lira back to `from`: what `amount` would have cost then. */
export function deflate(s: Series, amount: number, from: Month, to: Month = s.cpiLast): number {
  return (amount * s.cpi[from]) / s.cpi[to]
}

export interface SalaryCheck {
  /** Salary needed now to keep the old purchasing power */
  needed: number
  /** Real change in % (negative = lost purchasing power) */
  realPct: number
  /** Nominal change in % */
  nominalPct: number
  /** The new salary expressed in lira of the old date */
  inOldLira: number
}

export function salaryCheck(s: Series, oldSalary: number, from: Month, newSalary: number, to: Month = s.cpiLast): SalaryCheck {
  const ratio = s.cpi[to] / s.cpi[from]
  const needed = oldSalary * ratio
  return {
    needed,
    realPct: (newSalary / needed - 1) * 100,
    nominalPct: (newSalary / oldSalary - 1) * 100,
    inOldLira: newSalary / ratio,
  }
}

export interface YearRow {
  year: number
  /** December over previous December, % (year to date for the latest year) */
  cpiPct: number
  /** Change in the USD rate, December average over previous December average, % */
  usdPct: number | null
  partial: boolean
}

export function yearlyTable(s: Series): YearRow[] {
  const rows: YearRow[] = []
  const last = s.cpiLast
  const lastYear = Number(last.slice(0, 4))
  const firstYear = Number(Object.keys(s.cpi).sort()[0].slice(0, 4))
  for (let y = firstYear + 1; y <= lastYear; y++) {
    const end = y === lastYear ? last : `${y}-12`
    const base = `${y - 1}-12`
    if (!s.cpi[base] || !s.cpi[end]) continue
    const fxEnd = s.usd[end]
    const fxBase = s.usd[base]
    rows.push({
      year: y,
      cpiPct: (s.cpi[end] / s.cpi[base] - 1) * 100,
      usdPct: fxEnd && fxBase ? (fxEnd / fxBase - 1) * 100 : null,
      partial: end !== `${y}-12`,
    })
  }
  return rows
}

export interface Point {
  month: Month
  cpi: number
  usd: number | null
  eur: number | null
}

/** All three series rebased to 100 at `from`. */
export function rebased(s: Series, from: Month): Point[] {
  const c0 = s.cpi[from]
  const u0 = s.usd[from]
  const e0 = s.eur[from]
  return Object.keys(s.cpi)
    .sort()
    .filter((m) => m >= from)
    .map((m) => ({
      month: m,
      cpi: (s.cpi[m] / c0) * 100,
      usd: s.usd[m] && u0 ? (s.usd[m] / u0) * 100 : null,
      eur: s.eur[m] && e0 ? (s.eur[m] / e0) * 100 : null,
    }))
}
