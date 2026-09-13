import { useEffect, useMemo, useState } from 'react'
import type { Item, NewsFile, Section } from './types.ts'

type SectionFilter = Section | 'all'

const SECTIONS: { key: SectionFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ai', label: 'AI' },
  { key: 'tech', label: 'Tech' },
]

function timeAgo(iso: string, now: number): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function dayLabel(iso: string, now: Date): string {
  const d = new Date(iso)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

function groupByDay(items: Item[], now: Date): [string, Item[]][] {
  const groups = new Map<string, Item[]>()
  for (const item of items) {
    const label = dayLabel(item.publishedAt, now)
    groups.set(label, [...(groups.get(label) ?? []), item])
  }
  return [...groups]
}

export default function App() {
  const [news, setNews] = useState<NewsFile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [section, setSection] = useState<SectionFilter>('all')
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/news.json`, { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<NewsFile>
      })
      .then(setNews)
      .catch((err: Error) => setLoadError(err.message))
  }, [])

  // Keep "5m ago" labels honest if the tab stays open.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const visibleSources = useMemo(
    () => (news?.sources ?? []).filter((s) => section === 'all' || s.section === section),
    [news, section],
  )

  const items = useMemo(() => {
    if (!news) return []
    return news.items.filter(
      (i) => (section === 'all' || i.section === section) && (selectedSources.size === 0 || selectedSources.has(i.source)),
    )
  }, [news, section, selectedSources])

  const countFor = (key: SectionFilter) =>
    news ? news.items.filter((i) => key === 'all' || i.section === key).length : 0

  const toggleSource = (name: string) =>
    setSelectedSources((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const changeSection = (key: SectionFilter) => {
    setSection(key)
    setSelectedSources(new Set())
  }

  if (loadError) return <main className="page"><p className="notice">Couldn't load news: {loadError}</p></main>
  if (!news) return <main className="page"><p className="muted">Loading…</p></main>

  const failed = news.sources.filter((s) => !s.ok)

  return (
    <main className="page">
      <header className="header">
        <h1>Tech &amp; AI News</h1>
        <p className="muted">
          Updated {timeAgo(news.updatedAt, now.getTime())} · {news.sources.length} sources
        </p>
      </header>

      <nav className="tabs" aria-label="Section">
        {SECTIONS.map(({ key, label }) => (
          <button key={key} className="tab" aria-pressed={section === key} onClick={() => changeSection(key)}>
            {label} <span className="count">{countFor(key)}</span>
          </button>
        ))}
      </nav>

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
        {selectedSources.size > 0 && (
          <button className="chip clear" onClick={() => setSelectedSources(new Set())}>
            Clear
          </button>
        )}
      </div>

      {failed.length > 0 && (
        <p className="notice">
          Couldn't reach {failed.map((s) => s.name).join(', ')} on the last update. Showing their earlier items.
        </p>
      )}

      {items.length === 0 ? (
        <p className="muted">Nothing here yet.</p>
      ) : (
        groupByDay(items, now).map(([label, dayItems]) => (
          <section key={label} className="day">
            <h2 className="day-label">{label}</h2>
            <ol className="items">
              {dayItems.map((item) => (
                <li key={item.id} className="item">
                  <div className="meta">
                    <span className="source" data-section={item.section}>{item.source}</span>
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
