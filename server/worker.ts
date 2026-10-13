/**
 * FileMind Cloudflare Worker (standalone `wrangler deploy` alternative to Pages).
 * Mirrors functions/api/* so you can deploy EITHER Pages Functions OR this Worker — not both at once.
 * Default deploy path for this repo is Pages (functions/ + dist/).
 */

export interface Env {
  AI?: any;
  VAULT_BUCKET?: any;
  DB?: any;
  ASSETS?: any;
}

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';
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

function extractText(aiResponse: any): string {
  if (!aiResponse) return '';
  if (typeof aiResponse === 'string') return aiResponse;
  if (typeof aiResponse.response === 'string') return aiResponse.response;
  if (typeof aiResponse.result?.response === 'string') return aiResponse.result.response;
  if (typeof aiResponse.output_text === 'string') return aiResponse.output_text;
  if (typeof aiResponse.text === 'string') return aiResponse.text;
  return JSON.stringify(aiResponse).slice(0, 4000);
}

// --- AI guardrails (mirror of functions/api/chat.ts + src/services/guardrails.ts) ---
const BLOCK_PATTERNS: RegExp[] = [
  /\bhow\s+to\s+(make|build|assemble|create)\b[^.?]{0,40}\b(bomb|explosive|detonator|nerve\s*agent|ricin|malware|keylogger|ransomware)\b/i,
  /\bhow\s+to\s+(kill|hang)\s+myself\b|\bbest\s+way\s+to\s+(commit\s+suicide|end\s+my\s+life)\b/i,
  /\b(child|kid|minor|underage)\b[^.?]{0,30}\b(nude|naked|porn|sexual)\b/i,
  /\bignore\s+(all\s+|any\s+|the\s+|your\s+|previous\s+|above\s+)*(instructions?|rules?|prompts?|guardrails?)\b/i,
  /\byou\s+are\s+now\s+(dan|jailbroken|evil|unfiltered|uncensored)\b/i,
  /\bforget\s+(everything|all|your\s+(rules|instructions|training))\b/i,
];

function isBlocked(prompt: string): boolean {
  return BLOCK_PATTERNS.some((p) => p.test(prompt));
}

function sanitizeContext(text: string): string {
  return (text || '')
    .split('\n')
    .filter((l) => !/^\s*(ignore\s+(all|any|the|your|previous|above)?\s*(instructions?|rules?|prompts?)|you\s+are\s+now\s+(dan|jailbroken|evil)|<\s*system\s*>)/i.test(l))
    .join('\n');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 1. Workers AI Document Q&A (RAG)
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
      }
      try {
        const prompt = (body.prompt ?? '').toString().trim().slice(0, 4000);
        if (!prompt) {
          return Response.json({ error: 'Missing required field: prompt' }, { status: 400, headers: corsHeaders });
        }
        // AI guardrail gate
        if (isBlocked(prompt)) {
          return Response.json(
            {
              response:
                '🛡️ This request was blocked by AI Safety Guardrails. FileMind refuses to help with harmful, unsafe, or unauthorized content.',
              blocked: true,
              model: DEFAULT_MODEL,
            },
            { headers: corsHeaders }
          );
        }
        const requested = (body.model ?? DEFAULT_MODEL).toString();
        const model = ALLOWED_MODELS.has(requested) ? requested : DEFAULT_MODEL;
        const contextChunks = Array.isArray(body.contextChunks) ? body.contextChunks.slice(0, 12) : [];

        let contextText = contextChunks
          .map((c: any) => `Source [${c.fileName ?? 'unknown'}]: ${(c.text ?? '').toString().slice(0, 2000)}`)
          .join('\n\n')
          .slice(0, 12000);
        contextText = sanitizeContext(contextText);

        const systemMessage =
          'You are FileMind AI, a private personal knowledge assistant. Answer accurately based solely on the provided personal file chunks. Cite sources when answering.';

        if (env.AI) {
          const aiResponse = await env.AI.run(model, {
            messages: [
              { role: 'system', content: `${systemMessage}\n\n${contextText}` },
              { role: 'user', content: prompt },
            ],
          });
          return Response.json({ response: extractText(aiResponse), model }, { headers: corsHeaders });
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
        return Response.json({ error: err?.message ?? 'Workers AI request failed' }, { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === '/api/chat') {
      return Response.json(
        { error: 'Method Not Allowed. Use POST /api/chat with { prompt }.' },
        { status: 405, headers: corsHeaders }
      );
    }

    // 2. Health check
    if (url.pathname === '/api/health') {
      return Response.json(
        { status: 'ok', service: 'FileMind Cloudflare Worker', timestamp: Date.now() },
        { headers: corsHeaders }
      );
    }

    // 3. Serve static assets when bound (Pages/Worker static assets), else fallback text
    if (env.ASSETS) {
      try {
        return await env.ASSETS.fetch(request);
      } catch {
        // fall through
      }
    }

    return new Response('FileMind Worker Active', { status: 200, headers: corsHeaders });
  },
};
