import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Play, Square, Download, Search, Crosshair } from 'lucide-react';

/**
 * MapTracker — live location tracking on an OpenStreetMap canvas.
 * - Uses navigator.geolocation.watchPosition for a live trail.
 * - Renders tiles directly via OpenStreetMap's tile server (no API key).
 * - Export the trail as a standard GPX file.
 * - Search any place by name (Nominatim, no key) and centre the map.
 */

interface LatLng {
  lat: number;
  lng: number;
}

interface TrailPoint extends LatLng {
  t: number;
}

const TILE = 256;

function lngToX(lng: number, z: number) {
  return ((lng + 180) / 360) * Math.pow(2, z) * TILE;
}
function latToY(lat: number, z: number) {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * Math.pow(2, z) * TILE;
}
function xToLng(x: number, z: number) {
  return (x / (Math.pow(2, z) * TILE)) * 360 - 180;
}
function yToLat(y: number, z: number) {
  const n = Math.PI - 2 * Math.PI * (y / (Math.pow(2, z) * TILE));
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const MapTracker: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [center, setCenter] = useState<LatLng>({ lat: 28.6139, lng: 77.209 });
  const [zoom, setZoom] = useState(13);
  const [tracking, setTracking] = useState(false);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [current, setCurrent] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number>(0);
  const [status, setStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [drag, setDrag] = useState<LatLng | null>(null);
  const watchRef = useRef<number | null>(null);
  const tileImages = useRef<Record<string, HTMLImageElement>>({});

  const centerRef = useRef(center);
  centerRef.current = center;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const trailRef = useRef(trail);
  trailRef.current = trail;
  const currentRef = useRef(current);
  currentRef.current = current;
  const accuracyRef = useRef(accuracy);
  accuracyRef.current = accuracy;

  const totalKm = trail.reduce((acc, p, i) => (i === 0 ? 0 : acc + haversineKm(trail[i - 1], p)), 0);

  function loadTile(z: number, x: number, y: number, drawFn: () => void) {
    const key = `${z}/${x}/${y}`;
    if (tileImages.current[key]) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    img.onload = () => drawFn();
    tileImages.current[key] = img;
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const z = zoomRef.current;
    const c = centerRef.current;
    const cx = lngToX(c.lng, z);
    const cy = latToY(c.lat, z);
    const originX = cx - w / 2;
    const originY = cy - h / 2;

    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, w, h);

    const minTileX = Math.floor(originX / TILE);
    const maxTileX = Math.floor((originX + w) / TILE);
    const minTileY = Math.floor(originY / TILE);
    const maxTileY = Math.floor((originY + h) / TILE);
    const maxIdx = Math.pow(2, z);

    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        if (ty < 0 || ty >= maxIdx) continue;
        const wrapX = ((tx % maxIdx) + maxIdx) % maxIdx;
        const img = tileImages.current[`${z}/${wrapX}/${ty}`];
        if (img && img.complete) {
          ctx.drawImage(img, tx * TILE - originX, ty * TILE - originY, TILE, TILE);
        }
        loadTile(z, wrapX, ty, draw);
      }
    }

    const toPx = (p: LatLng) => ({ x: lngToX(p.lng, z) - originX, y: latToY(p.lat, z) - originY });

    if (trailRef.current.length > 1) {
      ctx.beginPath();
      trailRef.current.forEach((p, i) => {
        const { x, y } = toPx(p);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    const marker = currentRef.current;
    if (marker) {
      const { x, y } = toPx(marker);
      if (accuracyRef.current) {
        const metersPerPx = (156543.03392 * Math.cos((marker.lat * Math.PI) / 180)) / Math.pow(2, z);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(6, accuracyRef.current / metersPerPx), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34, 211, 238, 0.15)';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#f43f5e';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw, center, zoom, current, trail]);

  useEffect(() => {
    const id = setInterval(() => draw(), 600);
    return () => clearInterval(id);
  }, [draw]);

  const startTracking = () => {
    if (!('geolocation' in navigator)) {
      setStatus('Geolocation is not supported by this browser.');
      return;
    }
    setStatus('Acquiring location…');
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const pt: TrailPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: pos.timestamp };
        setCurrent({ lat: pt.lat, lng: pt.lng });
        setAccuracy(pos.coords.accuracy || 0);
        setCenter({ lat: pt.lat, lng: pt.lng });
        setTrail((prev) => {
          const last = prev[prev.length - 1];
          if (last && haversineKm(last, pt) < 0.01 && pt.t - last.t < 15000) return prev;
          return [...prev, pt];
        });
        setStatus('Live tracking…');
      },
      (err) => setStatus('Location error: ' + err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    setTracking(true);
  };

  const stopTracking = () => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setTracking(false);
    setStatus('Tracking stopped.');
  };

  const clearTrail = () => {
    setTrail([]);
    setStatus('Trail cleared.');
  };

  const recenter = () => {
    if (current) setCenter(current);
    else setStatus('No fix yet — start tracking first.');
  };

  const searchPlace = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/geo?q=${encodeURIComponent(q)}`);
      const j = await r.json();
      const first = Array.isArray(j.results) && j.results.length ? j.results[0] : null;
      if (first) {
        setCenter({ lat: parseFloat(String(first.lat)), lng: parseFloat(String(first.lon)) });
        setZoom(14);
        setStatus(`Found: ${first.display_name}`);
      } else {
        setStatus(j.error || 'No location found for that query.');
      }
    } catch {
      setStatus('Place search failed (offline?).');
    } finally {
      setSearching(false);
    }
  };

  const exportGpx = () => {
    if (trail.length === 0) {
      setStatus('Nothing to export yet.');
      return;
    }
    const pts = trail
      .map((p) => `    <trkpt lat="${p.lat}" lon="${p.lng}"><time>${new Date(p.t).toISOString()}</time></trkpt>`)
      .join('\n');
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="FileMind MapTracker">\n  <trk><name>FileMind Trail</name><trkseg>\n${pts}\n  </trkseg></trk>\n</gpx>`;
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filemind-trail-${new Date().toISOString().slice(0, 10)}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Exported GPX.');
  };

  const onPointerDown = () => setDrag(center);
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const z = zoomRef.current;
    const scale = 360 / (Math.pow(2, z) * TILE);
    const dx = (e.movementX || 0) * scale;
    const cy = latToY(centerRef.current.lat, z) + (e.movementY || 0);
    setCenter({ lat: yToLat(cy, z), lng: wrapLng(centerRef.current.lng + dx) });
  };
  const onPointerUp = () => setDrag(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <MapPin className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Live Map Tracking</h3>
          <p className="text-[11px] text-slate-400">GPS trail · OpenStreetMap · GPX export</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchPlace()}
            placeholder="Search any place…"
            className="w-full h-10 pl-9 pr-3 rounded-xl text-xs bg-slate-900/60 border border-slate-800 text-slate-100 placeholder:text-slate-500 focus:border-rose-400 focus:outline-none"
          />
        </div>
        <button
          onClick={searchPlace}
          disabled={searching}
          className="px-3 h-10 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 cursor-pointer disabled:opacity-50"
        >
          {searching ? '…' : 'Go'}
        </button>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-[#0b1020]">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="w-full h-72 touch-none cursor-grab active:cursor-grabbing"
        />
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button
            onClick={() => setZoom((z) => Math.min(18, z + 1))}
            className="w-8 h-8 rounded-lg bg-slate-900/80 border border-slate-700 text-white text-lg leading-none cursor-pointer"
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(2, z - 1))}
            className="w-8 h-8 rounded-lg bg-slate-900/80 border border-slate-700 text-white text-lg leading-none cursor-pointer"
          >
            −
          </button>
        </div>
        <button
          onClick={recenter}
          title="Recenter on me"
          className="absolute top-2 left-2 w-8 h-8 rounded-lg bg-slate-900/80 border border-slate-700 text-cyan-300 flex items-center justify-center cursor-pointer"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="text-[10px] text-slate-400">Points</div>
          <div className="text-sm font-bold text-white font-mono">{trail.length}</div>
        </div>
        <div className="p-2 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="text-[10px] text-slate-400">Distance</div>
          <div className="text-sm font-bold text-cyan-300 font-mono">{totalKm.toFixed(2)} km</div>
        </div>
        <div className="p-2 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="text-[10px] text-slate-400">Accuracy</div>
          <div className="text-sm font-bold text-fuchsia-300 font-mono">
            {accuracy ? `±${Math.round(accuracy)}m` : '—'}
          </div>
        </div>
      </div>

      {current && (
        <div className="text-[11px] text-slate-400 font-mono text-center">
          {current.lat.toFixed(5)}, {current.lng.toFixed(5)}
        </div>
      )}
      {status && <p className="text-[11px] text-amber-300 text-center">{status}</p>}

      <div className="flex gap-2">
        {!tracking ? (
          <button
            onClick={startTracking}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4" /> Start Tracking
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Square className="w-4 h-4" /> Stop
          </button>
        )}
        <button
          onClick={exportGpx}
          disabled={trail.length === 0}
          className="px-3 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
        >
          <Download className="w-4 h-4" /> GPX
        </button>
        <button
          onClick={clearTrail}
          disabled={trail.length === 0}
          className="px-3 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

function wrapLng(lng: number) {
  let l = lng;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}
