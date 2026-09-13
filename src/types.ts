// Shared between the fetch script (Node) and the frontend (browser).

export type Section = 'ai' | 'tech'

export type Item = {
  /** Hash of a normalized URL — stable across runs, so it doubles as the dedupe key. */
  id: string
  title: string
  /** The publisher's link, minus tracking params and fragment. */
  url: string
  source: string
  section: Section
  /** ISO 8601. Clamped to fetch time when a feed claims a future date. */
  publishedAt: string
  /** Publisher's own description, HTML stripped, at most ~300 chars. May be empty. */
  summary: string
}

export type SourceStatus = {
  name: string
  section: Section
  ok: boolean
  /** Items returned by this run (before the 30-day window is applied). */
  count: number
  error?: string
}

export type NewsFile = {
  /** When the item list last changed. */
  updatedAt: string
  sources: SourceStatus[]
  items: Item[]
}
