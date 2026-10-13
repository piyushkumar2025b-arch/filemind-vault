import React, { useState, useRef, useEffect } from 'react';
import { Youtube, Search, Play, ExternalLink, Loader2 } from 'lucide-react';

export interface Track {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
}

export const QUEUE_KEY = 'filemind_yt_queue';
export const INDEX_KEY = 'filemind_yt_index';

export function loadQueue(): Track[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}
export function loadIndex(): number {
  try { return parseInt(localStorage.getItem(INDEX_KEY) || '0', 10) || 0; }
  catch { return 0; }
}

export const YTRunnerSearch: React.FC<{
  onPlay: (t: Track) => void;
  configured: boolean | null;
}> = ({ onPlay, configured }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await fetch('/api/yt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', q: query.trim() }),
      });
      const j = await r.json();
      setResults(j.videos ?? []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
          <Youtube className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">YT Runner</h3>
          <p className="text-[11px] text-slate-400">
            {configured === false
              ? 'Waiting for YT_API_KEY secret — search unlocks after you paste it'
              : 'Search YouTube, queue songs, keeps playing until you stop it'}
          </p>
        </div>
      </div>
      <form onSubmit={doSearch} className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs, artists, videos…"
          className="w-full h-11 pl-10 pr-4 rounded-xl text-sm bg-slate-900/60 border border-slate-800 focus:border-red-400 focus:outline-none text-slate-100 placeholder:text-slate-500"
        />
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold disabled:opacity-40 cursor-pointer"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </button>
      </form>
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((v) => (
            <div key={v.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/50 border border-slate-800">
              <img src={v.thumbnail} alt="" className="w-20 h-12 rounded-lg object-cover shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{v.title}</div>
                <div className="text-[11px] text-slate-400 truncate">{v.channel}</div>
              </div>
              <button onClick={() => onPlay(v)} className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-300 cursor-pointer shrink-0" aria-label="Play">
                <Play className="w-4 h-4" />
              </button>
              <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-300 shrink-0" aria-label="Open on YouTube">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


export const YTPlayer: React.FC<{
  queue: Track[]; index: number; playing: boolean;
  setPlaying: (p: boolean) => void;
  setIndex: (i: number) => void;
  onClear: () => void;
}> = ({ queue, index, playing, setPlaying, setIndex, onClear }) => {
  const [showQueue, setShowQueue] = useState(false);
  const current = queue[index];

  // Media Session API: lock-screen / notification controls + background
  // audio in the installed PWA. Song keeps playing until user stops it.
  useEffect(() => {
    if (!current || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title, artist: current.channel, album: 'FileMind YT Runner',
        artwork: current.thumbnail ? [{ src: current.thumbnail, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
      navigator.mediaSession.setActionHandler('play', () => setPlaying(true));
      navigator.mediaSession.setActionHandler('pause', () => setPlaying(false));
      navigator.mediaSession.setActionHandler('previoustrack', () =>
        setIndex((index - 1 + queue.length) % queue.length));
      navigator.mediaSession.setActionHandler('nexttrack', () =>
        setIndex((index + 1) % queue.length));
    } catch { /* unsupported */ }
  }, [current, index, queue.length, setIndex, setPlaying]);

  if (!current) {
    return (
      <div className="p-4 rounded-2xl border border-dashed border-slate-700 text-center text-xs text-slate-500">
        No track queued. Search above and hit play — the player persists across tabs until you stop it.
      </div>
    );
  }
  const next = () => { setIndex((index + 1) % queue.length); setPlaying(true); };
  const prev = () => { setIndex((index - 1 + queue.length) % queue.length); setPlaying(true); };

  return (
    <div className="rounded-2xl bg-slate-950 border border-red-500/30 overflow-hidden">
      <div className="aspect-video w-full bg-black">
        <iframe
          key={current.id + (playing ? '-play' : '-pause')}
          src={`https://www.youtube.com/embed/${current.id}?autoplay=${playing ? 1 : 0}&rel=0`}
          title={current.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
      <div className="p-3 flex items-center gap-2">
        <button onClick={prev} className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 cursor-pointer" aria-label="Previous">Prev</button>
        <button onClick={() => setPlaying(!playing)} className="w-11 h-11 rounded-full bg-red-500 flex items-center justify-center text-white cursor-pointer shadow-lg" aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? 'II' : '>'}
        </button>
        <button onClick={next} className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 cursor-pointer" aria-label="Next">Next</button>
        <div className="min-w-0 flex-1 ml-1">
          <div className="text-xs font-bold text-white truncate">{current.title}</div>
          <div className="text-[11px] text-slate-400 truncate">{playing ? 'Now playing — keeps going until you stop it' : 'Paused'}</div>
        </div>
        <button onClick={() => setShowQueue((s) => !s)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 cursor-pointer">Queue ({queue.length})</button>
        <button onClick={onClear} className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-rose-400 cursor-pointer" aria-label="Stop and clear">X</button>
      </div>
      {showQueue && (
        <div className="px-3 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
          {queue.map((t, i) => (
            <button key={t.id + i} onClick={() => { setIndex(i); setPlaying(true); }}
              className={`w-full flex items-center gap-2 p-2 rounded-lg text-left cursor-pointer ${i === index ? 'bg-red-500/15 border border-red-500/30' : 'bg-slate-900/60 border border-transparent'}`}>
              <span className="text-[11px] text-slate-500 w-4 shrink-0">{i + 1}</span>
              <span className="text-xs text-slate-200 truncate flex-1">{t.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
