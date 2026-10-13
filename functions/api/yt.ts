/**
 * FileMind Pages Function - YouTube Runner bridge
 * The API key YOU provide goes here as a Pages secret (never in code):
 *   wrangler pages secret put YT_API_KEY --project-name filemind-vault
 * Frontend polls this endpoint for queue state; localStorage persists the
 * queue so music survives navigation. (True background-after-close needs
 * the installed PWA + Media Session API — wired in the YT Runner UI.)
 *
 * GET  /api/yt?part=status            → { configured, queueLength? }
 * POST /api/yt { action:'search'|'video'|'queue-add'|'queue-list'|'queue-next'|'queue-clear', ... }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface YTVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
}

async function ytSearch(apiKey: string, q: string): Promise<YTVideo[]> {
  const u = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(q)}&key=${apiKey}`;
  const r = await fetch(u);
  if (!r.ok) return [];
  const j: any = await r.json();
  return (j.items ?? []).map((it: any) => ({
    id: it.id.videoId,
    title: it.snippet.title,
    channel: it.snippet.channelTitle,
    thumbnail: it.snippet.thumbnails?.medium?.url ?? '',
  }));
}

async function ytVideo(apiKey: string, id: string): Promise<YTVideo | null> {
  const u = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(id)}&key=${apiKey}`;
  const r = await fetch(u);
  if (!r.ok) return null;
  const j: any = await r.json();
  const it = j.items?.[0];
  if (!it) return null;
  return {
    id,
    title: it.snippet.title,
    channel: it.snippet.channelTitle,
    thumbnail: it.snippet.thumbnails?.medium?.url ?? '',
  };
}

export async function onRequestGet(context: { request: Request; env: any }) {
  const hasKey = Boolean(context.env?.YT_API_KEY);
  return Response.json(
    {
      service: 'FileMind YT Runner',
      configured: hasKey,
      setup: hasKey ? undefined : 'Paste your key: wrangler pages secret put YT_API_KEY --project-name filemind-vault',
    },
    { headers: corsHeaders }
  );
}

export async function onRequestPost(context: { request: Request; env: any }) {
  const { request, env } = context;
  const apiKey = env.YT_API_KEY as string | undefined;
  if (!apiKey) {
    return Response.json(
      { error: 'YT_API_KEY not set', setup: 'wrangler pages secret put YT_API_KEY --project-name filemind-vault' },
      { status: 400, headers: corsHeaders }
    );
  }
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }
  const action = (body.action ?? '').toString();

  if (action === 'search') {
    const q = (body.q ?? '').toString().slice(0, 100);
    if (!q) return Response.json({ error: 'Missing q' }, { status: 400, headers: corsHeaders });
    const videos = await ytSearch(apiKey, q);
    return Response.json({ videos }, { headers: corsHeaders });
  }
  if (action === 'video') {
    const v = await ytVideo(apiKey, (body.id ?? '').toString());
    if (!v) return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    return Response.json({ video: v }, { headers: corsHeaders });
  }
  return Response.json({ error: `Unknown action: ${action}` }, { status: 400, headers: corsHeaders });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
