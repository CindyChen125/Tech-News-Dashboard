import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import Parser from 'rss-parser'
import type { Item, NewsFile, SourceStatus } from '../src/types.ts'
import { SOURCES, type Source } from './sources.ts'

const NEWS_PATH = 'public/data/news.json'
const ARCHIVE_DIR = 'data/archive'
const WINDOW_DAYS = 30
const TIMEOUT_MS = 20_000
const SUMMARY_MAX = 300
// Some publishers (e.g. The Verge) reject requests without a browser-like user agent.
const USER_AGENT = 'Mozilla/5.0 (compatible; tech-news-dashboard/0.1; personal feed reader)'

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|ref_src$|cmpid$)/

/** The link we store and open: the publisher's URL minus tracking params and fragment. */
export function cleanUrl(raw: string): string {
  const u = new URL(raw.trim())
  u.hash = ''
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key)
  }
  return u.toString()
}

/**
 * Stable id: hash of a looser form of the URL, so http/https, www/no-www and trailing-slash
 * variants of one article collide. Only used as a key — never as a link, since some sites
 * don't serve the stripped form.
 */
export function idFor(url: string): string {
  const u = new URL(url)
  const key = `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`
  return createHash('sha1').update(key).digest('hex').slice(0, 16)
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  '#8217': '’', '#8216': '‘', '#8220': '“', '#8221': '”', '#8211': '–', '#8212': '—', '#8230': '…', '#039': "'",
}

export function cleanText(html: string | undefined): string {
  if (!html) return ''
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e] ?? (e.startsWith('#') ? String.fromCodePoint(Number(e.slice(1))) : m))
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncate(text: string, max = SUMMARY_MAX): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:]+$/, '') + '…'
}

function toIso(date: string | number | undefined, now: Date): string {
  const d = date === undefined ? now : new Date(date)
  if (Number.isNaN(d.getTime()) || d > now) return now.toISOString()
  return d.toISOString()
}

// Titles only: summaries mention AI in passing too often ("…with Apple Intelligence") to be a reliable signal.
const AI_TITLE = /\b(ai|a\.i\.|artificial intelligence|agi|llms?|gpt[-\s]?\d[\w.]*|chatgpt|openai|anthropic|claude|gemini|deepmind|copilot|machine learning|deep learning|neural|chatbots?|agentic|ai agents?|llama|mistral|deepseek|qwen|grok|xai|perplexity|midjourney|sora|hugging ?face)\b/i

/**
 * An outlet's section is only a default: a Verge story about OpenAI belongs under AI.
 * Recomputed for every item on every run, so improving the rule reclassifies old items too.
 */
export function sectionFor(item: Item): Item['section'] {
  const source = SOURCES.find((s) => s.name === item.source)
  if (source?.section === 'ai') return 'ai'
  return AI_TITLE.test(item.title) ? 'ai' : 'tech'
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/atom+xml, application/xml, application/json, */*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}

const parser = new Parser()

async function fetchFeed(source: Source, now: Date): Promise<Item[]> {
  const feed = await parser.parseString(await (await get(source.url)).text())
  const items: Item[] = []
  for (const entry of feed.items) {
    const title = cleanText(entry.title)
    if (!entry.link || !title) continue
    const url = cleanUrl(entry.link)
    items.push({
      id: idFor(url),
      title,
      url,
      source: source.name,
      section: source.section,
      publishedAt: toIso(entry.isoDate ?? entry.pubDate, now),
      summary: truncate(cleanText(entry.contentSnippet || entry.summary || entry.content)),
    })
  }
  return items
}

type HnHit = { objectID: string; title: string | null; url: string | null; points: number | null; num_comments: number | null; created_at_i: number }

async function fetchHackerNews(source: Source, now: Date): Promise<Item[]> {
  const { hits } = (await (await get(source.url)).json()) as { hits: HnHit[] }
  return hits
    .filter((h) => h.title)
    .map((h) => {
      // Ask HN / Show HN text posts have no external URL; link to the discussion instead.
      const url = cleanUrl(h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`)
      return {
        id: idFor(url),
        title: h.title!,
        url,
        source: source.name,
        section: source.section,
        publishedAt: toIso(h.created_at_i * 1000, now),
        summary: `${h.points ?? 0} points · ${h.num_comments ?? 0} comments`,
      }
    })
}

function readExisting(): NewsFile | null {
  if (!existsSync(NEWS_PATH)) return null
  return JSON.parse(readFileSync(NEWS_PATH, 'utf8')) as NewsFile
}

/**
 * Moves items that have aged out of the window into data/archive/YYYY-MM.json and returns the rest.
 * Only items previously shown on the dashboard are archived; a feed's years-old backlog is just dropped.
 */
function archiveOld(items: Item[], previouslyShown: Set<string>, now: Date): Item[] {
  const cutoff = now.getTime() - WINDOW_DAYS * 86_400_000
  const keep: Item[] = []
  const byMonth = new Map<string, Item[]>()
  for (const item of items) {
    if (new Date(item.publishedAt).getTime() >= cutoff) {
      keep.push(item)
      continue
    }
    if (!previouslyShown.has(item.id)) continue
    const month = item.publishedAt.slice(0, 7)
    byMonth.set(month, [...(byMonth.get(month) ?? []), item])
  }
  for (const [month, monthItems] of byMonth) {
    const path = `${ARCHIVE_DIR}/${month}.json`
    const existing: Item[] = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : []
    const seen = new Set(existing.map((i) => i.id))
    const merged = [...existing, ...monthItems.filter((i) => !seen.has(i.id))]
    if (merged.length !== existing.length) {
      merged.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      writeFileSync(path, JSON.stringify(merged, null, 1) + '\n')
    }
  }
  return keep
}

async function main() {
  const now = new Date()
  const previous = readExisting()

  const results = await Promise.allSettled(
    SOURCES.map((s) => (s.kind === 'hn' ? fetchHackerNews(s, now) : fetchFeed(s, now))),
  )

  const statuses: SourceStatus[] = []
  const fresh: Item[] = []
  results.forEach((r, i) => {
    const s = SOURCES[i]
    if (r.status === 'fulfilled') {
      statuses.push({ name: s.name, section: s.section, ok: true, count: r.value.length })
      fresh.push(...r.value)
    } else {
      const error = r.reason instanceof Error ? r.reason.message : String(r.reason)
      statuses.push({ name: s.name, section: s.section, ok: false, count: 0, error })
    }
  })

  // Existing items win on id collisions: an item keeps the source and date it was first seen with.
  const byId = new Map<string, Item>()
  for (const item of [...(previous?.items ?? []), ...fresh]) {
    if (!byId.has(item.id)) byId.set(item.id, item)
  }
  for (const item of byId.values()) item.section = sectionFor(item)
  const previouslyShown = new Set(previous?.items.map((i) => i.id))
  const items = archiveOld([...byId.values()], previouslyShown, now).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  for (const s of statuses) {
    console.log(`${s.ok ? 'ok  ' : 'FAIL'} ${s.name.padEnd(16)} ${s.ok ? `${s.count} items` : s.error}`)
  }
  const failed = statuses.filter((s) => !s.ok).length
  console.log(`${items.length} items in window, ${failed}/${statuses.length} sources failed`)

  // Only rewrite when something a reader would see changed, so the scheduled job doesn't commit every run.
  const itemsChanged = JSON.stringify(items) !== JSON.stringify(previous?.items)
  const statusChanged =
    JSON.stringify(statuses.map((s) => [s.name, s.ok])) !== JSON.stringify(previous?.sources.map((s) => [s.name, s.ok]))
  if (itemsChanged || statusChanged) {
    const out: NewsFile = { updatedAt: itemsChanged ? now.toISOString() : previous!.updatedAt, sources: statuses, items }
    writeFileSync(NEWS_PATH, JSON.stringify(out, null, 1) + '\n')
    console.log(`wrote ${NEWS_PATH}`)
  } else {
    console.log('no changes')
  }

  if (failed === statuses.length) {
    console.error('every source failed — likely a network problem, not the feeds')
    process.exit(1)
  }
}

await main()
