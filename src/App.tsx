import { useEffect, useMemo, useState } from 'react'
import './App.css'
import data from './data/series.json'
import Chart from './components/Chart'
import { compute, deflate, rebased, salaryCheck, yearlyTable, type Rates, type Series } from './lib/calc'
import { MONTHS, formatInput, money, monthLabel, parseAmount, pct, times, tl } from './lib/format'

const S = data as Series
const ALL_MONTHS = Object.keys(S.cpi).sort()
const FIRST = ALL_MONTHS[0]
const LAST = S.cpiLast
const FIRST_YEAR = Number(FIRST.slice(0, 4))
const LAST_YEAR = Number(LAST.slice(0, 4))
const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => LAST_YEAR - i)

function shift(m: string, years: number): string {
  const y = Number(m.slice(0, 4)) - years
  return `${Math.max(FIRST_YEAR, y)}${m.slice(4)}`
}

function readHash(): { amount: number; month: string; mode: 'past' | 'today' } | null {
  const q = new URLSearchParams(location.hash.slice(1))
  const amount = Number(q.get('t'))
  const month = q.get('ay') ?? ''
  if (!amount || !S.cpi[month]) return null
  return { amount, month, mode: q.get('yon') === 'geri' ? 'today' : 'past' }
}

function MonthPicker({ value, onChange, label }: { value: string; onChange: (m: string) => void; label: string }) {
  const [y, m] = value.split('-')
  const clamp = (yy: string, mm: string) => {
    let v = `${yy}-${mm}`
    if (v > LAST) v = LAST
    if (v < FIRST) v = FIRST
    onChange(v)
  }
  return (
    <span className="picker" aria-label={label}>
      <select value={m} onChange={(e) => clamp(y, e.target.value)} aria-label={`${label} ay`}>
        {MONTHS.map((name, i) => {
          const mm = String(i + 1).padStart(2, '0')
          return (
            <option key={mm} value={mm} disabled={`${y}-${mm}` > LAST}>
              {name}
            </option>
          )
        })}
      </select>
      <select value={y} onChange={(e) => clamp(e.target.value, m)} aria-label={`${label} yıl`}>
        {YEARS.map((yy) => (
          <option key={yy}>{yy}</option>
        ))}
      </select>
    </span>
  )
}

function AmountInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [text, setText] = useState(formatInput(value))
  useEffect(() => {
    if (parseAmount(text) !== value) setText(formatInput(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <span className="amount">
      <input
        inputMode="decimal"
        value={text}
        aria-label={label}
        onChange={(e) => {
          setText(e.target.value)
          const n = parseAmount(e.target.value)
          if (Number.isFinite(n) && n > 0) onChange(n)
        }}
        onBlur={() => setText(formatInput(value))}
      />
      <span className="unit">TL</span>
    </span>
  )
}

export default function App() {
  const initial = readHash()
  const [amount, setAmount] = useState(initial?.amount ?? 100)
  const [month, setMonth] = useState(initial?.month ?? shift(LAST, 10))
  const [mode, setMode] = useState<'past' | 'today'>(initial?.mode ?? 'past')
  const [rates, setRates] = useState<Rates | null>(null)
  const [copied, setCopied] = useState(false)

  const [oldSalary, setOldSalary] = useState(20_000)
  const [salaryMonth, setSalaryMonth] = useState(shift(LAST, 1))
  const [newSalary, setNewSalary] = useState(25_000)

  const [chartFrom, setChartFrom] = useState(FIRST)
  const [log, setLog] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    Promise.all(
      ['USD', 'EUR'].map((b) =>
        fetch(`https://api.frankfurter.dev/v1/latest?base=${b}&symbols=TRY`, { signal: ctrl.signal })
          .then((r) => r.json())
          .then((j) => j.rates.TRY as number),
      ),
    )
      .then(([usd, eur]) => usd && eur && setRates({ usd, eur }))
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  useEffect(() => {
    const q = new URLSearchParams({ t: String(amount), ay: month })
    if (mode === 'today') q.set('yon', 'geri')
    history.replaceState(null, '', `#${q}`)
  }, [amount, month, mode])

  const r = useMemo(() => compute(S, amount, month, LAST, rates ?? undefined), [amount, month, rates])
  const back = useMemo(() => deflate(S, amount, month), [amount, month])
  const sal = useMemo(() => salaryCheck(S, oldSalary, salaryMonth, newSalary), [oldSalary, salaryMonth, newSalary])
  const points = useMemo(() => rebased(S, chartFrom), [chartFrom])
  const table = useMemo(() => yearlyTable(S).reverse(), [])

  const headline =
    mode === 'past'
      ? `${monthLabel(month)} tarihindeki ${tl(amount)}, bugün ${tl(r.today)} ediyor.`
      : `Bugünkü ${tl(amount)}, ${monthLabel(month)} tarihinde ${tl(back)} ediyordu.`

  const share = async () => {
    const text = `${headline} (Dünkü Lira)`
    const url = location.href
    if ('share' in navigator) {
      try {
        await navigator.share({ title: 'Dünkü Lira', text, url })
        return
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* blocked */
    }
  }

  const rateNote = rates ? 'anlık kur' : `${monthLabel(Object.keys(S.usd).sort().pop()!)} ortalama kuru`
  const best = r.usd && r.eur ? Math.max(r.today, r.usd.nowTry, r.eur.nowTry) : r.today

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="./">
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
            <rect width="32" height="32" rx="9" className="brand-bg" />
            <path d="M12 7v18M12 13l9-4M12 18l9-4M12 25c6 0 9-3 9-8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Dünkü Lira</span>
        </a>
        <span className="muted small">Veriler: {monthLabel(LAST)} TÜFE</span>
      </header>

      <main>
        <section className="calc card">
          <div className="modes" role="tablist">
            <button role="tab" aria-selected={mode === 'past'} className={mode === 'past' ? 'on' : ''} onClick={() => setMode('past')}>
              Geçmişteki para bugün kaç lira?
            </button>
            <button role="tab" aria-selected={mode === 'today'} className={mode === 'today' ? 'on' : ''} onClick={() => setMode('today')}>
              Bugünkü para eskiden kaç liraydı?
            </button>
          </div>

          <p className="sentence">
            {mode === 'past' ? (
              <>
                <MonthPicker value={month} onChange={setMonth} label="Tarih" /> tarihindeki <AmountInput value={amount} onChange={setAmount} label="Tutar" />
              </>
            ) : (
              <>
                Bugünkü <AmountInput value={amount} onChange={setAmount} label="Tutar" />, <MonthPicker value={month} onChange={setMonth} label="Tarih" /> tarihinde
              </>
            )}
          </p>
          <p className="big" aria-live="polite">
            {mode === 'past' ? tl(r.today) : tl(back)}
            <small>{mode === 'past' ? `${monthLabel(LAST)} fiyatlarıyla` : 'ederdi'}</small>
          </p>

          <div className="quick">
            {[1, 5, 10, 15, 20].map((n) => (
              <button key={n} className={'chip' + (month === shift(LAST, n) ? ' on' : '')} onClick={() => setMonth(shift(LAST, n))}>
                {n} yıl önce
              </button>
            ))}
          </div>

          <div className="facts">
            <div className="fact">
              <span className="k">{times(r.ratio)}</span>
              <span className="l">fiyatlar arttı ({pct(r.inflationPct, 0)})</span>
            </div>
            <div className="fact">
              <span className="k">{pct(r.lossPct, 0)}</span>
              <span className="l">alım gücü kaybı</span>
            </div>
            <div className="fact">
              <span className="k">{pct(r.yearlyPct)}</span>
              <span className="l">yıllık ortalama enflasyon</span>
            </div>
          </div>

          {mode === 'past' && r.usd && r.eur && (
            <div className="compare">
              <h3>{tl(amount)} o gün ne yapılsaydı?</h3>
              {[
                { key: 'tl', label: 'Yastık altında TL olarak kalsaydı', value: amount, note: 'bugün değeri eriyor', bad: true },
                { key: 'cpi', label: 'Enflasyon kadar artsaydı (alım gücü aynı kalsın)', value: r.today, note: 'TÜFE' },
                {
                  key: 'usd',
                  label: `Dolar alınsaydı (${money(r.usd.then, '$')})`,
                  value: r.usd.nowTry,
                  note: `o gün 1$ = ${r.usd.rateThen.toFixed(2).replace('.', ',')} TL, ${rateNote} ${r.usd.rateNow.toFixed(2).replace('.', ',')} TL`,
                },
                {
                  key: 'eur',
                  label: `Euro alınsaydı (${money(r.eur.then, '€')})`,
                  value: r.eur.nowTry,
                  note: `o gün 1€ = ${r.eur.rateThen.toFixed(2).replace('.', ',')} TL, ${rateNote} ${r.eur.rateNow.toFixed(2).replace('.', ',')} TL`,
                },
              ].map((row) => (
                <div key={row.key} className={'bar-row' + (row.bad ? ' bad' : '')}>
                  <div className="bar-head">
                    <span>{row.label}</span>
                    <b>{tl(row.value)}</b>
                  </div>
                  <div className="bar-track">
                    <span className={`bar-fill ${row.key}`} style={{ width: `${Math.max(1, (row.value / best) * 100)}%` }} />
                  </div>
                  <small className="muted">{row.note}</small>
                </div>
              ))}
              <p className="muted small">
                {r.usd.nowTry > r.today
                  ? `Bu dönemde dolar, fiyatlardan ${pct((r.usd.nowTry / r.today - 1) * 100, 0)} daha hızlı arttı: dolar tutan alım gücünü korumanın da ötesine geçti.`
                  : `Bu dönemde fiyatlar dolardan ${pct((r.today / r.usd.nowTry - 1) * 100, 0)} daha hızlı arttı: dolar tutmak bile alım gücünü korumaya yetmedi.`}
              </p>
            </div>
          )}

          <div className="share-row">
            <p className="headline">“{headline}”</p>
            <button className="btn primary" onClick={share}>
              {copied ? 'Kopyalandı' : 'Paylaş'}
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Maaşım eridi mi?</h2>
          <p className="muted small">Eski maaşını, aldığın tarihi ve şimdiki maaşını gir; zammın enflasyonu karşılayıp karşılamadığını gör.</p>
          <div className="salary-form">
            <label>
              Eski maaş
              <AmountInput value={oldSalary} onChange={setOldSalary} label="Eski maaş" />
            </label>
            <label>
              Tarih
              <MonthPicker value={salaryMonth} onChange={setSalaryMonth} label="Eski maaş tarihi" />
            </label>
            <label>
              Şimdiki maaş
              <AmountInput value={newSalary} onChange={setNewSalary} label="Şimdiki maaş" />
            </label>
          </div>
          <div className={'verdict ' + (sal.realPct >= 0 ? 'good' : 'bad')}>
            <b>
              {sal.realPct >= 0
                ? `Alım gücün ${pct(sal.realPct)} arttı.`
                : `Alım gücün ${pct(-sal.realPct)} azaldı.`}
            </b>
            <span>
              Zammın {pct(sal.nominalPct)}, aynı dönemde fiyatlar {pct((sal.needed / oldSalary - 1) * 100)} arttı. Eski alım gücünü
              korumak için bugün <b>{tl(sal.needed)}</b> alman gerekirdi. Şimdiki maaşın, {monthLabel(salaryMonth)} parasıyla{' '}
              {tl(sal.inOldLira)} ediyor.
            </span>
          </div>
          <p className="muted tiny">Örnek değerlerle başlar; kendi maaşını yaz. Girdiğin bilgiler hiçbir yere gönderilmez.</p>
        </section>

        <section className="card">
          <div className="row between">
            <h2>Fiyatlar mı, dolar mı daha hızlı arttı?</h2>
            <div className="row">
              <label className="muted small">
                Başlangıç{' '}
                <select value={chartFrom.slice(0, 4)} onChange={(e) => setChartFrom(`${e.target.value}-01`)}>
                  {YEARS.filter((y) => y < LAST_YEAR).map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </label>
              <label className="check small">
                <input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} /> Logaritmik
              </label>
            </div>
          </div>
          <Chart points={points} log={log} />
        </section>

        <section className="card">
          <h2>Yıl yıl enflasyon ve dolar</h2>
          <div className="table-wrap">
            <table className="years">
              <thead>
                <tr>
                  <th>Yıl</th>
                  <th>Enflasyon (TÜFE)</th>
                  <th>Dolar/TL değişimi</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row) => (
                  <tr key={row.year}>
                    <td>
                      {row.year}
                      {row.partial && <small className="muted"> ({MONTHS[Number(LAST.slice(5)) - 1].toLowerCase()} itibarıyla)</small>}
                    </td>
                    <td>
                      <span className="cell-bar cpi" style={{ width: `${Math.min(100, row.cpiPct)}%` }} />
                      {pct(row.cpiPct)}
                    </td>
                    <td>
                      {row.usdPct != null && (
                        <>
                          <span className="cell-bar usd" style={{ width: `${Math.min(100, Math.max(0, row.usdPct))}%` }} />
                          {pct(row.usdPct)}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted tiny">Enflasyon: aralık ayının bir önceki aralığa göre değişimi. Dolar: aralık ayı ortalama kurunun değişimi.</p>
        </section>
      </main>

      <footer className="foot">
        <p>
          Kaynaklar: TÜİK tüketici fiyat endeksi (OECD üzerinden; {monthLabel(S.cpiOecdUntil)} sonrası TÜİK aylık açıklamaları), döviz kurları
          Avrupa Merkez Bankası (Frankfurter). Veriler {S.updated.split('-').reverse().join('.')} tarihinde güncellendi.
        </p>
        <p>Hesaplar resmî TÜFE'ye göredir; kişisel enflasyonun harcama sepetine göre farklı olabilir. Yatırım tavsiyesi değildir.</p>
        <p>
          <a href="https://github.com/necatimertmetin/dunku-lira" target="_blank" rel="noreferrer">
            Açık kaynak · GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}
