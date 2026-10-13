/**
 * FileMind Cloudflare Pages Function - Translation (FREE, no keys)
 * POST /api/translate { text, target }
 * Tries the public LibreTranslate mirror first; if it is unreachable it
 * falls back to Workers AI so translation always works.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const LIBRE_ENDPOINT = 'https://libretranslate.com/translate';

export async function onRequestPost(context: { request: Request; env: any }) {
  const { request, env } = context;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }
  const text = (body.text ?? '').toString().trim().slice(0, 2000);
  const target = (body.target ?? 'es').toString().slice(0, 5);
  if (!text) return Response.json({ error: 'Missing text' }, { status: 400, headers: corsHeaders });

  // 1. LibreTranslate (free public instance, no key)
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 8000);
    const r = await fetch(LIBRE_ENDPOINT, {
      method: 'POST',
      signal: c.signal,
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'FileMind/1.0' },
      body: JSON.stringify({ q: text, source: 'auto', target, format: 'text' }),
    });
    clearTimeout(t);
    if (r.ok) {
      const j = (await r.json()) as any;
      if (typeof j.translatedText === 'string' && j.translatedText.trim()) {
        return Response.json({ translated: j.translatedText, target, engine: 'libretranslate' }, { headers: corsHeaders });
      }
    }
  } catch {
    // fall through to AI fallback
  }

  // 2. Workers AI fallback (if binding present)
  if (env.AI) {
    try {
      const ai = await env.AI.run('@cf/meta/m2m100-1.2b', {
        text,
        source_lang: 'en',
        target_lang: target,
      });
      const out = ai?.translated_text ?? ai?.translatedText ?? ai?.response;
      if (typeof out === 'string' && out.trim()) {
        return Response.json({ translated: out, target, engine: 'workers-ai' }, { headers: corsHeaders });
      }
    } catch {
      // fall through
    }
  }

  return Response.json(
    { error: 'Translation services unavailable right now. Please try again shortly.' },
    { status: 502, headers: corsHeaders }
  );
}

export async function onRequestGet() {
  return Response.json(
    { usage: 'POST { text, target } → { translated }', languages: ['es','fr','de','hi','ar','zh','ja','ru','pt','en'] },
    { headers: corsHeaders }
  );
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
