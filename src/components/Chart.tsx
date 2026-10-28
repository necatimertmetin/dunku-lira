import { useEffect, useMemo, useRef, useState } from 'react'
import type { Point } from '../lib/calc'
import { monthLabel, times } from '../lib/format'

interface Props {
  points: Point[]
  log: boolean
}

const SERIES = [
  { key: 'cpi', label: 'Fiyatlar (TÜFE)', color: 'var(--c-cpi)' },
  { key: 'usd', label: 'Dolar', color: 'var(--c-usd)' },
  { key: 'eur', label: 'Euro', color: 'var(--c-eur)' },
] as const

const H = 300
const PAD = { l: 48, r: 16, t: 16, b: 28 }

export default function Chart({ points, log }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(320)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    if (!wrap.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])

  const { x, y, ticks, paths } = useMemo(() => {
    const vals = points.flatMap((p) => [p.cpi, p.usd ?? p.cpi, p.eur ?? p.cpi])
    const max = Math.max(...vals) * 1.05
    const min = log ? Math.min(...vals) * 0.95 : 0
    const f = (v: number) => (log ? Math.log(v) : v)
    const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - (f(v) - f(min)) / (f(max) - f(min)))
    const x = (i: number) => PAD.l + ((w - PAD.l - PAD.r) * i) / Math.max(1, points.length - 1)
    // y ticks: "1x, 2x, 5x, 10x ..." in rebased units (100 = 1x)
    const cands = [100, 150, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000, 50000, 100000]
    let ticks = cands.filter((v) => v >= min && v <= max)
    if (!log) {
      const step = cands.find((s) => max / s <= 6 && s >= 100) ?? 100000
      ticks = []
      for (let v = 0; v <= max; v += step) ticks.push(v)
    }
    const paths = SERIES.map((s) => {
      let d = ''
      points.forEach((p, i) => {
        const v = p[s.key]
        if (v == null) return
        d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
      })
      return { ...s, d }
    })
    return { x, y, ticks, paths }
  }, [points, log, w])

  if (points.length < 2) return null
  const yearTicks = points.map((p, i) => ({ p, i })).filter(({ p }) => p.month.endsWith('-01'))
  const every = Math.ceil(yearTicks.length / Math.max(2, Math.floor(w / 70)))
  const hp = hover !== null ? points[hover] : null

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const i = Math.round(((px - PAD.l) / (w - PAD.l - PAD.r)) * (points.length - 1))
    setHover(Math.min(points.length - 1, Math.max(0, i)))
  }

  return (
    <div className="chart" ref={wrap}>
      <div className="chart-legend">
        {SERIES.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg width={w} height={H} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Fiyatlar, dolar ve euro karşılaştırma grafiği">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={w - PAD.r} y1={y(t || 1)} y2={y(t || 1)} className="grid-line" />
            <text x={PAD.l - 6} y={y(t || 1) + 4} className="axis" textAnchor="end">
              {t === 0 ? '0' : times(t / 100).replace(' kat', '×')}
            </text>
          </g>
        ))}
        {yearTicks
          .filter((_, k) => k % every === 0)
          .map(({ p, i }) => (
            <text key={p.month} x={x(i)} y={H - 8} className="axis" textAnchor="middle">
              {p.month.slice(0, 4)}
            </text>
          ))}
        {paths.map((p) => (
          <path key={p.key} d={p.d} fill="none" stroke={p.color} strokeWidth={2.2} strokeLinejoin="round" />
        ))}
        {hp && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="cross" />
            {SERIES.map((s) =>
              hp[s.key] != null ? <circle key={s.key} cx={x(hover)} cy={y(hp[s.key]!)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> : null,
            )}
          </g>
        )}
      </svg>
      <div className="chart-tip" aria-live="polite">
        {hp ? (
          <>
            <b>{monthLabel(hp.month)}</b>
            {SERIES.map((s) =>
              hp[s.key] != null ? (
                <span key={s.key}>
                  <i style={{ background: s.color }} /> {s.label}: {times(hp[s.key]! / 100)}
                </span>
              ) : null,
            )}
          </>
        ) : (
          <span className="muted">Grafiğin üzerinde gezin: başlangıca göre kaç kat arttığını gösterir.</span>
        )}
      </div>
    </div>
  )
}
