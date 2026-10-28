export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

const tl0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 })
const tl2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 1234567.8 -> "1.234.568 TL"; small amounts keep kuruş. */
export function tl(n: number): string {
  return `${Math.abs(n) < 100 ? tl2.format(n) : tl0.format(n)} TL`
}

export function money(n: number, symbol: string): string {
  return `${Math.abs(n) < 100 ? tl2.format(n) : tl0.format(n)} ${symbol}`
}

export function pct(n: number, digits = 1): string {
  return `%${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)}`
}

export function times(n: number): string {
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n)} kat`
}

export function monthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return `${MONTHS[mo - 1]} ${y}`
}

/** Parses "1.250,50" or "1250.5" or "1250" into a number. */
export function parseAmount(s: string): number {
  const t = s.trim().replace(/\s|TL|₺/gi, '')
  if (!t) return NaN
  // Turkish format: dots for thousands, comma for decimals
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'))
  // "1.250" is a thousand separator, "12.5" a decimal
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''))
  return Number(t)
}

export function formatInput(n: number): string {
  return tl0.format(n)
}
