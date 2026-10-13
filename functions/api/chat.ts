/**
 * FileMind Cloudflare Pages Function - Chat API
 * Handles Workers AI document RAG queries
 */

interface Env {
  AI?: any;
  DB?: any;
}

interface ChatRequest {
  prompt: string;
  model?: string;
  webSearch?: boolean; // real-time internet access via /api/websearch
  contextChunks?: Array<{
    id: string;
    fileId: string;
    fileName: string;
    text: string;
    line?: number;
    page?: number;
  }>;
}

const ALLOWED_MODELS = new Set([
  '@cf/meta/llama-3.1-8b-instruct-fp8',
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/openai/gpt-oss-20b',
  '@cf/qwen/qwen3-30b-a3b-fp8',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  '@cf/zai-org/glm-4.7-flash',
  '@cf/moonshotai/kimi-k2.6',
]);

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';
const MAX_CONTEXT_CHARS = 12000;
const MAX_PROMPT_CHARS = 4000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function extractText(aiResponse: any): string {
  if (!aiResponse) return '';
  if (typeof aiResponse === 'string') return aiResponse;
  if (typeof aiResponse.response === 'string') return aiResponse.response;
  if (typeof aiResponse.result?.response === 'string') return aiResponse.result.response;
  if (typeof aiResponse.output_text === 'string') return aiResponse.output_text;
  if (Array.isArray(aiResponse.choices) && aiResponse.choices[0]?.message?.content) {
    const c = aiResponse.choices[0].message.content;
    return typeof c === 'string' ? c : JSON.stringify(c);
  }
  if (typeof aiResponse.text === 'string') return aiResponse.text;
  return JSON.stringify(aiResponse).slice(0, 4000);
}

// --- Server-side AI guardrails (mirror of src/services/guardrails.ts) ---
// The edge enforces hard rules even if a client bypasses local checks.
const BLOCK_PATTERNS: RegExp[] = [
  /\bhow\s+to\s+(make|build|assemble|create)\b[^.?]{0,40}\b(bomb|explosive|detonator|nerve\s*agent|ricin|malware|keylogger|ransomware)\b/i,
  /\bhow\s+to\s+(kill|hang)\s+myself\b|\bbest\s+way\s+to\s+(commit\s+suicide|end\s+my\s+life)\b/i,
  /\b(child|kid|minor|underage)\b[^.?]{0,30}\b(nude|naked|porn|sexual)\b/i,
  /\bignore\s+(all\s+|any\s+|the\s+|your\s+|previous\s+|above\s+)*(instructions?|rules?|prompts?|guardrails?)\b/i,
  /\byou\s+are\s+now\s+(dan|jailbroken|evil|unfiltered|uncensored)\b/i,
  /\bforget\s+(everything|all|your\s+(rules|instructions|training))\b/i,
  /\b(reveal|print|show|leak|repeat)\s+(me\s+)?(your\s+)?(system\s*prompt|initial\s+instructions|hidden\s*rules)\b/i,
];

function isBlocked(prompt: string): boolean {
  return BLOCK_PATTERNS.some((p) => p.test(prompt));
}

// Strip injection-style lines out of retrieved document context so an
// uploaded file cannot hijack the assistant's instructions.
function sanitizeContext(text: string): string {
  return (text || '')
    .split('\n')
    .filter(
      (l) =>
        !/^\s*(ignore\s+(all|any|the|your|previous|above)?\s*(instructions?|rules?|prompts?)|you\s+are\s+now\s+(dan|jailbroken|evil)|<\s*system\s*>)/i.test(l)
    )
    .join('\n');
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
  }

  const prompt = (body.prompt ?? '').toString().trim().slice(0, MAX_PROMPT_CHARS);
  if (!prompt) {
    return Response.json({ error: 'Missing required field: prompt' }, { status: 400, headers: corsHeaders });
  }

  // --- AI guardrail gate: refuse disallowed / unsafe requests at the edge ---
  if (isBlocked(prompt)) {
    return Response.json(
      {
        response:
          '🛡️ This request was blocked by AI Safety Guardrails. FileMind refuses to help with harmful, unsafe, or unauthorized content. I can help with safe alternatives such as understanding security defensively, or summarizing and analyzing your vault documents.',
        blocked: true,
        model: DEFAULT_MODEL,
      },
      { headers: corsHeaders }
    );
  }

  const requestedModel = (body.model ?? DEFAULT_MODEL).toString();
  const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;
  const contextChunks = Array.isArray(body.contextChunks) ? body.contextChunks.slice(0, 12) : [];

  let contextText = contextChunks
    .map((c) => `Source [${c.fileName ?? 'unknown'}]: ${(c.text ?? '').toString().slice(0, 2000)}`)
    .join('\n\n');
  if (contextText.length > MAX_CONTEXT_CHARS) {
    contextText = contextText.slice(0, MAX_CONTEXT_CHARS) + '\n…(truncated)';
  }
  // Neutralize any injection-style lines hidden in uploaded documents.
  contextText = sanitizeContext(contextText);

  // --- Real-time internet access: live web results injected into the prompt ---
  let webResults: Array<{ title: string; url: string; snippet: string; source?: string }> = [];
  if (body.webSearch) {
    try {
      const origin = new URL(request.url).origin;
      const wc = new AbortController();
      const wt = setTimeout(() => wc.abort(), 12000);
      const wr = await fetch(`${origin}/api/websearch?q=${encodeURIComponent(prompt.slice(0, 200))}`, {
        signal: wc.signal,
      });
      clearTimeout(wt);
      if (wr.ok) {
        const wj = await wr.json();
        webResults = Array.isArray(wj.results) ? wj.results.slice(0, 8) : [];
      }
    } catch (err: any) {
      console.warn('websearch failed:', err?.message);
    }
  }
  const webText = webResults
    .map((w, i) => `[${i + 1}] ${w.title}\n    URL: ${w.url}\n    ${(w.snippet || '').slice(0, 220)}`)
    .join('\n');

  const systemMessage = [
    'You are FileMind AI, a private personal knowledge assistant with real-time internet access.',
    'Answer accurately using the provided personal file chunks AND, when present, the live web results below.',
    'When you use web information, cite sources inline using their [n] number and mention the URL.',
    'Code requirements: ALWAYS wrap code in fenced blocks with the language tag, e.g. ```python ... ```',
    'Be concise, well-structured and helpful. Use short paragraphs and bullet points.',
    contextText ? `\n--- PERSONAL FILE CONTEXT ---\n${contextText}` : '',
    webText
      ? `\n--- LIVE WEB RESULTS (fetched moments ago — real-time) ---\n${webText}\nUse these for anything time-sensitive (prices, news, versions, dates, scores). If web results are irrelevant, rely on your own knowledge.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    if (env.AI) {
      const aiResponse = await env.AI.run(model, {
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt },
        ],
      });
      const text = extractText(aiResponse);
      return Response.json({ response: text, model, webResults }, { headers: corsHeaders });
    }
    return Response.json(
      {
        response: `[Local Edge Echo]: Retrieved ${contextChunks.length} chunks. Ready to connect to Cloudflare Workers AI binding.`,
        model,
        fallback: true,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? 'Workers AI request failed' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet() {
  return Response.json(
    { error: 'Method Not Allowed. Use POST /api/chat with { prompt }.' },
    { status: 405, headers: corsHeaders }
  );
}
