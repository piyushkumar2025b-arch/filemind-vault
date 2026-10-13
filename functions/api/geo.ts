/**
 * FileMind Cloudflare Pages Function - Geocoding (FREE, no keys)
 * GET /api/geo?q=Paris              → forward geocode (place → coords)
 * GET /api/geo?lat=..&lon=..        → reverse geocode (coords → place)
 * Uses OpenStreetMap Nominatim (usage policy: include a User-Agent, no bulk).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=3600',
};

const UA = 'FileMind/1.0 (personal file vault app)';

async function fetchJSON(url: string, timeoutMs = 8000): Promise<any> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function onRequestGet(context: { request: Request }) {
  const url = new URL(context.request.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 120);

  // Reverse geocode: coords → human-readable place
  if (lat && lon) {
    const data = await fetchJSON(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=14&addressdetails=1`
    );
    if (data?.display_name) {
      return Response.json(
        { display_name: data.display_name, lat: parseFloat(data.lat), lon: parseFloat(data.lon), address: data.address ?? null },
        { headers: corsHeaders }
      );
    }
    return Response.json({ error: 'No place found for those coordinates.' }, { status: 404, headers: corsHeaders });
  }

  // Forward geocode: place → coords
  if (!q) return Response.json({ error: 'Provide ?q=place or ?lat=&lon=' }, { status: 400, headers: corsHeaders });
  const data = await fetchJSON(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`
  );
  const results = (Array.isArray(data) ? data : []).map((r: any) => ({
    name: r.name || (r.display_name || '').split(',')[0],
    display_name: r.display_name,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    type: r.type,
    category: r.category,
  }));
  return Response.json({ query: q, count: results.length, results }, { headers: corsHeaders });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
