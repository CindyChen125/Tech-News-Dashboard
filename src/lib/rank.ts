import type { Item } from '../types.ts'

// No LLM: "top" means covered by several independent outlets, recent, and ideally
// straight from the company involved. Everything here is plain token overlap.

const STOPWORDS = new Set(
  `a an and are as at be but by can could did do does for from has have how i if in into is it its
  just more most new not now of on or our out over says so than that the their them then there these
  they this to up us was we what when where which who why will with you your after about all also
  been being get gets got here heres make makes may might much no off one only other own same should
  some still such too very way ways week year years first next last back like want wants use using
  used vs via today report reportedly according announces announced launch launches review hands ready`.split(/\s+/),
)

/** Too common in tech headlines to say two articles are about the same thing. */
const GENERIC = new Set(['ai', 'tech', 'data', 'time', 'ceo', 'company', 'app', 'apps', 'best', 'deal', 'deals'])

/** Publishers' own announcements outrank coverage of them. */
const OFFICIAL_SOURCES = new Set(['Apple Newsroom', 'OpenAI', 'Google DeepMind', 'Google AI'])

export function tokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[’']s\b/g, '')
      .split(/[^a-z0-9.+-]+/)
      .map((t) => t.replace(/^[.+-]+|[.+-]+$/g, ''))
      .filter((t) => t.length >= 2 && !STOPWORDS.has(t)),
  )
}

/** Two titles are about the same story if they share 2+ specific words making up 40%+ of the shorter title. */
function sameStory(a: Set<string>, b: Set<string>): number {
  let shared = 0
  for (const t of a) if (b.has(t) && !GENERIC.has(t)) shared++
  const ratio = shared / Math.min(a.size, b.size)
  return shared >= 2 && ratio >= 0.4 ? shared : 0
}

export type Story = {
  /** The item shown as the headline: official source first, then the earliest report. */
  lead: Item
  items: Item[]
  sources: string[]
  score: number
}

function hoursAgo(iso: string, now: number) {
  return (now - new Date(iso).getTime()) / 3_600_000
}

/** The item sharing the most words with the rest of its cluster — the best one-line summary of it. */
function mostCentral(items: Item[]): Item {
  const toks = items.map((i) => tokens(i.title))
  let best = 0
  let bestScore = -1
  toks.forEach((t, i) => {
    let score = 0
    toks.forEach((o, j) => {
      if (i !== j) for (const w of t) if (o.has(w) && !GENERIC.has(w)) score++
    })
    if (score > bestScore) [best, bestScore] = [i, score]
  })
  return items[best]
}

/** Groups items about the same story and ranks the groups. */
export function topStories(all: Item[], now: number, { windowHours = 48, limit = 5 } = {}): Story[] {
  let candidates = all.filter((i) => hoursAgo(i.publishedAt, now) <= windowHours)
  // Quiet weekends: widen the window rather than show an empty dashboard.
  if (candidates.length < limit * 4) candidates = all.filter((i) => hoursAgo(i.publishedAt, now) <= windowHours * 3)

  // Each item joins the cluster containing its closest match ("iPhone 18 Pro" matches, "Apple" alone doesn't).
  const clusters: { items: Item[]; tokens: Set<string>[] }[] = []
  for (const item of candidates) {
    const t = tokens(item.title)
    let best: (typeof clusters)[number] | undefined
    let bestShared = 0
    for (const c of clusters) {
      const shared = Math.max(...c.tokens.map((m) => sameStory(m, t)))
      if (shared > bestShared) [best, bestShared] = [c, shared]
    }
    if (best) {
      best.items.push(item)
      best.tokens.push(t)
    } else {
      clusters.push({ items: [item], tokens: [t] })
    }
  }

  const stories = clusters.map(({ items }) => {
    const sources = [...new Set(items.map((i) => i.source))]
    const official = items.find((i) => OFFICIAL_SOURCES.has(i.source))
    const lead = official ?? mostCentral(items)
    const newest = Math.min(...items.map((i) => hoursAgo(i.publishedAt, now)))
    const recency = Math.max(0, 1 - newest / (windowHours * 3))
    const score = sources.length * 2 + (official ? 1 : 0) + recency * 2
    return { lead, items, sources, score }
  })

  return stories.sort((a, b) => b.score - a.score).slice(0, limit)
}

/** Words showing up across several different sources recently. */
export function trendingTerms(all: Item[], now: number, { windowHours = 48, minSources = 3, limit = 12 } = {}) {
  const sourcesByTerm = new Map<string, Set<string>>()
  for (const item of all) {
    if (hoursAgo(item.publishedAt, now) > windowHours) continue
    for (const t of tokens(item.title)) {
      if (/^\d+$/.test(t) || GENERIC.has(t)) continue
      if (!sourcesByTerm.has(t)) sourcesByTerm.set(t, new Set())
      sourcesByTerm.get(t)!.add(item.source)
    }
  }
  return [...sourcesByTerm]
    .map(([term, sources]) => ({ term, sources: sources.size }))
    .filter((t) => t.sources >= minSources)
    .sort((a, b) => b.sources - a.sources || a.term.localeCompare(b.term))
    .slice(0, limit)
}
