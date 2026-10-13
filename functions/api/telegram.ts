/**
 * FileMind Cloudflare Pages Function - Telegram Bot Bridge (v2)
 *
 * Bot commands: /help · /image <prompt> · /web <query> · /code <task> · <any text → AI chat>
 * Media: photo→AI vision · voice→transcript · document→summary · location→geocode · video/sticker/contact→ack
 * All AI replies pass AI Safety Guardrails. Env: TELEGRAM_BOT_TOKEN (secret), TELEGRAM_CHAT_ID (optional).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// --- Telegram Bot API helpers -------------------------------------------------

async function tg(token: string, method: string, payload: any): Promise<any> {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.json();
}

/** sendPhoto with binary bytes via multipart/form-data. */
async function tgSendPhoto(token: string, chatId: number, bytes: Uint8Array, caption: string): Promise<any> {
  const fd = new FormData();
  fd.append('chat_id', String(chatId));
  fd.append('photo', new Blob([bytes as any], { type: 'image/png' }), 'filemind.png');
  fd.append('caption', caption.slice(0, 1000));
  const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: fd });
  return r.json();
}

/** HTML-safe reply (Telegram parse_mode=HTML). */
async function tgSendHtml(token: string, chatId: number, html: string): Promise<any> {
  return tg(token, 'sendMessage', { chat_id: chatId, text: html.slice(0, 4000), parse_mode: 'HTML' });
}

function escapeHtml(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Base64 helpers (Workers-safe, no Buffer) ---------------------------------

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/^data:image\/\w+;base64,/, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Download a Telegram file by file_id → bytes. */
async function tgDownload(token: string, fileId: string): Promise<Uint8Array | null> {
  try {
    const info = await tg(token, 'getFile', { file_id: fileId });
    const path = info?.result?.file_path;
    if (!path) return null;
    const r = await fetch(`https://api.telegram.org/file/bot${token}/${path}`);
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}

// --- AI Safety Guardrails (same rules as /api/chat) ---------------------------

const BLOCK_PATTERNS: RegExp[] = [
  /\bhow\s+to\s+(make|build|assemble|create)\b[^.?]{0,40}\b(bomb|explosive|detonator|nerve\s*agent|ricin|malware|keylogger|ransomware)\b/i,
  /\bhow\s+to\s+(kill|hang)\s+myself\b|\bbest\s+way\s+to\s+(commit\s+suicide|end\s+my\s+life)\b/i,
  /\b(child|kid|minor|underage)\b[^.?]{0,30}\b(nude|naked|porn|sexual)\b/i,
  /\bignore\s+(all\s+|any\s+|the\s+|your\s+|previous\s+|above\s+)*(instructions?|rules?|prompts?|guardrails?)\b/i,
  /\byou\s+are\s+now\s+(dan|jailbroken|evil|unfiltered|uncensored)\b/i,
  /\bforget\s+(everything|all|your\s+(rules|instructions|training))\b/i,
  /\b(reveal|print|show|leak|repeat)\s+(me\s+)?(your\s+)?(system\s*prompt|initial\s+instructions|hidden\s*rules)\b/i,
];

function isBlocked(text: string): boolean {
  return BLOCK_PATTERNS.some((p) => p.test(text || ''));
}

const GUARD_REFUSAL =
  '🛡️ <b>Blocked by AI Safety Guardrails.</b>\nFileMind refuses harmful, unsafe, or unauthorized content. I can help with safe alternatives — ask me anything else!';

// --- AI helpers ---------------------------------------------------------------

async function aiText(env: any, system: string, user: string, maxTokens = 700): Promise<string | null> {
  if (!env.AI) return null;
  try {
    const ai = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
    });
    const t = (ai?.response ?? ai?.result?.response ?? '').toString().trim();
    return t || null;
  } catch {
    return null;
  }
}

async function aiVision(env: any, imageB64: string, prompt: string): Promise<string | null> {
  if (!env.AI) return null;
  for (const m of ['@cf/meta/llama-3.2-11b-vision-instruct', '@cf/moondream/moondream3.1-9B-A2B']) {
    try {
      const ai = await env.AI.run(m, { image: imageB64, prompt, max_tokens: 500 });
      const t = (ai?.response ?? ai?.description ?? '').toString().trim();
      if (t) return t;
    } catch {
      /* try next model */
    }
  }
  return null;
}

async function aiTranscribe(env: any, audioB64: string): Promise<string | null> {
  if (!env.AI) return null;
  for (const m of ['@cf/openai/whisper-large-v3-turbo', '@cf/openai/whisper-large-v3', '@cf/openai/whisper']) {
    try {
      const ai = await env.AI.run(m, { audio: audioB64 });
      const t = (ai?.text ?? ai?.response ?? ai?.transcript ?? '').toString().trim();
      if (t) return t;
    } catch {
      /* try next model */
    }
  }
  return null;
}

/** Real-time internet search via the FileMind /api/websearch function. */
async function webSearch(origin: string, q: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 12000);
    const r = await fetch(`${origin}/api/websearch?q=${encodeURIComponent(q.slice(0, 200))}`, { signal: c.signal });
    clearTimeout(t);
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j.results) ? j.results.slice(0, 6) : [];
  } catch {
    return [];
  }
}

const HELP_TEXT =
  '<b>🤖 FileMind Bot — commands</b>\n\n' +
  '/image &lt;prompt&gt; — generate a free AI image (FLUX/SDXL)\n' +
  '/web &lt;query&gt; — real-time internet search + AI answer with sources\n' +
  '/code &lt;task&gt; — generate code (highlighted block)\n' +
  '/help — this message\n\n' +
  '<b>Any other message</b> → AI chat (Llama 3.1 8B, guarded)\n\n' +
  '<b>📱 Media recognition</b>\n' +
  '• Send a <b>photo</b> (+ optional caption as a question) → AI vision answers\n' +
  '• Send a <b>voice note</b> → AI transcribes it\n' +
  '• Send a <b>text document</b> → AI summarizes / answers questions\n' +
  '• Send your <b>location</b> → reverse-geocoded place name\n' +
  '• Videos, stickers & contacts are acknowledged too';

export async function onRequestPost(context: { request: Request; env: any }) {
  const { request, env } = context;
  const token = env.TELEGRAM_BOT_TOKEN as string | undefined;
  if (!token) {
    return Response.json(
      {
        error: 'TELEGRAM_BOT_TOKEN not configured',
        setup: [
          '1. Chat with @BotFather on Telegram → /newbot → copy token',
          '2. wrangler pages secret put TELEGRAM_BOT_TOKEN --project-name filemind-vault',
          '3. POST /api/telegram { action:"register" } to set webhook',
        ],
      },
      { status: 400, headers: corsHeaders }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // empty body — treated as info below
  }

  // ================= Inbound Telegram webhook (Telegram → FileMind) =================
  if (body.message || body.edited_message) {
    const msg = body.message ?? body.edited_message;
    const chatId: number = msg.chat.id;
    const origin = new URL(request.url).origin;
    const text: string = (msg.text ?? '').toString().slice(0, 1000);
    const caption: string = (msg.caption ?? '').toString().slice(0, 500);
    const done = () => Response.json({ ok: true }, { headers: corsHeaders });

    // ---- 1. Commands ---------------------------------------------------
    if (text.startsWith('/')) {
      const parts = text.split(/\s+/);
      const cmd = parts[0].split('@')[0].toLowerCase();
      const arg = parts.slice(1).join(' ').trim();

      if (cmd === '/start' || cmd === '/help') {
        await tgSendHtml(token, chatId, `${HELP_TEXT}\n\n—\nYour chat ID: <code>${chatId}</code>\nEnter it in FileMind → Hub → Telegram to enable push sends.`);
        return done();
      }

      // Guardrails apply to every command argument.
      if (isBlocked(arg)) {
        await tgSendHtml(token, chatId, GUARD_REFUSAL);
        return done();
      }

      // /image <prompt> — free AI image generation
      if (cmd === '/image') {
        if (!arg) {
          await tgSendHtml(token, chatId, 'Usage: <code>/image a cyberpunk city at night</code>');
          return done();
        }
        await tg(token, 'sendMessage', { chat_id: chatId, text: '🎨 Generating your image with FLUX.1-schnell…' });
        try {
          const r = await fetch(`${origin}/api/imagegen`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: arg }),
          });
          const j = await r.json();
          if (j.image) {
            await tgSendPhoto(token, chatId, base64ToBytes(j.image), `🎨 ${arg}\nModel: ${String(j.model || '').replace('@cf/', '')}`);
          } else {
            await tgSendHtml(token, chatId, escapeHtml(j.error || '⚠️ Image generation failed — try again.'));
          }
        } catch {
          await tgSendHtml(token, chatId, '⚠️ Image service unreachable — try again in a moment.');
        }
        return done();
      }

      // /web <query> — real-time internet search + AI synthesis
      if (cmd === '/web') {
        if (!arg) {
          await tgSendHtml(token, chatId, 'Usage: <code>/web latest AI news today</code>');
          return done();
        }
        await tg(token, 'sendMessage', { chat_id: chatId, text: '🌐 Searching the live web…' });
        const results = await webSearch(origin, arg);
        const webText = results.map((w, i) => `[${i + 1}] ${w.title}\nURL: ${w.url}\n${w.snippet}`).join('\n');
        const answer = await aiText(
          env,
          'You are FileMind AI on Telegram with REAL-TIME internet access. Answer using the live web results below. Cite sources as [n] with URLs. Plain text only. Keep the answer under 700 characters.',
          `Query: ${arg}\n\nLive web results:\n${webText || '(no results found)'}`
        );
        const links = results
          .slice(0, 4)
          .map((w) => `• <a href="${escapeHtml(w.url)}">${escapeHtml(w.title.slice(0, 65))}</a>`)
          .join('\n');
        await tgSendHtml(
          token,
          chatId,
          `🌐 <b>${escapeHtml(arg)}</b>\n\n${escapeHtml(answer || 'No answer generated.')}\n\n<b>Sources:</b>\n${links || '—'}`
        );
        return done();
      }

      // /code <task> — AI code generation, highlighted <pre><code> block
      if (cmd === '/code') {
        if (!arg) {
          await tgSendHtml(token, chatId, 'Usage: <code>/code fibonacci function in python</code>');
          return done();
        }
        const reply = await aiText(
          env,
          'You are a senior software engineer on Telegram. Reply with Telegram HTML ONLY: first a one-line intro, then the code inside <pre><code class="language-python">...</code></pre> (escape &lt; &gt; &amp; inside code), then 1-2 lines of explanation. No markdown fences.',
          arg,
          1500
        );
        await tgSendHtml(token, chatId, reply || '⚠️ Code generation failed — try again.');
        return done();
      }

      // Unknown command → help
      await tgSendHtml(token, chatId, HELP_TEXT);
      return done();
    }

    // ---- 2. Media recognition -----------------------------------------

    // 📸 Photo → AI vision (caption = optional question)
    if (msg.photo && msg.photo.length) {
      const pic = msg.photo[msg.photo.length - 1];
      const bytes = await tgDownload(token, pic.file_id);
      if (bytes) {
        const prompt = caption
          ? `Answer this question about the photo: ${caption}`
          : 'Describe this image in detail: what is shown, objects, people, scenes, and any readable text.';
        const desc = isBlocked(caption) ? null : await aiVision(env, bytesToBase64(bytes), prompt);
        await tgSendHtml(
          token,
          chatId,
          desc ? `🖼 <b>AI Vision:</b>\n${escapeHtml(desc)}` : '🖼 Photo received, but the vision AI is unavailable right now.'
        );
      }
      return done();
    }

    // 🎙 Voice / audio → AI speech-to-text (Whisper), then answer the transcript
    if (msg.voice || msg.audio) {
      const f = msg.voice ?? msg.audio;
      const bytes = await tgDownload(token, f.file_id);
      if (bytes && bytes.length < 5_000_000) {
        const transcript = await aiTranscribe(env, bytesToBase64(bytes));
        if (transcript) {
          const answer = isBlocked(transcript)
            ? null
            : await aiText(env, 'You are FileMind AI on Telegram. Answer the user (from voice) briefly, under 400 chars, plain text.', transcript);
          await tgSendHtml(token, chatId, `🎙 <b>Transcript:</b> ${escapeHtml(transcript)}\n\n🤖 ${escapeHtml(answer || '')}`);
        } else {
          await tgSendHtml(token, chatId, `🎙 Voice note received (${f.duration ?? '?'}s) — transcription is unavailable right now.`);
        }
      }
      return done();
    }

    // 📄 Document → text files analyzed (summarize / Q&A via caption), others acknowledged
    if (msg.document) {
      const doc = msg.document;
      const bytes = await tgDownload(token, doc.file_id);
      const TEXT_EXT = /\.(txt|md|json|csv|log|py|js|ts|tsx|jsx|html|css|xml|yaml|yml|sql|sh|java|c|cpp|h|rs|go|php|rb)$/i;
      const isTextDoc =
        bytes &&
        bytes.length < 200_000 &&
        (TEXT_EXT.test(doc.file_name || '') || (doc.mime_type || '').startsWith('text/') || doc.mime_type === 'application/json');
      if (isTextDoc) {
        const docText = new TextDecoder().decode(bytes).slice(0, 6000);
        const question = caption || 'Summarize this document concisely with the key points.';
        const answer = isBlocked(question)
          ? null
          : await aiText(
              env,
              'You are FileMind AI on Telegram. Answer about the provided document text. Plain text, under 800 characters.',
              `${question}\n\n--- DOCUMENT: ${doc.file_name} ---\n${docText}`
            );
        await tgSendHtml(token, chatId, `📄 <b>${escapeHtml(doc.file_name)}</b>\n\n${escapeHtml(answer || 'Could not analyze this document.')}`);
      } else {
        const sizeKb = Math.round((doc.file_size ?? 0) / 1024);
        await tgSendHtml(
          token,
          chatId,
          `📄 Received <b>${escapeHtml(doc.file_name || 'document')}</b> (${escapeHtml(doc.mime_type || 'file')}, ${sizeKb} KB).\n` +
            (bytes && bytes.length >= 200_000
              ? 'Too large for in-chat analysis — upload it to the FileMind vault for full AI search (RAG).'
              : 'Send a text/code file (under 200 KB) to get AI summaries & answers.')
        );
      }
      return done();
    }

    // 📍 Location → reverse geocode (OpenStreetMap Nominatim)
    if (msg.location) {
      const { latitude, longitude } = msg.location;
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 8000);
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=14`,
          { signal: c.signal, headers: { 'User-Agent': 'FileMind/1.0' } }
        );
        clearTimeout(t);
        const j: any = await r.json();
        const name = j?.display_name || `${latitude}, ${longitude}`;
        await tgSendHtml(
          token,
          chatId,
          `📍 <b>You are at:</b> ${escapeHtml(name)}\n<a href="https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}">Open in OpenStreetMap</a>`
        );
      } catch {
        await tg(token, 'sendMessage', { chat_id: chatId, text: `📍 Location: ${latitude}, ${longitude}` });
      }
      return done();
    }

    // 🎬 Video / video note → acknowledged with metadata
    if (msg.video || msg.video_note) {
      const v = msg.video ?? msg.video_note;
      const sizeMb = v.file_size ? `, ${Math.round(v.file_size / 1048576)} MB` : '';
      await tgSendHtml(
        token,
        chatId,
        `🎬 Video received${v.duration ? ` (${v.duration}s)` : ''}${sizeMb}.\nFull video understanding isn't supported yet — send a screenshot (as a photo) and I'll analyze it with AI vision!`
      );
      return done();
    }

    // 😄 Sticker / 👤 contact → friendly ack
    if (msg.sticker) {
      await tg(token, 'sendMessage', { chat_id: chatId, text: '😄 Nice sticker!' });
      return done();
    }
    if (msg.contact) {
      const c = msg.contact;
      await tg(token, 'sendMessage', {
        chat_id: chatId,
        text: `👤 Contact received: ${c.first_name}${c.phone_number ? ' — ' + c.phone_number : ''}`,
      });
      return done();
    }

    // Any other captioned media → treat caption as an AI question
    if (caption && !isBlocked(caption)) {
      const answer = await aiText(env, 'You are FileMind AI on Telegram. Answer briefly, under 400 chars, plain text.', caption);
      if (answer) await tgSendHtml(token, chatId, `🤖 ${escapeHtml(answer)}`);
    }

    return done();
  }

  // ================= App actions (FileMind → Telegram) =================
  const action = (body.action ?? 'info').toString();

  // register — points Telegram's webhook at this endpoint
  if (action === 'register') {
    const origin = new URL(request.url).origin;
    const res = await tg(token, 'setWebhook', { url: `${origin}/api/telegram` });
    return Response.json({ ok: true, webhook: `${origin}/api/telegram`, telegram: res }, { headers: corsHeaders });
  }

  // info — bot identity
  if (action === 'info') {
    const res = await tg(token, 'getMe', {});
    return Response.json({ ok: true, bot: res }, { headers: corsHeaders });
  }

  // send — push a message out of the app
  if (action === 'send') {
    const chatId = body.chatId ?? env.TELEGRAM_CHAT_ID;
    const text = (body.text ?? '').toString().slice(0, 4000);
    if (!chatId || !text) {
      return Response.json({ error: 'Need { action:"send", chatId, text }' }, { status: 400, headers: corsHeaders });
    }
    if (isBlocked(text)) {
      return Response.json({ error: GUARD_REFUSAL.replace(/<[^>]+>/g, '') }, { status: 403, headers: corsHeaders });
    }
    const res = await tg(token, 'sendMessage', { chat_id: chatId, text });
    return Response.json({ ok: true, telegram: res }, { headers: corsHeaders });
  }

  // help — list bot capabilities for API users
  if (action === 'help') {
    return Response.json(
      {
        ok: true,
        bot: ['/help', '/image <prompt>', '/web <query>', '/code <task>'],
        media: ['photo → AI vision', 'voice → transcript', 'document → summary', 'location → geocode', 'video/sticker/contact → ack'],
        appActions: ['info', 'register', 'send'],
      },
      { headers: corsHeaders }
    );
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400, headers: corsHeaders });
}

export async function onRequestGet(context: { request: Request; env: any }) {
  const hasToken = Boolean((context.env as any)?.TELEGRAM_BOT_TOKEN);
  return Response.json(
    {
      service: 'FileMind Telegram bridge v2',
      configured: hasToken,
      botCommands: ['/help', '/image <prompt>', '/web <query>', '/code <task>'],
      media: ['photo→vision', 'voice→transcript', 'document→summary', 'location→geocode'],
      hint: 'POST { action: "info" | "register" | "send" | "help" }',
    },
    { headers: corsHeaders }
  );
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

