/**
 * FileMind Cloudflare Pages Function - Health Check
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestGet() {
  return Response.json(
    { status: 'ok', service: 'FileMind Cloudflare Pages', timestamp: Date.now() },
    { headers: corsHeaders }
  );
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
