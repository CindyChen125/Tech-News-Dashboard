import type { Item, NewsFile, Section } from '../types.ts'
import { ActivityChart } from '../components/ActivityChart.tsx'
import { SectionDot } from '../components/SectionDot.tsx'
import { topStories, trendingTerms } from '../lib/rank.ts'
import { timeAgo } from '../lib/time.ts'
import { feedHref } from '../lib/useRoute.ts'

type Props = { news: NewsFile; now: Date }

const pad = (n: number) => String(n).padStart(2, '0')

function Panel({ label, action, children, className = '' }: { label: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        <h2><span className="slashes">//</span> {label}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function LatestList({ items, section, now }: { items: Item[]; section: Section; now: Date }) {
  const latest = items.filter((i) => i.section === section).slice(0, 6)
  return (
    <ol className="compact-list">
      {latest.map((item) => (
        <li key={item.id}>
          <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
          <span className="meta">
            <SectionDot section={item.section} />
            {item.source} · {timeAgo(item.publishedAt, now.getTime())}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function Home({ news, now }: Props) {
  const t = now.getTime()
  const last24h = news.items.filter((i) => t - new Date(i.publishedAt).getTime() <= 86_400_000)
  const stories = topStories(news.items, t, { limit: 5 })
  const trending = trendingTerms(news.items, t)
  const online = news.sources.filter((s) => s.ok).length
  const [featured, ...rest] = stories

  const stats = [
    { label: 'Articles · 24h', value: last24h.length },
    { label: 'AI · 24h', value: last24h.filter((i) => i.section === 'ai').length, section: 'ai' as const },
    { label: 'Tech · 24h', value: last24h.filter((i) => i.section === 'tech').length, section: 'tech' as const },
    { label: 'Sources online', value: `${online}/${news.sources.length}` },
  ]

  const dateline = now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">{dateline.toUpperCase()} · {pad(now.getHours())}:{pad(now.getMinutes())}</p>
        <h1>What's happening in <span className="gradient-text">tech &amp; AI</span></h1>
        <p className="hero-sub">{news.items.length} articles from {news.sources.length} sources over the last 30 days, grouped and ranked automatically.</p>
      </section>

      <div className="stats">
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <span className="stat-label">{s.section && <SectionDot section={s.section} />}{s.label}</span>
            <span className="stat-value">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="grid">
        <Panel label="TOP STORIES" className="span-2" action={<a className="panel-link" href="#/feed">all news →</a>}>
          {featured && (
            <article className="featured">
              <div className="rank">01</div>
              <div>
                <div className="meta">
                  <SectionDot section={featured.lead.section} />
                  {featured.lead.source} · {timeAgo(featured.lead.publishedAt, t)}
                </div>
                <a className="featured-title" href={featured.lead.url} target="_blank" rel="noreferrer">
                  {featured.lead.title}
                </a>
                {featured.lead.summary && <p className="featured-summary">{featured.lead.summary}</p>}
                <div className="coverage">
                  <span className="coverage-count">{featured.items.length} articles · {featured.sources.length} sources</span>
                  {featured.sources.map((s) => <span key={s} className="tag">{s}</span>)}
                </div>
              </div>
            </article>
          )}
          <ol className="story-list">
            {rest.map((story, i) => (
              <li key={story.lead.id}>
                <span className="rank small">{pad(i + 2)}</span>
                <div>
                  <a href={story.lead.url} target="_blank" rel="noreferrer">{story.lead.title}</a>
                  <span className="meta">
                    <SectionDot section={story.lead.section} />
                    {story.sources.slice(0, 3).join(', ')}
                    {story.sources.length > 3 && ` +${story.sources.length - 3}`}
                    {story.items.length > 1 && ` · ${story.items.length} articles`}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="stack">
          <Panel label="TRENDING · 48H">
            {trending.length === 0 ? (
              <p className="empty">Nothing is trending across sources yet.</p>
            ) : (
              <div className="trending">
                {trending.map(({ term, sources }) => (
                  <a key={term} className="term" href={feedHref({ q: term })} title={`Mentioned by ${sources} sources`}>
                    <span className="hash">#</span>{term}<span className="term-count">×{sources}</span>
                  </a>
                ))}
              </div>
            )}
          </Panel>

          <Panel label="ACTIVITY · 7 DAYS">
            <ActivityChart items={news.items} now={now} />
          </Panel>
        </div>

        <Panel label="LATEST · AI" action={<a className="panel-link" href={feedHref({ section: 'ai' })}>more →</a>}>
          <LatestList items={news.items} section="ai" now={now} />
        </Panel>

        <Panel label="LATEST · TECH" action={<a className="panel-link" href={feedHref({ section: 'tech' })}>more →</a>}>
          <LatestList items={news.items} section="tech" now={now} />
        </Panel>

        <Panel label="SOURCES">
          <ul className="source-list">
            {news.sources.map((s) => {
              const week = news.items.filter((i) => i.source === s.name && t - new Date(i.publishedAt).getTime() <= 7 * 86_400_000).length
              return (
                <li key={s.name} title={s.ok ? undefined : `Last fetch failed: ${s.error}`}>
                  <span className="health" data-ok={s.ok} aria-label={s.ok ? 'online' : 'failed'} />
                  <a href={feedHref({ source: s.name })}>{s.name}</a>
                  <span className="source-count">{week}<span className="unit">/7d</span></span>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>
    </main>
  )
}
