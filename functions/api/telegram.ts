/**
 * FileMind Cloudflare Pages Function - Telegram Bot Bridge
 * POST /api/telegram { action: 'send'|'webhook'|'info', chatId?, text?, ... }
 * Configure via env vars: TELEGRAM_BOT_TOKEN (secret), TELEGRAM_CHAT_ID (optional default).
 * Setup: create bot with @BotFather → set TELEGRAM_BOT_TOKEN as Pages secret →
 *   set webhook to https://<site>/api/telegram via action 'register'.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function tg(token: string, method: string, payload: any) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.json();
}

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
    // Telegram webhook posts always have JSON; empty = treat as info
  }

  // 1. Telegram inbound webhook (Telegram → us): answer vault questions in chat
  if (body.message || body.edited_message) {
    const msg = body.message ?? body.edited_message;
    const chatId = msg.chat.id;
    const text: string = (msg.text ?? '').toString().slice(0, 1000);
    if (text) {
      let reply = `FileMind received: "${text.slice(0, 120)}"`;
      try {
        if (env.AI) {
          const ai = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
            messages: [
              { role: 'system', content: 'You are FileMind AI on Telegram. Answer briefly (under 400 chars).' },
              { role: 'user', content: text },
            ],
          });
          reply = (ai?.response ?? reply).toString().slice(0, 1000);
        }
      } catch { /* keep default reply */ }
      // Always surface the chat id so the user can paste it into the
      // Hub Telegram panel (needed for action:"send").
      await tg(token, 'sendMessage', {
        chat_id: chatId,
        text: `${reply}\n\n—\nYour chat ID: ${chatId}\nEnter it in FileMind → Hub → Telegram to enable push sends.`,
      });
    }
    return Response.json({ ok: true }, { headers: corsHeaders });
  }

  const action = (body.action ?? 'info').toString();

  // 2. Register webhook (points Telegram at this endpoint)
  if (action === 'register') {
    const origin = new URL(request.url).origin;
    const res = await tg(token, 'setWebhook', { url: `${origin}/api/telegram` });
    return Response.json({ ok: true, webhook: `${origin}/api/telegram`, telegram: res }, { headers: corsHeaders });
  }

  // 3. Bot info
  if (action === 'info') {
    const res = await tg(token, 'getMe', {});
    return Response.json({ ok: true, bot: res }, { headers: corsHeaders });
  }

  // 4. Send message (used by the app: share summaries / alerts to Telegram)
  if (action === 'send') {
    const chatId = body.chatId ?? env.TELEGRAM_CHAT_ID;
    const text = (body.text ?? '').toString().slice(0, 4000);
    if (!chatId || !text) {
      return Response.json({ error: 'Need { action:"send", chatId, text }' }, { status: 400, headers: corsHeaders });
    }
    const res = await tg(token, 'sendMessage', { chat_id: chatId, text });
    return Response.json({ ok: true, telegram: res }, { headers: corsHeaders });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400, headers: corsHeaders });
}

export async function onRequestGet(context: { request: Request; env: any }) {
  // Telegram calls setWebhook verification via GET? No — but expose status.
  const hasToken = Boolean((context.env as any)?.TELEGRAM_BOT_TOKEN);
  return Response.json(
    { service: 'FileMind Telegram bridge', configured: hasToken, hint: 'POST { action: "info" | "register" | "send" }' },
    { headers: corsHeaders }
  );
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
