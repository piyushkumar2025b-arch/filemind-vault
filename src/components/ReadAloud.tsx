import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Square, Loader2, FileText, Sparkles } from 'lucide-react';
import { VaultFile } from '../types';

export const ReadAloud: React.FC<{ files: VaultFile[] }> = ({ files }) => {
  const [text, setText] = useState('');
  const [fileId, setFileId] = useState('custom');
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [useCloud, setUseCloud] = useState(true);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    return () => {
      try {
        speechSynthesis.cancel();
        audioRef.current?.pause();
      } catch { /* noop */ }
    };
  }, []);

  const pickFile = (id: string) => {
    setFileId(id);
    if (id !== 'custom') {
      const f = files.find((x) => x.id === id);
      if (f?.extractedText) setText(f.extractedText.slice(0, 2000));
    }
  };

  const stop = () => {
    try {
      speechSynthesis.cancel();
      audioRef.current?.pause();
    } catch { /* noop */ }
    setSpeaking(false);
  };

  const speak = async () => {
    if (!text.trim()) return;
    stop();
    setError('');
    const chunk = text.trim().slice(0, 2000);

    // 1. Cloud TTS via Workers AI (works everywhere, real voice file)
    if (useCloud) {
      setLoading(true);
      try {
        const r = await fetch('/api/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunk }),
        });
        const j = await r.json();
        if (j.audio && audioRef.current) {
          audioRef.current.src = `data:audio/mp3;base64,${j.audio}`;
          await audioRef.current.play();
          setSpeaking(true);
          audioRef.current.onended = () => setSpeaking(false);
          return;
        }
        throw new Error(j.error || 'No audio returned');
      } catch (err: any) {
        setError(`Cloud voice failed (${err.message}), falling back to device voice…`);
      } finally {
        setLoading(false);
      }
    }

    // 2. Device speechSynthesis fallback (free, offline, no keys)
    try {
      const u = new SpeechSynthesisUtterance(chunk);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      speechSynthesis.speak(u);
      setSpeaking(true);
    } catch {
      setError('Speech not supported on this device.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400">
          <Volume2 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Anything Reader</h3>
          <p className="text-[11px] text-slate-400">Upload anything → pick it → hear it read aloud</p>
        </div>
      </div>

      <select
        value={fileId}
        onChange={(e) => pickFile(e.target.value)}
        className="w-full h-10 px-3 rounded-xl text-xs bg-slate-900 border border-slate-800 text-cyan-300 font-semibold focus:outline-none cursor-pointer"
      >
        <option value="custom">Custom text…</option>
        {files.map((f) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 2000))}
        placeholder="Paste anything, or pick a vault file above…"
        rows={4}
        className="w-full p-3 rounded-xl text-xs bg-slate-900/60 border border-slate-800 focus:border-fuchsia-400 focus:outline-none text-slate-100 placeholder:text-slate-500"
      />
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>{text.length}/2000 chars</span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={useCloud} onChange={(e) => setUseCloud(e.target.checked)} className="accent-fuchsia-500" />
          <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Cloud voice first</span>
        </label>
      </div>

      {error && <p className="text-[11px] text-amber-400">{error}</p>}

      <div className="flex gap-2">
        {!speaking ? (
          <button
            onClick={speak}
            disabled={loading || !text.trim()}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-bold text-xs disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {loading ? 'Voicing…' : 'Read Aloud'}
          </button>
        ) : (
          <button onClick={stop} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-2">
            <Square className="w-4 h-4" /> Stop
          </button>
        )}
      </div>
      <audio ref={audioRef} className="hidden" />
    </div>
  );
};
