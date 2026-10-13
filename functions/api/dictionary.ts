/**
 * FileMind Cloudflare Pages Function - Dictionary (FREE, no keys)
 * GET /api/dictionary?word=serendipity
 * Uses the Free Dictionary API (dictionaryapi.dev).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=86400',
};

export async function onRequestGet(context: { request: Request }) {
  const url = new URL(context.request.url);
  const word = (url.searchParams.get('word') || '').trim().toLowerCase().slice(0, 40);
  if (!word) return Response.json({ error: 'Missing ?word=' }, { status: 400, headers: corsHeaders });

  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 8000);
    const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: c.signal,
      headers: { 'User-Agent': 'FileMind/1.0' },
    });
    clearTimeout(t);

    if (!r.ok) {
      return Response.json({ error: `No definition found for "${word}".` }, { status: 404, headers: corsHeaders });
    }

    const data = (await r.json()) as any[];
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) return Response.json({ error: `No definition found for "${word}".` }, { status: 404, headers: corsHeaders });

    const phonetic =
      first.phonetic ||
      (first.phonetics || []).find((p: any) => p.text)?.text ||
      '';

    const definitions: { partOfSpeech: string; definition: string; example?: string }[] = [];
    for (const meaning of first.meanings || []) {
      for (const def of (meaning.definitions || []).slice(0, 3)) {
        definitions.push({
          partOfSpeech: meaning.partOfSpeech || '',
          definition: def.definition || '',
          example: def.example,
        });
      }
    }

    return Response.json(
      {
        word: first.word || word,
        phonetic,
        definitions: definitions.slice(0, 6),
      },
      { headers: corsHeaders }
    );
  } catch {
    return Response.json({ error: 'Dictionary lookup failed (offline?).' }, { status: 502, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
