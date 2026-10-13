# FileMind — Personal File Vault & AI Companion

Futuristic mobile-first file vault with document preview, full-text search,
offline PWA caching, and Cloudflare Workers AI document chat (RAG).

**Live:** https://filemind-vault.pages.dev
**Verified deploy:** https://3d96eb1c.filemind-vault.pages.dev
**API:** `GET /api/health` · `POST /api/chat`

> Original AI Studio app: https://ai.studio/apps/11b4e9c9-3b5f-479e-b1f9-8afe860eb5e3

---

## 1. Features

- Personal file vault (PDF, DOCX, Markdown, code, images, video, audio, text)
- Client-side full-text search with scored chunk retrieval + citations
- AI chat grounded in your documents (RAG), with offline local fallback
- PWA — installable, offline-capable, auto-updating service worker
- Dark / light themes, mobile-first UI
- Zero-cost Cloudflare stack: Pages + Pages Functions + Workers AI + D1

## 2. Architecture

- Browser (React 19 + Vite + Tailwind + IndexedDB)
- `POST /api/chat { prompt, model, contextChunks }` →
  Cloudflare Pages Functions (`functions/api/*.ts`) →
  `env.AI.run(model, …)` (Workers AI binding `AI`)
- Bindings: AI yes · D1 `filemind-d1` yes · R2 no (not enabled, removed)
- Frontend fallback chain: same-origin `/api/chat` → custom
  `workerEndpoint` → local offline RAG engine

Deploy model is Cloudflare **Pages** (`functions/` + `dist/`).
`server/worker.ts` is a standalone-Worker mirror — deploy **either**
Pages Functions **or** that Worker, never both at once.

## 3. Run locally

Prerequisites: Node.js 20+

```bash
npm install
npm run dev
```

Legacy AI Studio env (optional, see `.env.example`):

```bash
GEMINI_API_KEY="MY_GEMINI_API_KEY"
APP_URL="MY_APP_URL"
```

## 4. Scripts

- `npm run dev` — Vite dev server (port 3000)
- `npm run build` — `tsc --noEmit && vite build` → `dist/`
- `npm run preview` — preview production build
- `npm run lint` — type-check
- `npm run deploy` — build + Pages deploy of `filemind-vault`
- `npm run deploy:worker` — standalone worker deploy (alternative path)
- `npm run cf:dev` — local Pages + Functions emulation
- `npm run cf:typegen` — generate Worker types

## 5. Deploy to Cloudflare Pages

```bash
npx wrangler login
npm run build
npx wrangler pages deploy dist --project-name filemind-vault --commit-dirty=true --skip-caching
```

Verify:

```bash
curl https://filemind-vault.pages.dev/api/health
curl -X POST https://filemind-vault.pages.dev/api/chat -H "Content-Type: application/json" -d "{\"prompt\":\"Say hello in one sentence\",\"contextChunks\":[]}"
```

Expected chat reply:

```json
{"response":"Hello, I'm FileMind AI, …","model":"@cf/meta/llama-3.1-8b-instruct-fp8"}
```

`wrangler.json` bindings (already configured):

```jsonc
{
  "name": "filemind-vault",
  "compatibility_date": "2026-04-01",
  "compatibility_flags": ["nodejs_compat"],
  "pages_build_output_dir": "./dist",
  "ai": { "binding": "AI" },
  "d1_databases": [
    { "binding": "DB", "database_name": "filemind-d1",
      "database_id": "7df5ae96-e1a7-4658-9aaa-91a2cca56e4e" }
  ]
}
```

Notes:

- Do NOT add `"main": "server/worker.ts"` on the Pages path — that key
  switches Wrangler to Worker-deploy mode and breaks Pages deploys.
- R2 (`filemind-vault-files`) was removed: R2 is not enabled on this
  account (API error 10042). To use R2 later: Dashboard → R2 → Enable,
  `wrangler r2 bucket create filemind-vault-files`, re-add the
  `r2_buckets` binding, redeploy.

## 6. Workers AI models (verified live 2026-10-13)

Default: `@cf/meta/llama-3.1-8b-instruct-fp8`

Allowlist in `functions/api/chat.ts`:

- `@cf/meta/llama-3.1-8b-instruct-fp8` (recommended default)
- `@cf/meta/llama-3.2-3b-instruct` (fast)
- `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- `@cf/openai/gpt-oss-20b`
- `@cf/qwen/qwen3-30b-a3b-fp8`
- `@cf/google/gemma-4-26b-a4b-it`
- `@cf/mistralai/mistral-small-3.1-24b-instruct`
- `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`
- `@cf/zai-org/glm-4.7-flash`
- `@cf/moonshotai/kimi-k2.6`

Unknown `model` values fall back to the default. Missing/empty
`prompt` → 400. `GET /api/chat` → 405.

## 7. Bugs fixed (Workers deploy stabilization)

1. `functions/api/chat.ts` — added JSON guard (400), required-prompt
   check (400), model allowlist + safe default, 12-chunk / 12000-char /
   4000-char caps, `extractText()` for every Workers AI response shape,
   204 OPTIONS, 405 GET, tightened CORS.
2. `functions/api/health.ts` — added missing OPTIONS handler + full CORS.
3. `server/worker.ts` — mirrored all chat fixes, added `ASSETS`
   static fallback, 405 for non-POST `/api/chat`, 204 OPTIONS.
4. `vite.config.ts` — `__dirname` crashed under ESM; fixed with
   `node:path` + `fileURLToPath(import.meta.url)`. Build was broken before.
5. `wrangler.json` — added `$schema`, added then removed the R2 binding
   (R2 not enabled → deploy error `R2 bucket not found` / API 10042).
   D1 binding verified intact.
6. `src/services/aiCompanion.ts` — frontend only called a user-configured
   `workerEndpoint` (always empty → edge AI never reached). Now tries
   same-origin `/api/chat` first (zero-config on Pages), then custom
   endpoint, 60s abort timeout, skips empty responses, falls back to the
   offline local RAG engine. Model list/defaults updated to live IDs.
7. `src/components/CloudflareDeployModal.tsx` — in-app guide shipped
   `"main": "server/worker.ts"` in the Pages snippet (breaks Pages
   deploys); corrected with a do-not-add warning.
8. `package.json` — `build` type-checks first; added `deploy`,
   `deploy:worker`, `cf:dev`, `cf:typegen`; pinned `wrangler@^4.149.0`.
9. Deprecated model (live incident) — `@cf/meta/llama-3.1-8b-instruct`
   returned `5028 deprecated on 2026-05-30`. Default is now the live
   `@cf/meta/llama-3.1-8b-instruct-fp8`; fixed stale `@cf/deepseek/…`
   prefix → `@cf/deepseek-ai/…`. Verified live 200 + real AI text.

## 8. Deploy history (this session)

- `abd78ac0` and earlier — pre-fix builds
- `77726d39` — Failure (missing R2 bucket binding)
- `780fe3cc` — deployed, but `/api/chat` → 5028 deprecated model
- `3d96eb1c` — live + verified (health ok, chat returns real AI text)

## 9. Project layout

- `dist/` — production build (Pages output dir)
- `functions/api/chat.ts` — `POST /api/chat` (Workers AI RAG)
- `functions/api/health.ts` — `GET /api/health`
- `server/worker.ts` — standalone Worker mirror (alternative path)
- `src/services/aiCompanion.ts` — RAG retrieval + edge caller + fallback
- `src/components/CloudflareDeployModal.tsx` — in-app deploy spec
- `wrangler.json` — Pages + AI + D1 bindings

