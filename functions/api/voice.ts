/**
 * FileMind Pages Function - Voice / Read-aloud (TTS, no new deps)
 * POST /api/voice { text, voice? } → { audio (base64 mp3/wav) }
 * Uses Workers AI TTS models live in your catalog.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const TTS_MODEL = '@cf/myshell-ai/melotts'; // multilingual TTS in your catalog

export async function onRequestPost(context: { request: Request; env: any }) {
  const { request, env } = context;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }
  const text = (body.text ?? '').toString().trim().slice(0, 2000);
  if (!text) return Response.json({ error: 'Missing text (max 2000 chars)' }, { status: 400, headers: corsHeaders });
  if (!env.AI) return Response.json({ error: 'Workers AI binding missing' }, { status: 500, headers: corsHeaders });

  try {
    const ai: any = await env.AI.run(TTS_MODEL, {
      prompt: text,
      lang: body.lang ?? 'en',
    });
    // Workers AI TTS returns { audio: base64 } in most models
    if (ai?.audio) return Response.json({ audio: ai.audio, model: TTS_MODEL }, { headers: corsHeaders });
    if (ai?.response && typeof ai.response === 'string' && ai.response.length > 100) {
      return Response.json({ audio: ai.response, model: TTS_MODEL }, { headers: corsHeaders });
    }
    return Response.json({ error: 'TTS returned no audio', raw: JSON.stringify(ai).slice(0, 300) }, { status: 500, headers: corsHeaders });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? 'TTS failed' }, { status: 500, headers: corsHeaders });
  }
}

export async function onRequestGet() {
  return Response.json(
    { model: TTS_MODEL, usage: 'POST { text (≤2000 chars), lang? } → { audio: base64 }' },
    { headers: corsHeaders }
  );
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
