import { useEffect, useState } from 'react'
import type { NewsFile } from '../types.ts'

export function useNews() {
  const [news, setNews] = useState<NewsFile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/news.json`, { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<NewsFile>
      })
      .then(setNews)
      .catch((err: Error) => setError(err.message))
  }, [])

  return { news, error }
}
