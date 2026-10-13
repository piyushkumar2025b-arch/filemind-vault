import React, { useState } from 'react';
import { MessageSquare, Globe, Newspaper, Loader2, ExternalLink } from 'lucide-react';
import { VaultFile, CloudflareConfig } from '../types';
import { retrieveRelevantChunks } from '../services/aiCompanion';

export type ChatMode = 'chat' | 'internet' | 'news';

const MODES: { id: ChatMode; label: string; icon: React.FC<{ className?: string }>; hint: string }[] = [
  { id: 'chat', label: 'Vault', icon: MessageSquare, hint: 'Private files only' },
  { id: 'internet', label: 'Internet', icon: Globe, hint: 'Live web + AI' },
  { id: 'news', label: 'News', icon: Newspaper, hint: 'Fresh headlines' },
];

export const ModeChat: React.FC<{ files: VaultFile[]; config: CloudflareConfig | null }> = ({ files, config }) => {
  const [mode, setMode] = useState<ChatMode>('chat');
  const [input, setInput] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<any[]>([]);
  const [thinking, setThinking] = useState(false);

  const ask = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || thinking) return;
    setThinking(true);
    setAnswer('');
    setSources([]);
    try {
      const rag = retrieveRelevantChunks(input.trim(), files, undefined, 4);
      const r = await fetch('/api/modes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt: input.trim(),
          model: config?.aiModel,
          contextChunks: rag.chunks,
        }),
      });
      const j = await r.json();
      setAnswer(j.response || j.error || 'No answer.');
      setSources(j.sources ?? []);
    } catch {
      setAnswer('Request failed — check connection.');
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${active ? 'bg-cyan-500/15 border-cyan-500/40' : 'bg-slate-900/50 border-slate-800'}`}
            >
              <Icon className={`w-4 h-4 mb-1 ${active ? 'text-cyan-300' : 'text-slate-400'}`} />
              <div className={`text-xs font-bold ${active ? 'text-cyan-200' : 'text-slate-300'}`}>{m.label}</div>
              <div className="text-[10px] text-slate-500">{m.hint}</div>
            </button>
          );
        })}
      </div>
      <form onSubmit={ask} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === 'chat' ? 'Ask your vault…' : mode === 'internet' ? 'Ask the live web…' : 'News topic (ai, tech)…'}
          className="flex-1 h-11 px-3 rounded-xl text-xs bg-slate-900/60 border border-slate-800 focus:border-cyan-400 focus:outline-none text-slate-100 placeholder:text-slate-500"
        />
        <button type="submit" disabled={thinking || !input.trim()} className="px-4 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold disabled:opacity-40 cursor-pointer">
          {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}
        </button>
      </form>
      {answer && (
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">{answer}</div>
      )}
      {sources.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase font-bold text-slate-500">Sources</div>
          {sources.slice(0, 5).map((s: any, i: number) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[11px] text-cyan-300 hover:underline">
              <ExternalLink className="w-3 h-3 shrink-0" />
              <span className="truncate">{s.title} ({s.source})</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
