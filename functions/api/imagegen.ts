/**
 * FileMind Pages Function - Free AI Image Generation
 * POST /api/imagegen { prompt, model? } → { image: base64PNG, model, prompt }
 * Uses free image models on Cloudflare Workers AI:
 *   - @cf/black-forest-labs/flux-1-schnell  (fast, default)
 *   - @cf/stabilityai/stable-diffusion-xl-base-1.0 (quality fallback)
 * Safety guardrails are enforced on the prompt before generation.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MODELS: Record<string, string> = {
  flux: '@cf/black-forest-labs/flux-1-schnell',
  sdxl: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
};

// Same hard rules as /api/chat — no harmful generations.
const BLOCK_PATTERNS: RegExp[] = [
  /\b(nude|naked|nsfw|porn|explicit|gore|beheading|corpse)\b/i,
  /\b(child|kid|minor|underage)\b[^.?]{0,30}\b(nude|naked|sexual|bikini|shower)/i,
  /\bmake\s+a\s+(bomb|explosive|gun|weapon)\b/i,
  /\b(hitler|nazi salute)\b[^.?]{0,20}\b(realistic|photo)/i,
  /ignore\s+(all|any|the|your)?\s*(instructions?|rules?|guardrails?)/i,
];

function isBlocked(prompt: string): boolean {
  return BLOCK_PATTERNS.some((p) => p.test(prompt));
}

/** Uint8Array → base64 (chunked, Workers-safe). */
function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export async function onRequestPost(context: { request: Request; env: any }) {
  const { request, env } = context;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }

  const prompt = (body.prompt ?? '').toString().trim().slice(0, 800);
  if (!prompt) return Response.json({ error: 'Missing prompt' }, { status: 400, headers: corsHeaders });

  if (isBlocked(prompt)) {
    return Response.json(
      { error: '🛡️ This image request was blocked by AI Safety Guardrails. FileMind refuses harmful or explicit generations.', blocked: true },
      { status: 403, headers: corsHeaders }
    );
  }
  if (!env.AI) {
    return Response.json({ error: 'Workers AI binding missing' }, { status: 500, headers: corsHeaders });
  }

  const requested = (body.model ?? 'flux').toString();
  const model = MODELS[requested] ?? MODELS.flux;

  const runModel = async (m: string): Promise<string | null> => {
    try {
      const ai: any = m.includes('flux')
        ? await env.AI.run(m, { prompt, num_steps: 4, guidance: 3 })
        : await env.AI.run(m, {
            prompt,
            negative_prompt: 'blurry, low quality, distorted, watermark, text',
            height: 512,
            width: 512,
            num_steps: 20,
            guidance: 7.5,
          });
      // Response shapes: Uint8Array | { image: Uint8Array } | { image: base64 }
      if (ai instanceof Uint8Array) return bytesToBase64(ai);
      if (ai?.image instanceof Uint8Array) return bytesToBase64(ai.image);
      if (typeof ai?.image === 'string') return ai.image.replace(/^data:image\/\w+;base64,/, '');
      if (ai?.image?.data) return bytesToBase64(new Uint8Array(ai.image.data));
      if (ai instanceof ArrayBuffer) return bytesToBase64(new Uint8Array(ai));
      return null;
    } catch (err: any) {
      console.warn(`imagegen model ${m} failed:`, err?.message);
      return null;
    }
  };

  // Try requested model, then the other one as fallback.
  let b64 = await runModel(model);
  let usedModel = model;
  if (!b64) {
    const alt = model === MODELS.flux ? MODELS.sdxl : MODELS.flux;
    b64 = await runModel(alt);
    usedModel = alt;
  }
  if (!b64) {
    return Response.json({ error: 'Image generation failed — try a different prompt or model.' }, { status: 502, headers: corsHeaders });
  }

  return Response.json({ image: b64, mime: 'image/png', model: usedModel, prompt }, { headers: corsHeaders });
}

export async function onRequestGet() {
  return Response.json(
    { usage: 'POST { prompt, model?: "flux"|"sdxl" } → { image: base64 }', models: Object.keys(MODELS) },
    { headers: corsHeaders }
  );
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
