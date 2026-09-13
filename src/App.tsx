import { Header } from './components/Header.tsx'
import { Feed } from './pages/Feed.tsx'
import { Home } from './pages/Home.tsx'
import { useNews } from './lib/useNews.ts'
import { useRoute } from './lib/useRoute.ts'
import { useNow } from './lib/time.ts'

export default function App() {
  const route = useRoute()
  const now = useNow()
  const { news, error } = useNews()

  return (
    <>
      <div className="backdrop" aria-hidden />
      <Header route={route} news={news} now={now} />
      {error ? (
        <main className="page"><p className="notice">Couldn't load news: {error}</p></main>
      ) : !news ? (
        <main className="page"><p className="loading">loading feeds<span className="cursor">_</span></p></main>
      ) : route.page === 'feed' ? (
        // Keyed on the query string so following a link (e.g. a trending term) resets the filters.
        <Feed key={route.params.toString()} news={news} now={now} params={route.params} />
      ) : (
        <Home news={news} now={now} />
      )}
      <footer className="footer">
        Refreshed every 30 min by GitHub Actions · RSS &amp; Atom feeds · ranked without AI
      </footer>
    </>
  )
}
