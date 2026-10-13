import React, { useState } from 'react';
import { Languages, CloudSun, BookOpen, Loader2, Copy, Check, Volume2 } from 'lucide-react';

/**
 * ToolsPanel — everyday utilities powered entirely by free, no-key APIs
 * proxied through FileMind edge functions:
 *   /api/translate  → LibreTranslate
 *   /api/weather    → Open-Meteo (geocode + forecast)
 *   /api/dictionary → dictionaryapi.dev
 */

type Tool = 'translate' | 'weather' | 'dictionary';

const LANGS = [
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ru', label: 'Russian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'en', label: 'English' },
];

export const ToolsPanel: React.FC = () => {
  const [tool, setTool] = useState<Tool>('translate');

  // Translate state
  const [tText, setTText] = useState('');
  const [tLang, setTLang] = useState('es');
  const [tResult, setTResult] = useState('');
  const [tLoading, setTLoading] = useState(false);

  // Weather state
  const [wCity, setWC] = useState('');
  const [wData, setWData] = useState<any>(null);
  const [wLoading, setWLoading] = useState(false);

  // Dictionary state
  const [dWord, setDWord] = useState('');
  const [dData, setDData] = useState<any>(null);
  const [dLoading, setDLoading] = useState(false);

  const [copied, setCopied] = useState(false);

  const speak = (text: string) => {
    try {
      const u = new SpeechSynthesisUtterance(text.slice(0, 2000));
      window.speechSynthesis.speak(u);
    } catch {
      /* noop */
    }
  };

  const doTranslate = async () => {
    if (!tText.trim()) return;
    setTLoading(true);
    setTResult('');
    try {
      const r = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: tText, target: tLang }),
      });
      const j = await r.json();
      setTResult(j.translated || j.error || 'Translation unavailable.');
    } catch {
      setTResult('Translation failed (offline?).');
    } finally {
      setTLoading(false);
    }
  };

  const doWeather = async () => {
    if (!wCity.trim()) return;
    setWLoading(true);
    setWData(null);
    try {
      const r = await fetch(`/api/weather?city=${encodeURIComponent(wCity)}`);
      const j = await r.json();
      setWData(j.error ? { error: j.error } : j);
    } catch {
      setWData({ error: 'Weather lookup failed (offline?).' });
    } finally {
      setWLoading(false);
    }
  };

  const doDictionary = async () => {
    if (!dWord.trim()) return;
    setDLoading(true);
    setDData(null);
    try {
      const r = await fetch(`/api/dictionary?word=${encodeURIComponent(dWord.trim())}`);
      const j = await r.json();
      setDData(j.error ? { error: j.error } : j);
    } catch {
      setDData({ error: 'Dictionary lookup failed (offline?).' });
    } finally {
      setDLoading(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tools: { id: Tool; label: string; icon: React.FC<{ className?: string }>; color: string }[] = [
    { id: 'translate', label: 'Translate', icon: Languages, color: 'indigo' },
    { id: 'weather', label: 'Weather', icon: CloudSun, color: 'sky' },
    { id: 'dictionary', label: 'Dictionary', icon: BookOpen, color: 'emerald' },
  ];

  const activeColor: Record<string, string> = {
    indigo: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
    sky: 'bg-sky-500/20 border-sky-500/40 text-sky-300',
    emerald: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <Languages className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Smart Tools</h3>
          <p className="text-[11px] text-slate-400">Translate · Weather · Dictionary — all free</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[10px] font-bold cursor-pointer transition-all ${
                tool === t.id ? activeColor[t.color] : 'bg-slate-900/50 border-slate-800 text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Translate */}
      {tool === 'translate' && (
        <div className="space-y-2">
          <textarea
            value={tText}
            onChange={(e) => setTText(e.target.value.slice(0, 2000))}
            placeholder="Type text to translate…"
            rows={3}
            className="w-full p-3 rounded-xl text-xs bg-slate-900/60 border border-slate-800 focus:border-indigo-400 focus:outline-none text-slate-100 placeholder:text-slate-500"
          />
          <div className="flex gap-2">
            <select
              value={tLang}
              onChange={(e) => setTLang(e.target.value)}
              className="h-10 px-3 rounded-xl text-xs bg-slate-900 border border-slate-800 text-indigo-300 font-semibold focus:outline-none cursor-pointer"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <button
              onClick={doTranslate}
              disabled={tLoading || !tText.trim()}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-xs disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
            >
              {tLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
              Translate
            </button>
          </div>
          {tResult && (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-100 whitespace-pre-wrap">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wide text-indigo-400 font-bold">Result</span>
                <div className="flex gap-1.5">
                  <button onClick={() => speak(tResult)} className="p-1 text-slate-400 hover:text-white cursor-pointer" title="Read aloud">
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => copyText(tResult)} className="p-1 text-slate-400 hover:text-white cursor-pointer" title="Copy">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              {tResult}
            </div>
          )}
        </div>
      )}

      {/* Weather */}
      {tool === 'weather' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={wCity}
              onChange={(e) => setWC(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doWeather()}
              placeholder="Enter a city…"
              className="flex-1 h-10 px-3 rounded-xl text-xs bg-slate-900/60 border border-slate-800 focus:border-sky-400 focus:outline-none text-slate-100 placeholder:text-slate-500"
            />
            <button
              onClick={doWeather}
              disabled={wLoading || !wCity.trim()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold text-xs disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
            >
              {wLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudSun className="w-4 h-4" />}
              Go
            </button>
          </div>
          {wData?.error && <p className="text-xs text-rose-400">{wData.error}</p>}
          {wData && !wData.error && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-sky-900/40 to-blue-900/20 border border-sky-500/30">
              <div className="text-xs text-slate-400">{wData.place}</div>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">{Math.round(wData.temp)}°</span>
                <span className="text-sm text-sky-300 mb-1">{wData.desc}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-[10px] text-slate-300">
                <div><span className="text-slate-500">Feels</span> {Math.round(wData.feels)}°</div>
                <div><span className="text-slate-500">Wind</span> {Math.round(wData.wind)} km/h</div>
                <div><span className="text-slate-500">Humidity</span> {wData.humidity}%</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dictionary */}
      {tool === 'dictionary' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={dWord}
              onChange={(e) => setDWord(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doDictionary()}
              placeholder="Look up a word…"
              className="flex-1 h-10 px-3 rounded-xl text-xs bg-slate-900/60 border border-slate-800 focus:border-emerald-400 focus:outline-none text-slate-100 placeholder:text-slate-500"
            />
            <button
              onClick={doDictionary}
              disabled={dLoading || !dWord.trim()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
            >
              {dLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              Define
            </button>
          </div>
          {dData?.error && <p className="text-xs text-rose-400">{dData.error}</p>}
          {dData && !dData.error && (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{dData.word}</span>
                {dData.phonetic && <span className="text-xs text-slate-400">{dData.phonetic}</span>}
                <button onClick={() => speak(dData.word)} className="p-1 text-slate-400 hover:text-white cursor-pointer" title="Pronounce">
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {(dData.definitions || []).slice(0, 4).map((d: any, i: number) => (
                <div key={i} className="text-xs text-slate-300">
                  <span className="text-emerald-400 font-semibold italic">{d.partOfSpeech}</span>
                  <p className="leading-relaxed">{d.definition}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

