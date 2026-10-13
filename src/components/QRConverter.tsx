import React, { useState } from 'react';
import { QrCode, Download, Loader2 } from 'lucide-react';

export const QRConverter: React.FC = () => {
  const [text, setText] = useState('');
  const [qr, setQr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const make = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim().slice(0, 2000) }),
      });
      const j = await r.json();
      if (j.qr) setQr(j.qr);
      else setError(j.error || 'QR failed');
    } catch {
      setError('QR service unreachable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <QrCode className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Anything → QR</h3>
          <p className="text-[11px] text-slate-400">Real QR codes via the qrcode module on the edge</p>
        </div>
      </div>
      <form onSubmit={make} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste link, text, wifi password…"
          className="flex-1 h-11 px-3 rounded-xl text-xs bg-slate-900/60 border border-slate-800 focus:border-emerald-400 focus:outline-none text-slate-100 placeholder:text-slate-500"
        />
        <button type="submit" disabled={loading || !text.trim()} className="px-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold disabled:opacity-40 cursor-pointer">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Make QR'}
        </button>
      </form>
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
      {qr && (
        <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white">
          <img src={qr} alt="QR code" className="w-48 h-48" />
          <a href={qr} download="filemind-qr.png" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Download PNG
          </a>
        </div>
      )}
    </div>
  );
};
