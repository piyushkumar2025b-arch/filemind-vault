/**
 * FileMind Cloudflare Pages Function - Internet Search (FREE, no keys)
 * GET /api/search?q=... — DuckDuckGo Instant Answer + Wikipedia fallback.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=600',
};

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

export async function onRequestGet(context: { request: Request }) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 200);
  if (!q) {
    return Response.json({ error: 'Missing ?q=' }, { status: 400, headers: corsHeaders });
  }

  // 1. DuckDuckGo Instant Answer (free, no key)
  const ddg = await fetchJSON(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`);

  const results: Array<{ title: string; url: string; snippet: string; source: string }> = [];

  if (ddg?.AbstractText) {
    results.push({
      title: ddg.Heading || q,
      url: ddg.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
      snippet: ddg.AbstractText.slice(0, 500),
      source: ddg.AbstractSource || 'DuckDuckGo',
    });
  }
  for (const t of ddg?.RelatedTopics ?? []) {
    if (results.length >= 5) break;
    if (t.Text && t.FirstURL) {
      results.push({
        title: t.Text.split(' - ')[0].slice(0, 120),
        url: t.FirstURL,
        snippet: t.Text.slice(0, 300),
        source: 'DuckDuckGo',
      });
    }
  }

  // 2. Wikipedia search fallback (free, no key)
  if (results.length < 3) {
    const wiki = await fetchJSON(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=5&origin=*`
    );
    for (const s of wiki?.query?.search ?? []) {
      if (results.length >= 6) break;
      results.push({
        title: s.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, '_'))}`,
        snippet: (s.snippet || '').replace(/<[^>]+>/g, '').slice(0, 300),
        source: 'Wikipedia',
      });
    }
  }

  // 3. Always include a direct-search link
  results.push({
    title: `Web search: ${q}`,
    url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    snippet: 'Open full web results in DuckDuckGo.',
    source: 'DuckDuckGo',
  });

  return Response.json({ query: q, count: results.length, results }, { headers: corsHeaders });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
