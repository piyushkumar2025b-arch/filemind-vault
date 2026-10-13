# FileMind — Complete Cloudflare Details

Generated: 2026-10-13. Everything about this project's Cloudflare setup,
live resources, bindings, endpoints, models, deploy history, and the exact
config/code that produced the verified deploy `3d96eb1c`.

---

## 1. Account & Auth

- Login email: `piyush.kumar2025b@vitstudent.ac.in`
- Account name: `Piyush.kumar2025b@vitstudent.ac.in's Account`
- Account ID: `a61fe324eb4f21fd2caa4f7d8d3e8c03`
- Auth: OAuth token via `wrangler login`
- Credentials file: `C:\Users\Piyush Kumar\AppData\Roaming\xdg.config\.wrangler\config\default.toml`
- Token scopes granted: user(read), offline_access, account(read),
  workers(write), workers_kv(write), workers_routes(write),
  workers_scripts(write), workers_tail(read), d1(write), pages(write),
  zone(read), ssl_certs(write), ai(write), queues(write), pipelines(write)
- Wrangler version pinned: `^4.149.0` (devDependency)
- Dashboard: https://dash.cloudflare.com/a61fe324eb4f21fd2caa4f7d8d3e8c03

## 2. Pages Project

- Project name: `filemind-vault`
- Production URL: https://filemind-vault.pages.dev
- Verified deploy URL: https://3d96eb1c.filemind-vault.pages.dev
- Dashboard: https://dash.cloudflare.com/a61fe324eb4f21fd2caa4f7d8d3e8c03/pages/view/filemind-vault
- Git provider: none (direct `wrangler pages deploy` uploads)
- Build output dir: `./dist`
- Deploy command used:
  `wrangler pages deploy dist --project-name filemind-vault --commit-dirty=true --skip-caching`
- Other projects on this account: `opentranscript-ai`, `become-strong`

## 3. Deploy History (this session)

- `abd78ac0` and earlier — pre-fix builds (had `__dirname` ESM crash,
  missing validation, stale model IDs, Pages-vs-Worker config conflict)
- `77726d39` — FAILURE. Reason: `R2 bucket 'filemind-vault-files' not
  found`. R2 is not enabled on this account (API error 10042). Fix: R2
  binding removed from `wrangler.json` (no code path used it).
- `780fe3cc` — deployed, but `POST /api/chat` returned
  `5028: @cf/meta/infire-llama-3.1-8b-instruct was deprecated on
  2026-05-30`. Fix: default model switched to the live
  `@cf/meta/llama-3.1-8b-instruct-fp8` + allowlist rebuilt from
  `wrangler ai models` (70 models).
- `3d96eb1c` — LIVE + VERIFIED (2026-10-13):
  `GET /api/health` → `{"status":"ok",…}`;
  `POST /api/chat {"prompt":"Say hello in one sentence"}` → status 200
  `{"response":"Hello, I'm FileMind AI, …","model":"@cf/meta/llama-3.1-8b-instruct-fp8"}`

## 4. wrangler.json (current, deployed)

```json
{
  "name": "filemind-vault",
  "compatibility_date": "2026-04-01",
  "compatibility_flags": ["nodejs_compat"],
  "pages_build_output_dir": "./dist",
  "ai": { "binding": "AI" },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "filemind-d1",
      "database_id": "7df5ae96-e1a7-4658-9aaa-91a2cca56e4e"
    }
  ],
  "$schema": "node_modules/wrangler/config-schema.json"
}
```

Rules learned the hard way:

- Do NOT add `"main": "server/worker.ts"` — that flips Wrangler into
  Worker-deploy mode and breaks Pages deploys.
- Do NOT re-add `r2_buckets` until R2 is enabled (Dashboard → R2 →
  Enable), the bucket `filemind-vault-files` exists
  (`wrangler r2 bucket create filemind-vault-files`), and code actually
  reads `env.VAULT_BUCKET`.

## 5. Bindings

- `AI` (Workers AI) — bound, working, powers `POST /api/chat`.
- `DB` (D1 `filemind-d1`, id `7df5ae96-e1a7-4658-9aaa-91a2cca56e4e`,
  created 2026-10-13, 0 tables, 8192 bytes) — bound, not yet queried by
  Functions code (RAG currently runs client-side + passes chunks in).
  Other D1s on account: `opentranscript-db`, `become_strong_db`,
  `piyush-portfolio-db`.
- `VAULT_BUCKET` (R2) — REMOVED. Bucket never created; R2 not enabled.
- `ASSETS` — only exists on the standalone-Worker path (`server/worker.ts`
  falls back to it when present).

## 6. API Endpoints (live)

### GET /api/health

Handler: `functions/api/health.ts` → `onRequestGet` (+ `onRequestOptions`).
Live check 2026-10-13:
`{"status":"ok","service":"FileMind Cloudflare Pages","timestamp":1791882390786}`

### POST /api/chat

Handler: `functions/api/chat.ts` → `onRequestPost`.
Request: `{ prompt: string (required, ≤4000 chars), model?: string,
contextChunks?: Array<{id,fileId,fileName,text,line?,page?}> (≤12 kept,
≤2000 chars each, ≤12000 total) }`.
Success: `{ response: string, model: string }`.
No-AI-bind fallback: `{ response: "[Local Edge Echo]: …", model, fallback: true }`.
Errors: invalid JSON → 400; missing prompt → 400; unknown model →
silently replaced by default; AI failure → 500 `{ error }`.
`GET /api/chat` → 405. `OPTIONS` → 204 with CORS.
CORS: `Access-Control-Allow-Origin: *`, methods `GET, POST, OPTIONS`,
headers `Content-Type, Authorization`.
System prompt: `You are FileMind AI, a private personal knowledge

## 7. Workers AI Models

Source of truth: `wrangler ai models` (70 models, 2026-10-13).
Default + recommended: `@cf/meta/llama-3.1-8b-instruct-fp8`.

Allowlist (`functions/api/chat.ts`, `server/worker.ts`,
`SUPPORTED_CLOUDFLARE_MODELS`):

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

Removed dead IDs (caused live 500s):

- `@cf/meta/llama-3.1-8b-instruct` → deprecated 2026-05-30, error
  5028; live replacement is the `-fp8` ID above.
- `@cf/deepseek/deepseek-r1-distill-qwen-32b` → wrong prefix;
  correct is `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`.

Other catalog text models (add if needed): `@cf/openai/gpt-oss-120b`,
`@cf/meta/llama-4-scout-17b-16e-instruct`,
`@cf/meta/llama-3.2-1b-instruct`, `@cf/qwen/qwen3.8-27b`,
`@cf/qwen/qwq-32b`, `@cf/moonshotai/kimi-k2.7-code`,
`@cf/nvidia/nemotron-3-120b-a12b`, `@cf/zai-org/glm-5.3-flash`,
`@cf/deepseek-ai/deepseek-v4-flash-0731`,
`@cf/aisingapore/gemma-sea-lion-v4-27b-it`.

assistant. Answer accurately based solely on the provided personal file
chunks. Cite sources when answering.`
Frontend call order (`src/services/aiCompanion.ts`): same-origin
`/api/chat` → custom `workerEndpoint` → offline local RAG engine.
Timeout 60 s (AbortController). Empty AI text → local engine answer.


## 8. Deployed Edge Code (essentials)

`functions/api/chat.ts`: validates JSON (400) + `prompt` (400),
allowlist-gates `model` (fallback to
`@cf/meta/llama-3.1-8b-instruct-fp8`), caps chunks (12), chars
(prompt 4000, chunk 2000, total 12000), builds
`Source [file]: text` context, calls `env.AI.run(model, { messages:
[system, user] })`, extracts text via `extractText()` (handles
`response`, `result.response`, `output_text`, `text`, OpenAI
`choices`, raw string), returns `{ response, model }`. No `env.AI`
→ `{ response: "[Local Edge Echo]…", model, fallback: true }`.
`OPTIONS → 204`, `GET → 405`. Full file is in the repo; this doc
mirrors its logic exactly.

`functions/api/health.ts`: `GET → { status: "ok", service:
"FileMind Cloudflare Pages", timestamp }`, `OPTIONS → 204`, CORS
`*, GET/OPTIONS, Content-Type/Authorization`.

`server/worker.ts` (standalone alternative, NOT the Pages path):
same allowlist/default/extractor/validation, `Env { AI?,
VAULT_BUCKET?, DB?, ASSETS? }`, `OPTIONS → 204`, non-POST
`/api/chat → 405`, `/api/health` JSON, `env.ASSETS.fetch` static
fallback, else `FileMind Worker Active` 200. Deploy only via
`wrangler deploy server/worker.ts` — never with Pages Functions.

Frontend `src/services/aiCompanion.ts`:
`SUPPORTED_CLOUDFLARE_MODELS` mirrors the allowlist;
`askCloudflareWorkersAI` → RAG chunks → tries `/api/chat`, then
`config.workerEndpoint`, 60 s abort each, skips empty text, then
offline `generateLocalRAGResponse`.

## 9. Local Files & Scripts

- `dev` (vite :3000), `build` (`tsc --noEmit && vite build`),
  `preview`, `lint`, `deploy` (build + pages deploy),
  `deploy:worker`, `cf:dev` (`wrangler pages dev dist`), `cf:typegen`.
- `vite.config.ts` ESM-safe `__dirname` via
  `fileURLToPath(import.meta.url)`; PWA generateSW, 7 precache entries.
- `dist/` = 8 uploaded files per deploy. `tsc` clean, `vite build`
  ok (~647 kB JS / ~194 kB gzip). `wrangler pages functions build`
  → `Compiled Worker successfully`.

## 10. Runbook

Redeploy from scratch:

```bash
npm install --legacy-peer-deps
npm run build
npx wrangler login
npx wrangler pages deploy dist --project-name filemind-vault --commit-dirty=true
curl https://filemind-vault.pages.dev/api/health
curl -X POST https://filemind-vault.pages.dev/api/chat -H "Content-Type: application/json" -d "{\"prompt\":\"ping\",\"contextChunks\":[]}"
```

Add a model: confirm exact ID via `wrangler ai models`, add to
`ALLOWED_MODELS` in `functions/api/chat.ts` + `server/worker.ts` +
`SUPPORTED_CLOUDFLARE_MODELS`, rebuild, redeploy, curl-test. On
`5028 deprecated`, pick the live suffixed variant from the catalog.

Enable R2 later: Dashboard → R2 → Enable →
`wrangler r2 bucket create filemind-vault-files` → re-add
`r2_buckets: [{ binding: "VAULT_BUCKET",
bucket_name: "filemind-vault-files" }]` → redeploy.

D1 next step: `filemind-d1` has 0 tables; schema draft
(`files`, `file_chunks`) lives in
`src/components/CloudflareDeployModal.tsx`. Apply with
`wrangler d1 execute filemind-d1 --file=schema.sql` when moving
RAG server-side.

Example:

```bash
curl -X POST https://filemind-vault.pages.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Summarize my notes","model":"@cf/meta/llama-3.1-8b-instruct-fp8","contextChunks":[{"id":"c1","fileId":"f1","fileName":"Project-Notes.md","text":"…"}]}'
```
