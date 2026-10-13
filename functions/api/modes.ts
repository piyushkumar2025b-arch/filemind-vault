/**
 * FileMind Cloudflare Pages Function - Chat Modes
 * POST /api/modes { mode: 'chat'|'internet'|'news', prompt, contextChunks? }
 * - chat: normal vault RAG (same as /api/chat)
 * - internet: live web results injected into the prompt before Workers AI
 * - news: free AI/tech headlines summarized
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';
const ALLOWED = new Set([
  '@cf/meta/llama-3.1-8b-instruct-fp8',
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/openai/gpt-oss-20b',
  '@cf/qwen/qwen3-30b-a3b-fp8',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  '@cf/zai-org/glm-4.7-flash',
  '@cf/moonshotai/kimi-k2.6',
]);

function extract(ai: any): string {
  if (!ai) return '';
  if (typeof ai === 'string') return ai;
  if (typeof ai.response === 'string') return ai.response;
  if (typeof ai.result?.response === 'string') return ai.result.response;
  return JSON.stringify(ai).slice(0, 4000);
}

export async function onRequestPost(context: { request: Request; env: any }) {
  const { request, env } = context;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }
  const mode = (body.mode ?? 'chat').toString();
  const prompt = (body.prompt ?? '').toString().trim().slice(0, 4000);
  if (!prompt) return Response.json({ error: 'Missing prompt' }, { status: 400, headers: corsHeaders });
  const model = ALLOWED.has(body.model) ? body.model : DEFAULT_MODEL;
  const origin = new URL(request.url).origin;
  const chunks = Array.isArray(body.contextChunks) ? body.contextChunks.slice(0, 12) : [];
  const vaultText = chunks.map((c: any) => `Source [${c.fileName}]: ${(c.text ?? '').slice(0, 2000)}`).join('\n\n').slice(0, 12000);

  // Gather mode-specific live context (free sources, no keys)
  let liveContext = '';
  let sources: any[] = [];
  try {
    if (mode === 'internet') {
      const r = await fetch(`${origin}/api/search?q=${encodeURIComponent(prompt)}`);
      if (r.ok) {
        const j = await r.json();
        sources = j.results ?? [];
        liveContext = sources.slice(0, 4).map((s: any) => `- ${s.title} (${s.source}): ${s.snippet} [${s.url}]`).join('\n');
      }
    } else if (mode === 'news') {
      const r = await fetch(`${origin}/api/news?topic=${encodeURIComponent(prompt.slice(0, 40))}&limit=6`);
      if (r.ok) {
        const j = await r.json();
        sources = j.items ?? [];
        liveContext = sources.map((s: any, i: number) => `${i + 1}. ${s.title} (${s.source})`).join('\n');
      }
    }
  } catch { /* live context optional — continue with vault only */ }

  const sysByMode: Record<string, string> = {
    chat: 'You are FileMind AI, a private vault assistant. Answer from the vault chunks; cite sources.',
    internet: 'You are FileMind Web, an assistant with live web results. Answer the question using the web results; cite URLs inline.',
    news: 'You are FileMind News, a crisp news anchor. Summarize the headlines in punchy bullets with sources.',
  };

  if (!env.AI) {
    return Response.json(
      { mode, response: `[Local Echo:${mode}]: vault=${chunks.length} live=${sources.length}`, sources },
      { headers: corsHeaders }
    );
  }

  const ai = await env.AI.run(model, {
    messages: [
      { role: 'system', content: `${sysByMode[mode] ?? sysByMode.chat}\n\nVAULT:\n${vaultText}\n\nLIVE:\n${liveContext}` },
      { role: 'user', content: prompt },
    ],
  });
  return Response.json({ mode, model, response: extract(ai), sources }, { headers: corsHeaders });
}

export async function onRequestGet() {
  return Response.json(
    {
      service: 'FileMind chat modes',
      usage: 'POST { mode: "chat"|"internet"|"news", prompt, model?, contextChunks? }',
      modes: ['chat', 'internet', 'news'],
    },
    { headers: corsHeaders }
  );
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
