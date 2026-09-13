import type { Section } from '../src/types.ts'

export type Source = {
  name: string
  section: Section
  kind: 'feed' | 'hn'
  url: string
}

// Every URL here was fetched and confirmed live (HTTP 200, recent items) on 2026-09-13.
// Before adding a source, fetch it first — don't add URLs from memory.
// Not included, on purpose: Anthropic (no feed, 404), arXiv (hundreds of items a day; needs filtering first).
export const SOURCES: Source[] = [
  // AI
  { name: 'OpenAI', section: 'ai', kind: 'feed', url: 'https://openai.com/news/rss.xml' },
  { name: 'Google DeepMind', section: 'ai', kind: 'feed', url: 'https://deepmind.google/blog/rss.xml' },
  { name: 'Google AI', section: 'ai', kind: 'feed', url: 'https://blog.google/technology/ai/rss/' },
  { name: 'Hugging Face', section: 'ai', kind: 'feed', url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'MIT Tech Review', section: 'ai', kind: 'feed', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },

  // Tech
  { name: 'Apple Newsroom', section: 'tech', kind: 'feed', url: 'https://www.apple.com/newsroom/rss-feed.rss' },
  { name: 'The Verge', section: 'tech', kind: 'feed', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Ars Technica', section: 'tech', kind: 'feed', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { name: 'TechCrunch', section: 'tech', kind: 'feed', url: 'https://techcrunch.com/feed/' },
  { name: 'Engadget', section: 'tech', kind: 'feed', url: 'https://www.engadget.com/rss.xml' },
  { name: '9to5Mac', section: 'tech', kind: 'feed', url: 'https://9to5mac.com/feed/' },
  { name: 'MacRumors', section: 'tech', kind: 'feed', url: 'https://feeds.macrumors.com/MacRumors-All' },
  { name: 'Hacker News', section: 'tech', kind: 'hn', url: 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=50' },
]
