import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import data from './data/series.json'
import { compute, type Series } from './lib/calc'
import { tl } from './lib/format'

const S = data as Series

beforeEach(() => {
  history.replaceState(null, '', '/')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ rates: { TRY: 50 } }))))
})

describe('App', () => {
  it('shows today’s value of 100 TL from ten years ago', () => {
    render(<App />)
    const from = `${Number(S.cpiLast.slice(0, 4)) - 10}${S.cpiLast.slice(4)}`
    const expected = tl(compute(S, 100, from).today)
    expect(screen.getByText(expected, { selector: '.big' })).toBeInTheDocument()
  })

  it('recalculates when the amount changes and writes a shareable hash', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Tutar'), { target: { value: '1.000' } })
    expect(location.hash).toContain('t=1000')
    const from = new URLSearchParams(location.hash.slice(1)).get('ay')!
    expect(screen.getByText(tl(compute(S, 1000, from).today), { selector: '.big' })).toBeInTheDocument()
  })

  it('opens a shared link', () => {
    history.replaceState(null, '', '/#t=250&ay=2015-06')
    render(<App />)
    expect(screen.getByText(tl(compute(S, 250, '2015-06').today), { selector: '.big' })).toBeInTheDocument()
  })

  it('tells whether a salary kept up with inflation', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Şimdiki maaş'), { target: { value: '1.000.000' } })
    expect(screen.getByText(/Alım gücün %[\d.,]+ arttı/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Şimdiki maaş'), { target: { value: '100' } })
    expect(screen.getByText(/Alım gücün %[\d.,]+ azaldı/)).toBeInTheDocument()
  })
})
