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

  const requestedModel = (body.model ?? DEFAULT_MODEL).toString();
  const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;
  const contextChunks = Array.isArray(body.contextChunks) ? body.contextChunks.slice(0, 12) : [];

  let contextText = contextChunks
    .map((c) => `Source [${c.fileName ?? 'unknown'}]: ${(c.text ?? '').toString().slice(0, 2000)}`)
    .join('\n\n');
  if (contextText.length > MAX_CONTEXT_CHARS) {
    contextText = contextText.slice(0, MAX_CONTEXT_CHARS) + '\n…(truncated)';
  }

  const systemMessage =
    'You are FileMind AI, a private personal knowledge assistant. Answer accurately based solely on the provided personal file chunks. Cite sources when answering.';

  try {
    if (env.AI) {
      const aiResponse = await env.AI.run(model, {
        messages: [
          { role: 'system', content: `${systemMessage}\n\n${contextText}` },
          { role: 'user', content: prompt },
        ],
      });
      const text = extractText(aiResponse);
      return Response.json({ response: text, model }, { headers: corsHeaders });
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
