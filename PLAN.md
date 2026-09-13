# Tech & AI News Dashboard — Plan

A personal dashboard that pulls the newest AI and tech news (lab announcements,
research, product launches like new iPhones, community discussion) into one page.
Personal first; may become a public site later.

## Constraints

- **$0/month.** Free tiers only.
- **No LLM API.** Summaries, tags, and dedup are done with feed data and plain algorithms.
- **Delivery:** open the site whenever, plus a daily/weekly digest.
- **Not real-time.** Every source is polled; expect updates 15–45 min behind the source.

## Architecture

```
GitHub Actions (cron, every 30 min)
  → fetch all sources in parallel (each isolated; failures logged, not fatal)
  → normalize → filter noise → dedupe/cluster → tag → rank
  → write public/data/news.json, public/data/feed.xml
  → commit if changed → GitHub Pages redeploys

Frontend: Vite + React + TypeScript, fully static, reads news.json
```

Why build-time fetching: browsers can't fetch RSS directly (CORS), and this avoids
running any server. Cost: free — GitHub Pages on a free account requires a **public**
repo, and public repos get unlimited Actions minutes on standard runners. The job only
rebuilds the site when the news actually changed.

Known quirks: scheduled workflows can run 5–15 min late, and GitHub pauses them
on repos with no commits for 60 days (the bot's own commits keep it alive).

## Sources

Two top-level **sections**, so general tech doesn't drown out AI:

| Section | Category | Sources |
|---|---|---|
| AI | Labs | OpenAI, Anthropic, Google DeepMind, Meta AI, Mistral, Hugging Face, Qwen, DeepSeek |
| AI | Research | arXiv cs.AI / cs.CL / cs.LG (top items only — thousands/week otherwise) |
| AI | Releases | GitHub `releases.atom` for key repos (e.g. llama.cpp, vLLM, transformers) |
| AI | Community | Hacker News (Algolia API, AI keywords), r/LocalLLaMA, r/MachineLearning |
| Tech | Company newsrooms | Apple Newsroom, Google Blog, Microsoft, Samsung, NVIDIA |
| Tech | Outlets | The Verge, Ars Technica, TechCrunch, Engadget, Wired |
| Tech | Apple / mobile | 9to5Mac, MacRumors, 9to5Google, Android Authority |
| Tech | Community | Hacker News front page |

**Every feed URL must be verified during P1 before it goes in `sources.ts`** — don't
trust remembered URLs; several of these sites have moved or dropped feeds before.

Out of scope: X/Twitter (paid API), LinkedIn/Discord/TikTok (closed). Big stories
still arrive via HN/Reddit/outlets shortly after.

## Data model

```ts
type Item = {
  id: string;            // hash of canonical URL — stable across runs
  title: string;
  url: string;           // canonical: no utm_*, no AMP, no trailing slash
  source: string;        // "The Verge"
  section: "ai" | "tech";
  publishedAt: string;   // ISO 8601
  summary: string;       // from feed description, HTML stripped, ≤300 chars
  tags: string[];        // from keyword rules
  score: number;         // ranking
  clusterId?: string;    // items about the same story share this
};
```

## Processing (no LLM)

1. **Summary** — publisher's RSS `description`/`content:encoded`, HTML stripped, truncated.
2. **Noise filter** — general outlets post deals, gift guides, and "best X" lists.
   Drop by title rules (`deal`, `% off`, `best .* for`, `sponsored`), kept in one editable file.
3. **Dedupe/cluster** — exact match on canonical URL, then title token Jaccard
   similarity ≥ ~0.6 within a 48h window. One card per story, with source chips.
4. **Tags** — keyword → tag map (`iphone|ipad|macos → Apple`, `gpt|o3 → OpenAI`,
   `benchmark|eval → Evals`). Also decides section for mixed outlets: an AI-keyword
   hit in a Verge article files it under AI.
5. **Rank** — source weight × recency decay + cluster size + HN points when present.

## Storage

- `news.json` holds a rolling 30 days (keeps the page load small).
- Older items roll into `archive/YYYY-MM.json`.
- IDs are stable, so switching to a real database later is a migration, not a rewrite.

## Digest

1. **`feed.xml`** — the dashboard's own combined RSS. Subscribe in any reader app to
   get phone notifications. Free, no credentials. *Primary option.*
2. **`/weekly` page** — top-ranked clusters per section, grouped by week.
3. **Email** (optional, later) — GitHub Action + Gmail SMTP app password as a repo secret.

## Phases

**P1 — Skeleton.** ✅ Built 2026-09-13: 13 verified sources, fetch script, workflow,
dashboard with section + source filters. Remaining: push to GitHub and enable Pages.
Findings: Anthropic has no feed (needs a scraper, P4); feed dates can be in the future
(clamped to fetch time); Hugging Face and some others are only reachable locally
through the Mac's proxy, so `npm run fetch` sets `NODE_USE_ENV_PROXY=1`.
Original scope: Scaffold, `Item` type, verify and add ~10 feeds (5 AI, 5 tech),
fetch script, Action, deployed reverse-chronological list with section + source
filters. Done when it updates on its own with no manual steps.

**P2 — Readable.** Noise filter, dedupe/clustering, tag rules, read/unread in
`localStorage`, keyboard nav (`j`/`k`, `o` to open).

**P3 — Digest.** `feed.xml` and the `/weekly` page.

**P4 — Breadth.** Remaining sources; scrapers for feedless pages as isolated plugins
allowed to fail.

**Later, if public.** Design pass, shareable story links, a database for search
over history, optional local summaries (e.g. Ollama) if ever wanted.

## Rules

- Each source is a plugin returning `Item[]`. One broken source never breaks a run.
- Log per-source item counts each run so silently-dead feeds are noticeable.
- Link out to the original article; store only title + short summary, never full text.
