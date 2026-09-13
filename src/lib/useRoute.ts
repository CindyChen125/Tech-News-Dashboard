import { useEffect, useState } from 'react'

// Hash routing: GitHub Pages serves one index.html, so /feed would 404 on reload but #/feed never does.

export type Route = { page: 'home' | 'feed'; params: URLSearchParams }

function parse(): Route {
  const [path, query = ''] = window.location.hash.replace(/^#/, '').split('?')
  return { page: path === '/feed' ? 'feed' : 'home', params: new URLSearchParams(query) }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const onChange = () => {
      setRoute(parse())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function feedHref(params: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString()
  return `#/feed${q ? `?${q}` : ''}`
}
