import React, { useState, useEffect } from 'react';
import { Youtube, Volume2, QrCode, Newspaper, MessagesSquare, Send } from 'lucide-react';
import { VaultFile, CloudflareConfig } from '../types';
import { YTRunnerSearch, YTPlayer, Track, loadQueue, loadIndex, QUEUE_KEY, INDEX_KEY } from './YTRunner';
import { ReadAloud } from './ReadAloud';
import { QRConverter } from './QRConverter';
import { NewsHub } from './NewsHub';
import { ModeChat } from './ModeChat';
import { TelegramPanel } from './TelegramPanel';

type HubSection = 'modes' | 'yt' | 'news' | 'read' | 'qr' | 'telegram';

const SECTIONS: { id: HubSection; label: string; icon: React.FC<{ className?: string }>; color: string }[] = [
  { id: 'modes', label: 'Modes', icon: MessagesSquare, color: 'cyan' },
  { id: 'yt', label: 'Music', icon: Youtube, color: 'red' },
  { id: 'news', label: 'News', icon: Newspaper, color: 'amber' },
  { id: 'read', label: 'Reader', icon: Volume2, color: 'fuchsia' },
  { id: 'qr', label: 'QR', icon: QrCode, color: 'emerald' },
  { id: 'telegram', label: 'Telegram', icon: Send, color: 'sky' },
];

export const HubScreen: React.FC<{ files: VaultFile[]; cloudflareConfig: CloudflareConfig | null }> = ({
  files,
  cloudflareConfig,
}) => {
  const [section, setSection] = useState<HubSection>('modes');
  const [queue, setQueue] = useState<Track[]>(loadQueue);
  const [index, setIndexState] = useState(loadIndex);
  const [playing, setPlaying] = useState(false);
  const [ytConfigured, setYtConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }, [queue]);
  useEffect(() => {
    localStorage.setItem(INDEX_KEY, String(index));
  }, [index]);
  useEffect(() => {
    fetch('/api/yt')
      .then((r) => r.json())
      .then((j) => setYtConfigured(Boolean(j.configured)))
      .catch(() => setYtConfigured(false));
  }, []);

  const playTrack = (t: Track) => {
    setQueue((q) => {
      const existing = q.findIndex((x) => x.id === t.id);
      if (existing >= 0) {
        setIndexState(existing);
        return q;
      }
      setIndexState(q.length);
      return [...q, t];
    });
    setPlaying(true);
  };
  const setIndex = (i: number | ((p: number) => number)) => {
    setIndexState(typeof i === 'function' ? (i as any)(index) : i);
  };
  const clearQueue = () => {
    setPlaying(false);
    setQueue([]);
    setIndexState(0);
    localStorage.removeItem(QUEUE_KEY);
    localStorage.removeItem(INDEX_KEY);
  };

  const color: Record<string, string> = {
    cyan: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
    red: 'bg-red-500/20 border-red-500/40 text-red-300',
    amber: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
    fuchsia: 'bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-300',
    emerald: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    sky: 'bg-sky-500/20 border-sky-500/40 text-sky-300',
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-28 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">Command Hub</h2>
        <p className="text-xs text-slate-400">Chat modes · YT Runner · AI News · Reader · QR · Telegram</p>
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[10px] font-bold cursor-pointer transition-all ${active ? color[s.color] : 'bg-slate-900/50 border-slate-800 text-slate-400'}`}
            >
              <Icon className="w-4 h-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
        {section === 'modes' && <ModeChat files={files} config={cloudflareConfig} />}
        {section === 'yt' && (
          <div className="space-y-4">
            <YTRunnerSearch onPlay={playTrack} configured={ytConfigured} />
            <YTPlayer queue={queue} index={index} playing={playing} setPlaying={setPlaying} setIndex={setIndex} onClear={clearQueue} />
          </div>
        )}
        {section === 'news' && <NewsHub />}
        {section === 'read' && <ReadAloud files={files} />}
        {section === 'qr' && <QRConverter />}
        {section === 'telegram' && <TelegramPanel />}
      </div>

      {/* Mini persistent player — visible on every Hub section while queued */}
      {section !== 'yt' && queue[index] && (
        <div className="p-3 rounded-2xl bg-slate-950 border border-red-500/30 flex items-center gap-2">
          <img src={queue[index].thumbnail} alt="" className="w-12 h-8 rounded-lg object-cover shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate">{queue[index].title}</div>
            <div className="text-[10px] text-slate-400">{playing ? 'Playing…' : 'Paused'}</div>
          </div>
          <button onClick={() => setPlaying(!playing)} className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold cursor-pointer">
            {playing ? 'II' : '>'}
          </button>
          <button onClick={() => setSection('yt')} className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-[11px] text-slate-300 cursor-pointer">Open</button>
        </div>
      )}
    </div>
  );
};
