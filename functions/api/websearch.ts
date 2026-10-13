/**
 * FileMind Pages Function - Live Web Search (FREE, no API keys)
 * GET /api/websearch?q=... → { query, count, results:[{title,url,snippet,source}] }
 * Sources: DuckDuckGo HTML (full web) + Hacker News Algolia + Wikipedia.
 * Used for real-time internet access inside chat (web + Telegram bot).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=300',
};

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FileMind/1.0; +https://filemind.app)',
        Accept: 'text/html,application/json',
      },
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchJSON(url: string, timeoutMs = 8000): Promise<any> {
  const txt = await fetchText(url, timeoutMs);
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract the real destination from a DuckDuckGo redirect link. */
function resolveDdgUrl(href: string): string {
  try {
    const u = new URL(href, 'https://duckduckgo.com');
    const uddg = u.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    if (u.hostname.endsWith('duckduckgo.com')) return u.pathname.replace(/^\/l\//, '');
    return u.toString();
  } catch {
    return href;
  }
}

/** Parse DuckDuckGo's HTML results page (no key, full web coverage). */
function parseDdgHtml(html: string): WebResult[] {
  const out: WebResult[] = [];
  const anchors =
    html.match(/<a[^>]*class="result__a"[^>]*>[\s\S]*?<\/a>/g) ??
    html.match(/<a[^>]*rel="nofollow"[^>]*href="[^"]*"[^>]*>[\s\S]*?<\/a>/g) ??
    [];
  const snippets = html.match(/<a[^>]*class="result__snippet"[^>]*>[\s\S]*?<\/a>/g) ?? [];

  for (let i = 0; i < anchors.length && out.length < 8; i++) {
    const a = anchors[i];
    const hrefMatch = a.match(/href="([^"]+)"/);
    if (!hrefMatch) continue;
    const url = resolveDdgUrl(hrefMatch[1]);
    if (!url.startsWith('http') || url.includes('duckduckgo.com')) continue;
    const title = stripTags(a.replace(/<[^>]+>/g, ''));
    if (!title) continue;
    const snipHtml = snippets[i] ?? '';
    out.push({
      title: title.slice(0, 200),
      url,
      snippet: stripTags(snipHtml).slice(0, 300),
      source: 'Web',
    });
  }
  return out;
}

export async function onRequestGet(context: { request: Request }) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 300);
  if (!q) return Response.json({ error: 'Missing ?q=' }, { status: 400, headers: corsHeaders });

  const results: WebResult[] = [];

  // 1. DuckDuckGo HTML — full internet web results
  const ddg = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`);
  if (ddg) results.push(...parseDdgHtml(ddg));

  // 2. Hacker News Algolia — realtime tech discussion
  const hn = await fetchJSON(
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&hitsPerPage=5`
  );
  for (const h of hn?.hits ?? []) {
    if (!h.title) continue;
    results.push({
      title: h.title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      snippet: `${h.points ?? 0} points · ${h.num_comments ?? 0} comments on Hacker News${h.created_at ? ' · ' + String(h.created_at).slice(0, 10) : ''}`,
      source: 'Hacker News',
    });
  }

  // 3. Wikipedia — fast, reliable encyclopedia fallback
  const wiki = await fetchJSON(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=4&origin=*`
  );
  for (const s of wiki?.query?.search ?? []) {
    results.push({
      title: s.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(s.title).replace(/ /g, '_'))}`,
      snippet: stripTags(s.snippet || '').slice(0, 300),
      source: 'Wikipedia',
    });
  }

  // 4. Always offer a direct search link as the last resort
  results.push({
    title: `Search the web for: ${q}`,
    url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    snippet: 'Open full live web results in DuckDuckGo.',
    source: 'DuckDuckGo',
  });

  return Response.json({ query: q, count: results.length, results: results.slice(0, 10), fetchedAt: Date.now() }, { headers: corsHeaders });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
