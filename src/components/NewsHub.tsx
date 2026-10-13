import React, { useState } from 'react';
import { Newspaper, ExternalLink, Loader2, Sparkles, Send } from 'lucide-react';

interface NewsItem { id: string; title: string; url: string; source: string; points?: number; comments?: number; }

const TOPICS = ['ai', 'tech', 'security', 'science', 'programming'];

export const NewsHub: React.FC = () => {
  const [topic, setTopic] = useState('ai');
  const [items, setItems] = useState<NewsItem[]>([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [chatId, setChatId] = useState('');
  const [tgMsg, setTgMsg] = useState('');

  const load = async (t: string) => {
    setTopic(t);
    setLoading(true);
    setSummary('');
    try {
      const r = await fetch(`/api/news?topic=${encodeURIComponent(t)}&limit=10`);
      setItems((await r.json()).items ?? []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  const summarize = async () => {
    setSummarizing(true);
    try {
      const r = await fetch('/api/ai-news', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const j = await r.json();
      setSummary(j.summary ?? '');
      if (j.items?.length) setItems(j.items);
    } catch { setSummary('Summary failed.'); }
    finally { setSummarizing(false); }
  };

  const sendToTelegram = async () => {
    if (!chatId.trim() || !summary) return;
    setTgMsg('Sending…');
    try {
      const r = await fetch('/api/telegram', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', chatId: chatId.trim(), text: `FileMind ${topic} briefing:\n\n${summary}`.slice(0, 4000) }),
      });
      const j = await r.json();
      setTgMsg(j.ok ? 'Sent to Telegram!' : (j.error || 'Failed — set TELEGRAM_BOT_TOKEN secret'));
    } catch { setTgMsg('Failed.'); }
  };

  useState(() => { load('ai'); });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Newspaper className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">AI News (free sources)</h3>
          <p className="text-[11px] text-slate-400">HackerNews · Dev.to · Lobsters — no keys needed</p>
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {TOPICS.map((t) => (
          <button key={t} onClick={() => load(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize cursor-pointer ${topic === t ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}>
            {t}
          </button>
        ))}
        <button onClick={summarize} disabled={summarizing}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-500/20 border border-purple-500/40 text-purple-300 disabled:opacity-40 cursor-pointer flex items-center gap-1">
          {summarizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          AI Briefing
        </button>
      </div>
      {summary && (
        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">{summary}</div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Fetching headlines…</div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-amber-500/40 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-100 leading-snug">{n.title}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{n.source}{n.points ? ` · ${n.points} pts` : ''}{n.comments ? ` · ${n.comments} comments` : ''}</div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            </a>
          ))}
          {items.length === 0 && !loading && <p className="text-xs text-slate-500">No stories — try another topic.</p>}
        </div>
      )}
      {summary && (
        <div className="flex gap-2">
          <input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Telegram chat ID (optional)"
            className="flex-1 h-10 px-3 rounded-xl text-xs bg-slate-900/60 border border-slate-800 focus:border-amber-400 focus:outline-none text-slate-100 placeholder:text-slate-500" />
          <button onClick={sendToTelegram} className="px-3 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-bold cursor-pointer flex items-center gap-1">
            <Send className="w-3.5 h-3.5" /> {tgMsg || 'Send'}
          </button>
        </div>
      )}
    </div>
  );
};
