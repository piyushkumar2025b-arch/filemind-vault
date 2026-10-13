import React, { useState } from 'react';
import { Send, Info, Link2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export const TelegramPanel: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [chatId, setChatId] = useState('');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const call = async (payload: any) => {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/telegram', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      return j;
    } finally {
      setBusy(false);
    }
  };

  const checkInfo = async () => {
    const j = await call({ action: 'info' });
    setStatus(j);
    setMsg(j?.error ? `Not configured: ${j.error}` : `Connected as @${j?.bot?.result?.username ?? 'bot'}`);
  };

  const register = async () => {
    const j = await call({ action: 'register' });
    setMsg(j?.ok ? `Webhook set: ${j.webhook} — message your bot to test` : (j?.error || 'Failed'));
  };

  const send = async () => {
    if (!chatId.trim() || !text.trim()) return;
    const j = await call({ action: 'send', chatId: chatId.trim(), text: text.trim().slice(0, 4000) });
    setMsg(j?.ok ? 'Message sent!' : (j?.error || 'Failed'));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
          <Send className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Telegram Bot</h3>
          <p className="text-[11px] text-slate-400">Chat with FileMind from Telegram, push alerts out</p>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
        <span className="font-bold text-slate-200">Setup (one time):</span><br />
        1. Telegram → @BotFather → /newbot → copy token<br />
        2. <code className="text-cyan-300 select-all">wrangler pages secret put TELEGRAM_BOT_TOKEN --project-name filemind-vault</code><br />
        3. Redeploy, then hit <b>Connect webhook</b> below<br />
        4. Get your chat ID from @userinfobot, paste it to send
      </div>

      <div className="flex gap-2">
        <button onClick={checkInfo} disabled={busy} className="flex-1 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-200 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5">
          <Info className="w-3.5 h-3.5" /> Check bot
        </button>
        <button onClick={register} disabled={busy} className="flex-1 py-2 rounded-xl bg-sky-500/20 border border-sky-500/40 text-xs font-bold text-sky-300 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} Connect webhook
        </button>
      </div>

      {msg && (
        <p className={`text-[11px] flex items-center gap-1.5 ${msg.startsWith('Not') || msg.startsWith('Fail') ? 'text-amber-400' : 'text-emerald-400'}`}>
          {msg.startsWith('Not') || msg.startsWith('Fail') ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          {msg}
        </p>
      )}
      {status?.bot?.result && (
        <p className="text-[11px] text-slate-500">Bot: {status.bot.result.first_name} (@{status.bot.result.username})</p>
      )}

      <input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Chat ID (from @userinfobot)"
        className="w-full h-10 px-3 rounded-xl text-xs bg-slate-900/60 border border-slate-800 focus:border-sky-400 focus:outline-none text-slate-100 placeholder:text-slate-500" />
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 4000))} placeholder="Message to send…" rows={2}
        className="w-full p-3 rounded-xl text-xs bg-slate-900/60 border border-slate-800 focus:border-sky-400 focus:outline-none text-slate-100 placeholder:text-slate-500" />
      <button onClick={send} disabled={busy || !chatId.trim() || !text.trim()} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold text-xs disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2">
        <Send className="w-4 h-4" /> Send via bot
      </button>
    </div>
  );
};
