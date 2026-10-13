/**
 * FileMind Cloudflare Pages Function - Weather (FREE, no keys)
 * GET /api/weather?city=London
 * Geocodes the city via Open-Meteo, then fetches current conditions.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=600',
};

const WMO_CODES: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers',
  85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Severe thunderstorm',
};

async function fetchJSON(url: string, timeoutMs = 8000): Promise<any> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': 'FileMind/1.0' } });
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
  const city = (url.searchParams.get('city') || '').trim().slice(0, 80);
  if (!city) return Response.json({ error: 'Missing ?city=' }, { status: 400, headers: corsHeaders });

  // 1. Geocode (Open-Meteo, free, no key)
  const geo = await fetchJSON(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
  );
  const place = geo?.results?.[0];
  if (!place) return Response.json({ error: `Could not find "${city}".` }, { status: 404, headers: corsHeaders });

  // 2. Current weather
  const wx = await fetchJSON(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`
  );
  const cur = wx?.current;
  if (!cur) return Response.json({ error: 'Weather data unavailable.' }, { status: 502, headers: corsHeaders });

  return Response.json(
    {
      place: `${place.name}${place.country ? ', ' + place.country : ''}`,
      temp: cur.temperature_2m,
      feels: cur.apparent_temperature,
      humidity: cur.relative_humidity_2m,
      wind: cur.wind_speed_10m,
      code: cur.weather_code,
      desc: WMO_CODES[cur.weather_code] ?? 'Current conditions',
    },
    { headers: corsHeaders }
  );
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
