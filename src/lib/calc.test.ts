import { describe, expect, it } from 'vitest'
import { compute, deflate, monthsBetween, rebased, salaryCheck, yearlyTable, type Series } from './calc'
import { monthLabel, parseAmount, pct, tl } from './format'
import real from '../data/series.json'

const toy: Series = {
  updated: '2026-10-28',
  cpiOecdUntil: '2025-12',
  cpiLast: '2026-12',
  cpi: { '2024-12': 100, '2025-06': 120, '2025-12': 150, '2026-06': 180, '2026-12': 200 },
  usd: { '2024-12': 10, '2025-12': 20, '2026-12': 40 },
  eur: { '2024-12': 12, '2025-12': 22 },
}

describe('monthsBetween', () => {
  it('counts months across years', () => {
    expect(monthsBetween('2024-12', '2026-12')).toBe(24)
    expect(monthsBetween('2025-11', '2026-02')).toBe(3)
  })
})

describe('compute', () => {
  const r = compute(toy, 1000, '2024-12')
  it('inflates by the CPI ratio', () => {
    expect(r.today).toBe(2000)
    expect(r.inflationPct).toBeCloseTo(100)
    expect(r.lossPct).toBeCloseTo(50)
    expect(r.yearlyPct).toBeCloseTo((Math.SQRT2 - 1) * 100)
  })
  it('converts through dollars and euros', () => {
    expect(r.usd).toEqual({ then: 100, nowTry: 4000, rateThen: 10, rateNow: 40 })
    expect(r.eur!.rateNow).toBe(22) // falls back to the last known monthly rate
    const live = compute(toy, 1000, '2024-12', undefined, { usd: 50, eur: 30 })
    expect(live.usd!.nowTry).toBe(5000)
    expect(live.eur!.nowTry).toBeCloseTo(2500)
  })
  it('throws for months without data', () => {
    expect(() => compute(toy, 1, '1999-01')).toThrow()
  })
})

describe('deflate / salaryCheck', () => {
  it('turns today’s money into past money', () => {
    expect(deflate(toy, 2000, '2024-12')).toBe(1000)
  })
  it('judges a raise against inflation', () => {
    const s = salaryCheck(toy, 10_000, '2024-12', 18_000)
    expect(s.needed).toBe(20_000)
    expect(s.realPct).toBeCloseTo(-10)
    expect(s.nominalPct).toBeCloseTo(80)
    expect(s.inOldLira).toBe(9_000)
  })
})

describe('yearlyTable / rebased', () => {
  it('computes December-on-December inflation', () => {
    const t = yearlyTable(toy)
    expect(t.map((r) => [r.year, Math.round(r.cpiPct)])).toEqual([
      [2025, 50],
      [2026, 33],
    ])
    expect(t[0].usdPct).toBeCloseTo(100)
  })
  it('rebases to 100', () => {
    const p = rebased(toy, '2025-12')
    expect(p[0]).toMatchObject({ month: '2025-12', cpi: 100, usd: 100, eur: 100 })
    expect(p[p.length - 1].cpi).toBeCloseTo(133.33, 1)
    expect(p[p.length - 1].eur).toBeNull()
  })
})

describe('real data', () => {
  const s = real as Series
  it('matches TÜİK’s published yearly inflation', () => {
    const t = yearlyTable(s)
    const byYear = Object.fromEntries(t.map((r) => [r.year, r.cpiPct]))
    expect(byYear[2022]).toBeCloseTo(64.27, 0)
    expect(byYear[2023]).toBeCloseTo(64.77, 0)
    expect(byYear[2024]).toBeCloseTo(44.38, 0)
    expect(byYear[2025]).toBeCloseTo(30.89, 0)
  })
  it('has continuous monthly CPI from 2005 to the latest month', () => {
    const months = Object.keys(s.cpi).sort()
    expect(months[0]).toBe('2005-01')
    expect(months[months.length - 1]).toBe(s.cpiLast)
    expect(months.length).toBe(monthsBetween('2005-01', s.cpiLast) + 1)
  })
  it('has the 2005 dollar near 1.35 TL', () => {
    expect(s.usd['2005-01']).toBeGreaterThan(1.3)
    expect(s.usd['2005-01']).toBeLessThan(1.4)
  })
})

describe('format', () => {
  it('formats Turkish money and percentages', () => {
    expect(tl(1234567.8)).toBe('1.234.568 TL')
    expect(tl(12.5)).toBe('12,50 TL')
    expect(pct(29.734)).toBe('%29,7')
    expect(monthLabel('2026-09')).toBe('Eylül 2026')
  })
  it('parses amounts typed the Turkish way', () => {
    expect(parseAmount('1.250')).toBe(1250)
    expect(parseAmount('1.250,50')).toBe(1250.5)
    expect(parseAmount('12.5')).toBe(12.5)
    expect(parseAmount('100 TL')).toBe(100)
    expect(parseAmount('abc')).toBeNaN()
    expect(parseAmount('')).toBeNaN()
  })
})
