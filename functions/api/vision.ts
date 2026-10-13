/**
 * FileMind Pages Function - Vision (image understanding, no new deps)
 * POST /api/vision { image (dataURL/base64), prompt?, model? }
 * Uses live Workers AI vision models.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const VISION_MODELS = [
  '@cf/meta/llama-3.2-11b-vision-instruct',
  '@cf/moondream/moondream3.1-9B-A2B',
  '@cf/llava-hf/llava-1.5-7b-hf',
  '@cf/qwen/qwen3.8-27b',
];

export async function onRequestPost(context: { request: Request; env: any }) {
  const { request, env } = context;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }
  let image = (body.image ?? '').toString();
  if (!image) return Response.json({ error: 'Missing image (dataURL or base64)' }, { status: 400, headers: corsHeaders });
  if (image.startsWith('data:')) image = image.split(',')[1];
  if (image.length > 7_000_000) {
    return Response.json({ error: 'Image too large (max ~5MB)' }, { status: 400, headers: corsHeaders });
  }
  const prompt = (body.prompt ?? 'Describe this image in detail.').toString().slice(0, 1000);
  const requested = (body.model ?? VISION_MODELS[0]).toString();
  const model = VISION_MODELS.includes(requested) ? requested : VISION_MODELS[0];

  if (!env.AI) {
    return Response.json({ error: 'Workers AI binding missing' }, { status: 500, headers: corsHeaders });
  }
  try {
    const ai = await env.AI.run(model, {
      image,
      prompt,
      max_tokens: 1024,
    });
    const text =
      typeof ai?.response === 'string'
        ? ai.response
        : typeof ai?.description === 'string'
          ? ai.description
          : JSON.stringify(ai).slice(0, 4000);
    return Response.json({ response: text, model }, { headers: corsHeaders });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? 'Vision failed' }, { status: 500, headers: corsHeaders });
  }
}

export async function onRequestGet() {
  return Response.json({ models: VISION_MODELS, usage: 'POST { image, prompt? }' }, { headers: corsHeaders });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
