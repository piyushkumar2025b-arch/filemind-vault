import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Copy,
  Check,
  CloudLightning,
  Terminal,
  FileCode,
  Download,
  ExternalLink,
} from 'lucide-react';

interface CloudflareDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudflareDeployModal: React.FC<CloudflareDeployModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'wrangler' | 'worker' | 'schema'>('overview');
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const wranglerConfig = `// wrangler.json — Cloudflare Pages + Functions config (DO NOT add "main" — that breaks Pages deploy)
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "filemind-vault",
  "compatibility_date": "2026-04-01",
  "compatibility_flags": ["nodejs_compat"],
  "pages_build_output_dir": "./dist",

  // Cloudflare Workers AI Binding (Zero external API keys required)
  "ai": {
    "binding": "AI"
  },

  // Cloudflare R2 Private Bucket Binding for Files
  "r2_buckets": [
    {
      "binding": "VAULT_BUCKET",
      "bucket_name": "filemind-vault-files"
    }
  ],

  // Cloudflare D1 Serverless SQL Database for Metadata & Chunks
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "filemind-d1",
      "database_id": "YOUR_D1_DATABASE_ID"
    }
  ]
}`;

  const workerCode = `// server/worker.ts — Cloudflare Worker API & AI RAG Service
export interface Env {
  AI: any;
  VAULT_BUCKET: R2Bucket;
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. AI Document Chat via Workers AI
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      const { prompt, model, contextChunks } = await request.json();

      const contextText = contextChunks
        ?.map((c: any) => \`[\${c.fileName}]: \${c.text}\`)
        .join('\\n\\n') || '';

      const systemPrompt = "You are FileMind AI, a private personal assistant. Answer accurately using only the user's provided document context:";

      const aiResponse = await env.AI.run(model || '@cf/zai-org/glm-4.7-flash', {
        messages: [
          { role: 'system', content: \`\${systemPrompt}\\n\\n\${contextText}\` },
          { role: 'user', content: prompt }
        ]
      });

      return Response.json({ response: aiResponse.response });
    }

    // 2. R2 Private File Upload
    if (url.pathname.startsWith('/api/files/') && request.method === 'PUT') {
      const fileKey = url.pathname.replace('/api/files/', '');
      await env.VAULT_BUCKET.put(fileKey, request.body);
      return Response.json({ status: 'uploaded', key: fileKey });
    }

    // 3. R2 File Retrieval
    if (url.pathname.startsWith('/api/files/') && request.method === 'GET') {
      const fileKey = url.pathname.replace('/api/files/', '');
      const object = await env.VAULT_BUCKET.get(fileKey);
      if (!object) return new Response('Not Found', { status: 404 });
      return new Response(object.body, {
        headers: { 'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream' }
      });
    }

    return new Response('FileMind Cloudflare Worker Online', { status: 200 });
  }
};`;

  const d1Schema = `-- schema.sql — Cloudflare D1 Database Schema
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  category TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  extension TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  is_starred INTEGER DEFAULT 0,
  r2_key TEXT,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS file_chunks (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  page INTEGER,
  line INTEGER,
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON file_chunks(file_id);
`;

  const getCodeForTab = () => {
    if (activeTab === 'wrangler') return wranglerConfig;
    if (activeTab === 'worker') return workerCode;
    return d1Schema;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCodeForTab());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-[#090d16] border border-cyan-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <CloudLightning className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-none">Cloudflare Edge Architecture</h2>
              <p className="text-xs text-slate-400 mt-1">Zero-Trust Personal File Vault</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-800 bg-slate-950/40 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 border-b-2 font-semibold transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Deploy Checklist
          </button>
          <button
            onClick={() => setActiveTab('wrangler')}
            className={`px-3 py-2 border-b-2 font-semibold transition-colors cursor-pointer ${
              activeTab === 'wrangler'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            wrangler.jsonc
          </button>
          <button
            onClick={() => setActiveTab('worker')}
            className={`px-3 py-2 border-b-2 font-semibold transition-colors cursor-pointer ${
              activeTab === 'worker'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            worker.ts
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-2 border-b-2 font-semibold transition-colors cursor-pointer ${
              activeTab === 'schema'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            schema.sql
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === 'overview' ? (
            <div className="space-y-4">
              {/* Visual Showcase Card matching screenshot */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-[#0f172a] to-[#090d16] border border-cyan-500/30 flex flex-col items-center text-center">
                {/* Cloud Icon */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-400 to-fuchsia-500 p-[2px] mb-3">
                  <div className="w-full h-full bg-[#090d16] rounded-[14px] flex items-center justify-center">
                    <CloudLightning className="w-8 h-8 text-cyan-300" />
                  </div>
                </div>

                <h3 className="text-xl font-extrabold text-white tracking-tight mb-4">
                  Cloudflare Deploy Ready
                </h3>

                {/* Features List (Matches Screenshot) */}
                <div className="w-full max-w-sm space-y-2.5 text-left text-xs mb-6">
                  <div className="flex items-center gap-2.5 text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Uses Cloudflare Pages (static hosting)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Cloudflare Workers (AI chat + API)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Cloudflare R2 (file storage)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Cloudflare D1 (database - optional)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>PWA (offline + installable)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Free tier friendly</span>
                  </div>
                </div>

                {/* Quick Deploy Terminal Command */}
                <div className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-left mb-4">
                  <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">One-Command Deploy:</div>
                  <code className="text-xs font-mono text-cyan-300 select-all block">
                    npx wrangler pages deploy dist --project-name filemind
                  </code>
                </div>

                <a
                  href="https://dash.cloudflare.com"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 rounded-xl neon-btn-gradient text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-95 transition-all"
                >
                  <CloudLightning className="w-4 h-4" />
                  <span>Deploy to Cloudflare</span>
                </a>

                <p className="text-[11px] text-slate-400 mt-2">
                  Simple. Fast. Global.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">
                  {activeTab === 'wrangler' ? 'wrangler.jsonc' : activeTab === 'worker' ? 'server/worker.ts' : 'schema.sql'}
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 text-xs font-mono text-cyan-300/90 overflow-x-auto leading-relaxed border border-slate-800 max-h-[50vh]">
                {getCodeForTab()}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
