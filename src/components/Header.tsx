import type { NewsFile } from '../types.ts'
import { timeAgo } from '../lib/time.ts'
import type { Route } from '../lib/useRoute.ts'

type Props = { route: Route; news: NewsFile | null; now: Date }

export function Header({ route, news, now }: Props) {
  const online = news?.sources.filter((s) => s.ok).length ?? 0
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden>▲</span>
          <span>TECH<span className="brand-slash">/</span>AI</span>
          <span className="brand-sub">news</span>
        </a>
        <nav className="nav">
          <a href="#/" aria-current={route.page === 'home' ? 'page' : undefined}>Dashboard</a>
          <a href="#/feed" aria-current={route.page === 'feed' ? 'page' : undefined}>Feed</a>
        </nav>
        {news && (
          <div className="status" title={`${online} of ${news.sources.length} sources reachable on the last update`}>
            <span className="live-dot" data-degraded={online < news.sources.length || undefined} aria-hidden />
            <span className="status-label">LIVE</span>
            <span className="status-meta">synced {timeAgo(news.updatedAt, now.getTime())}</span>
          </div>
        )}
      </div>
    </header>
  )
}
