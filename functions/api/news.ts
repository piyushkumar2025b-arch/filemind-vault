/**
 * FileMind Cloudflare Pages Function - News API (FREE sources, no keys)
 * Aggregates HackerNews + Dev.to + Lobsters + GitHub Trending + Reddit.
 * GET /api/news?topic=ai&limit=10
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=300',
};

interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  points?: number;
  comments?: number;
  publishedAt?: string;
}

async function fetchJSON(url: string, timeoutMs = 8000): Promise<any> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      headers: { 'User-Agent': 'FileMind/1.0' },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function topicMatches(topic: string, text: string): boolean {
  const map: Record<string, string[]> = {
    ai: ['ai', 'llm', 'gpt', 'agent', 'machine learning', 'neural', 'transformer', 'diffusion', 'rag', 'embedding', 'copilot', 'Muse', 'gemini'],
    tech: ['tech', 'software', 'cloud', 'startup', 'app', 'api', 'dev', 'code', 'programming'],
    security: ['security', 'vulnerability', 'cve', 'exploit', 'malware', 'ransomware', 'zero-day', 'phishing'],
    science: ['science', 'research', 'study', 'physics', 'space', 'nasa', 'quantum', 'biology'],
  };
  const keys = map[topic] ?? [topic];
  const lower = text.toLowerCase();
  return keys.some((k) => lower.includes(k));
}

export async function onRequestGet(context: { request: Request }) {
  const url = new URL(context.request.url);
  const topic = (url.searchParams.get('topic') || 'ai').toLowerCase().slice(0, 30);
  const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10) || 10));

  const items: NewsItem[] = [];

  // 1. HackerNews Algolia (free, no key)
  const hn = await fetchJSON(
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&hitsPerPage=15`
  );
  for (const h of hn?.hits ?? []) {
    if (!h.title) continue;
    items.push({
      id: `hn-${h.objectID}`,
      title: h.title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      source: 'Hacker News',
      points: h.points,
      comments: h.num_comments,
      publishedAt: h.created_at,
    });
  }

  // 2. Dev.to public API (free, no key)
  const dev = await fetchJSON(`https://dev.to/api/articles?tag=${encodeURIComponent(topic)}&per_page=10`);
  for (const d of dev ?? []) {
    items.push({
      id: `dev-${d.id}`,
      title: d.title,
      url: d.url,
      source: 'Dev.to',
      comments: d.comments_count,
      publishedAt: d.published_at,
    });
  }

  // 3. Lobsters (free, no key) — hot feed, filtered by topic
  const lob = await fetchJSON('https://lobste.rs/hottest.json');
  for (const l of lob ?? []) {
    const text = `${l.title} ${l.tags?.join(' ') ?? ''}`;
    if (!topicMatches(topic, text)) continue;
    items.push({
      id: `lob-${l.short_id}`,
      title: l.title,
      url: l.url.startsWith('http') ? l.url : `https://lobste.rs${l.url}`,
      source: 'Lobsters',
      points: l.score,
      comments: l.comment_count,
      publishedAt: l.created_at,
    });
  }

  // 4. GitHub Trending repos (free, no key) — public search API
  if (topic === 'tech' || topic === 'ai' || topic === 'security') {
    const gh = await fetchJSON(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(topic)}+pushed:>2024-01-01&sort=stars&order=desc&per_page=6`
    );
    for (const r of gh?.items ?? []) {
      items.push({
        id: `gh-${r.id}`,
        title: `${r.full_name} — ${r.description ?? ''}`.slice(0, 140),
        url: r.html_url,
        source: 'GitHub',
        points: r.stargazers_count,
        comments: r.open_issues_count,
        publishedAt: r.pushed_at,
      });
    }
  }

  // 5. Reddit public search (free, no key, .json endpoint)
  const reddit = await fetchJSON(
    `https://www.reddit.com/search.json?q=${encodeURIComponent(topic)}&sort=top&limit=8&t=month`
  );
  for (const c of reddit?.data?.children ?? []) {
    const d = c?.data;
    if (!d?.title) continue;
    items.push({
      id: `rd-${d.id}`,
      title: d.title.slice(0, 140),
      url: `https://www.reddit.com${d.permalink}`,
      source: 'Reddit',
      points: d.ups,
      comments: d.num_comments,
      publishedAt: new Date((d.created_utc ?? 0) * 1000).toISOString(),
    });
  }

  // Rank: topic-matched + engagement first
  const ranked = items
    .map((i) => ({
      item: i,
      score: (topicMatches(topic, i.title) ? 10 : 0) + Math.min(10, (i.points ?? 0) / 10) + Math.min(5, (i.comments ?? 0) / 5),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);

  return Response.json(
    { topic, count: ranked.length, items: ranked, cached: false },
    { headers: corsHeaders }
  );
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
