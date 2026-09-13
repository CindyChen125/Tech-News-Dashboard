import { useMemo, useState } from 'react'
import type { Item, NewsFile, Section } from '../types.ts'
import { SectionDot } from '../components/SectionDot.tsx'
import { dayLabel, timeAgo } from '../lib/time.ts'

type SectionFilter = Section | 'all'

const SECTIONS: { key: SectionFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ai', label: 'AI' },
  { key: 'tech', label: 'Tech' },
]

function groupByDay(items: Item[], now: Date): [string, Item[]][] {
  const groups = new Map<string, Item[]>()
  for (const item of items) {
    const label = dayLabel(item.publishedAt, now)
    groups.set(label, [...(groups.get(label) ?? []), item])
  }
  return [...groups]
}

type Props = { news: NewsFile; now: Date; params: URLSearchParams }

export function Feed({ news, now, params }: Props) {
  const initialSection = params.get('section')
  const [section, setSection] = useState<SectionFilter>(initialSection === 'ai' || initialSection === 'tech' ? initialSection : 'all')
  const [selectedSources, setSelectedSources] = useState<Set<string>>(() => new Set(params.getAll('source')))
  const [query, setQuery] = useState(params.get('q') ?? '')

  // A section's sources are whoever has articles in it — The Verge shows up under AI when it covers AI.
  const visibleSources = news.sources.filter(
    (s) => section === 'all' || news.items.some((i) => i.source === s.name && i.section === section),
  )

  const items = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return news.items.filter((i) => {
      if (section !== 'all' && i.section !== section) return false
      if (selectedSources.size > 0 && !selectedSources.has(i.source)) return false
      const text = `${i.title} ${i.summary}`.toLowerCase()
      return words.every((w) => text.includes(w))
    })
  }, [news, section, selectedSources, query])

  const countFor = (key: SectionFilter) => news.items.filter((i) => key === 'all' || i.section === key).length

  const toggleSource = (name: string) =>
    setSelectedSources((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const failed = news.sources.filter((s) => !s.ok)
  const filtered = selectedSources.size > 0 || query.trim() !== ''

  return (
    <main className="page page-narrow">
      <section className="hero hero-small">
        <p className="eyebrow">// FEED</p>
        <h1>Every article, newest first</h1>
      </section>

      <div className="toolbar">
        <nav className="segmented" aria-label="Section">
          {SECTIONS.map(({ key, label }) => (
            <button
              key={key}
              aria-pressed={section === key}
              onClick={() => {
                setSection(key)
                setSelectedSources(new Set())
              }}
            >
              {key !== 'all' && <SectionDot section={key} />}
              {label} <span className="count">{countFor(key)}</span>
            </button>
          ))}
        </nav>
        <label className="search">
          <span className="prompt" aria-hidden>&gt;</span>
          <input
            type="search"
            placeholder="search titles & summaries"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
          />
        </label>
      </div>

      <div className="chips" aria-label="Sources">
        {visibleSources.map((s) => (
          <button
            key={s.name}
            className="chip"
            aria-pressed={selectedSources.has(s.name)}
            data-failed={!s.ok || undefined}
            title={s.ok ? undefined : `Last fetch failed: ${s.error}`}
            onClick={() => toggleSource(s.name)}
          >
            {s.name}
          </button>
        ))}
        {filtered && (
          <button
            className="chip chip-clear"
            onClick={() => {
              setSelectedSources(new Set())
              setQuery('')
            }}
          >
            clear filters
          </button>
        )}
      </div>

      {failed.length > 0 && (
        <p className="notice">
          ⚠ Couldn't reach {failed.map((s) => s.name).join(', ')} on the last update. Showing their earlier items.
        </p>
      )}

      <p className="result-count">{items.length} {items.length === 1 ? 'article' : 'articles'}</p>

      {items.length === 0 ? (
        <p className="empty">No articles match these filters.</p>
      ) : (
        groupByDay(items, now).map(([label, dayItems]) => (
          <section key={label} className="day">
            <h2 className="day-label">{label}<span className="day-count">{dayItems.length}</span></h2>
            <ol className="items">
              {dayItems.map((item) => (
                <li key={item.id} className="item">
                  <div className="meta">
                    <SectionDot section={item.section} />
                    <span className="source">{item.source}</span>
                    <time dateTime={item.publishedAt} title={new Date(item.publishedAt).toLocaleString()}>
                      {timeAgo(item.publishedAt, now.getTime())}
                    </time>
                  </div>
                  <a className="title" href={item.url} target="_blank" rel="noreferrer">
                    {item.title}
                  </a>
                  {item.summary && <p className="summary">{item.summary}</p>}
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </main>
  )
}
