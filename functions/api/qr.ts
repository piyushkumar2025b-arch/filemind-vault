/**
 * FileMind Pages Function - QR (zero-dependency, Workers-safe)
 * POST /api/qr { text } → { qr (dataURL png), text }
 * GET  /api/qr?text=hello → same
 * Uses api.qrserver.com (goqr.me) render API — free, no key, edge-safe
 * (the `qrcode` npm lib needs Node Buffer/png and 500s on Workers,
 *  so we proxy a dedicated QR renderer instead).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function makeQrDataUrl(text: string): Promise<string> {
  const r = await fetch(
    `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=8&data=${encodeURIComponent(text)}`
  );
  if (!r.ok) throw new Error(`QR renderer ${r.status}`);
  const buf = await r.arrayBuffer();
  // base64 without Node Buffer
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // btoa chokes on huge strings — chunk it
  let b64 = '';
  for (let i = 0; i < binary.length; i += 8192) {
    b64 += btoa(binary.slice(i, i + 8192));
  }
  return `data:image/png;base64,${b64}`;
}

export async function onRequestPost(context: { request: Request }) {
  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }
  const text = (body.text ?? '').toString().slice(0, 2000);
  if (!text) return Response.json({ error: 'Missing text' }, { status: 400, headers: corsHeaders });
  try {
    const qr = await makeQrDataUrl(text);
    return Response.json({ qr, text }, { headers: corsHeaders });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? 'QR failed' }, { status: 502, headers: corsHeaders });
  }
}

export async function onRequestGet(context: { request: Request }) {
  const text = (new URL(context.request.url).searchParams.get('text') ?? '').slice(0, 2000);
  if (!text) {
    return Response.json({ usage: 'GET /api/qr?text=hello or POST { text }' }, { headers: corsHeaders });
  }
  try {
    const qr = await makeQrDataUrl(text);
    return Response.json({ qr, text }, { headers: corsHeaders });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? 'QR failed' }, { status: 502, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
