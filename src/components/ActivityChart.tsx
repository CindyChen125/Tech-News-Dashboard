import { useState } from 'react'
import type { Item } from '../types.ts'
import { daysBetween } from '../lib/time.ts'

type Day = { date: Date; ai: number; tech: number }

const DAYS = 7

function bucket(items: Item[], now: Date): Day[] {
  const days: Day[] = Array.from({ length: DAYS }, (_, i) => {
    const date = new Date(now)
    date.setDate(now.getDate() - (DAYS - 1 - i))
    return { date, ai: 0, tech: 0 }
  })
  for (const item of items) {
    const ago = daysBetween(new Date(item.publishedAt), now)
    if (ago < 0 || ago >= DAYS) continue
    days[DAYS - 1 - ago][item.section]++
  }
  return days
}

const weekday = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short' })
const longDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

export function ActivityChart({ items, now }: { items: Item[]; now: Date }) {
  const days = bucket(items, now)
  const max = Math.max(1, ...days.map((d) => d.ai + d.tech))
  const [hover, setHover] = useState<number | null>(null)

  return (
    <figure className="chart">
      <div className="legend">
        <span><span className="swatch" data-section="ai" />AI</span>
        <span><span className="swatch" data-section="tech" />Tech</span>
      </div>

      <div className="bars" onMouseLeave={() => setHover(null)}>
        {days.map((d, i) => {
          const total = d.ai + d.tech
          const isToday = i === DAYS - 1
          return (
            <div
              key={i}
              className="bar-col"
              data-active={hover === i || undefined}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${longDate(d.date)}: ${d.ai} AI, ${d.tech} tech`}
            >
              <span className="bar-total">{hover === i || isToday ? total : ''}</span>
              <div className="bar-track">
                <div className="bar" style={{ height: `${(total / max) * 100}%` }}>
                  {d.tech > 0 && <div className="seg" data-section="tech" style={{ flexGrow: d.tech }} />}
                  {d.ai > 0 && <div className="seg" data-section="ai" style={{ flexGrow: d.ai }} />}
                </div>
              </div>
              <span className="bar-label">{isToday ? 'Today' : weekday(d.date)}</span>
              {hover === i && (
                <div className="tooltip" role="presentation">
                  <strong>{longDate(d.date)}</strong>
                  <span><span className="swatch" data-section="ai" />AI <b>{d.ai}</b></span>
                  <span><span className="swatch" data-section="tech" />Tech <b>{d.tech}</b></span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <table className="sr-only">
        <caption>Articles published per day</caption>
        <thead><tr><th>Day</th><th>AI</th><th>Tech</th></tr></thead>
        <tbody>
          {days.map((d, i) => (
            <tr key={i}><td>{longDate(d.date)}</td><td>{d.ai}</td><td>{d.tech}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
