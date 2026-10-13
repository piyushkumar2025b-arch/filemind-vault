/**
 * FileMind Cloudflare Pages Function - AI News Explainer
 * POST /api/ai-news { topic } — fetches free news, summarizes with Workers AI.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';

export async function onRequestPost(context: { request: Request; env: any }) {
  const { request, env } = context;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }
  const topic = (body.topic ?? 'ai').toString().slice(0, 40);

  // Pull from our own free news endpoint (same origin)
  const origin = new URL(request.url).origin;
  let items: any[] = [];
  try {
    const r = await fetch(`${origin}/api/news?topic=${encodeURIComponent(topic)}&limit=8`);
    if (r.ok) items = (await r.json()).items ?? [];
  } catch {
    // offline / local dev — summarize without fresh items
  }

  if (!env.AI) {
    return Response.json(
      { summary: `[Local Echo]: ${items.length} stories on "${topic}". Connect Workers AI binding for summaries.`, items },
      { headers: corsHeaders }
    );
  }

  const digest = items
    .slice(0, 6)
    .map((i: any, n: number) => `${n + 1}. ${i.title} (${i.source})`)
    .join('\n');

  const ai = await env.AI.run(body.model || DEFAULT_MODEL, {
    messages: [
      {
        role: 'system',
        content: `You are FileMind News, a crisp tech-news anchor. Summarize today's "${topic}" headlines below in 4-6 punchy bullets with source names. No hallucinated stories beyond the list.`,
      },
      { role: 'user', content: digest || `No fresh stories fetched. Give a 3-bullet general briefing on ${topic}.` },
    ],
  });
  const text =
    typeof ai?.response === 'string' ? ai.response : JSON.stringify(ai).slice(0, 3000);

  return Response.json({ topic, summary: text, items }, { headers: corsHeaders });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
