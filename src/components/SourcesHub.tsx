import React from 'react';
import { Globe, ExternalLink, Database, Newspaper, MapPin, BookOpen, Code, Cloud } from 'lucide-react';

/**
 * SourcesHub — a curated directory of every free, no-key data source
 * FileMind uses (plus extras you can explore). Explains how each is wired
 * into the app so users know exactly what powers the AI.
 */

interface Source {
  name: string;
  category: string;
  icon: React.FC<{ className?: string }>;
  url: string;
  free: string;
  usedFor: string;
}

const SOURCES: Source[] = [
  { name: 'Cloudflare Workers AI', category: 'AI', icon: Cloud, url: 'https://developers.cloudflare.com/workers-ai/', free: 'Free tier', usedFor: 'Chat, vision, translation & TTS on the edge' },
  { name: 'Hacker News (Algolia)', category: 'News', icon: Newspaper, url: 'https://hn.algolia.com/api', free: 'Free, no key', usedFor: 'Tech/AI headlines & discussion' },
  { name: 'Dev.to', category: 'News', icon: Code, url: 'https://developers.forem.com/api', free: 'Free, no key', usedFor: 'Developer articles by tag' },
  { name: 'Lobsters', category: 'News', icon: Newspaper, url: 'https://lobste.rs', free: 'Free, no key', usedFor: 'Curated CS/tech links' },
  { name: 'DuckDuckGo Instant Answer', category: 'Search', icon: Globe, url: 'https://duckduckgo.com', free: 'Free, no key', usedFor: 'Web answers & related topics' },
  { name: 'Wikipedia', category: 'Search', icon: BookOpen, url: 'https://en.wikipedia.org', free: 'Free, no key', usedFor: 'Encyclopedia fallback & summaries' },
  { name: 'OpenStreetMap Tiles', category: 'Maps', icon: MapPin, url: 'https://www.openstreetmap.org', free: 'Free (ODbL)', usedFor: 'Live map background tiles' },
  { name: 'Nominatim', category: 'Maps', icon: MapPin, url: 'https://nominatim.org', free: 'Free, no key', usedFor: 'Place name → coordinates search' },
  { name: 'Open-Meteo', category: 'Weather', icon: Cloud, url: 'https://open-meteo.com', free: 'Free, no key', usedFor: 'Live weather & forecasts' },
  { name: 'LibreTranslate', category: 'Translate', icon: Globe, url: 'https://libretranslate.com', free: 'Free, no key', usedFor: 'Multi-language translation' },
  { name: 'Free Dictionary API', category: 'Language', icon: BookOpen, url: 'https://dictionaryapi.dev', free: 'Free, no key', usedFor: 'Definitions, phonetics, examples' },
  { name: 'YouTube (Piped/Invidious)', category: 'Music', icon: Code, url: 'https://docs.piped.video', free: 'Free', usedFor: 'Audio search & streaming for Music Hub' },
];

const CATEGORY_COLORS: Record<string, string> = {
  AI: 'bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-300',
  News: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  Search: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
  Maps: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
  Weather: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
  Translate: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
  Language: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
  Music: 'bg-red-500/15 border-red-500/30 text-red-300',
};

export const SourcesHub: React.FC = () => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Data Sources</h3>
          <p className="text-[11px] text-slate-400">Every free, no-API-key source powering FileMind</p>
        </div>
      </div>

      <div className="space-y-2">
        {SOURCES.map((s) => {
          const Icon = s.icon;
          return (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/40 dark:bg-slate-900/40 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200 hover:border-cyan-500/40 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-800 dark:bg-slate-800 light:bg-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white dark:text-white light:text-slate-900 truncate">{s.name}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[s.category] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                    {s.category}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">{s.usedFor}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] text-emerald-400 font-semibold">{s.free}</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </div>
            </a>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
        All sources are privacy-friendly and require no account or API key. Your vault files never
        leave your device — only the queries you type are sent to these free endpoints.
      </p>
    </div>
  );
};
