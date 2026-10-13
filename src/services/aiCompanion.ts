import { VaultFile, ChatMessage, ChatCitation, CloudflareConfig, FileChunk } from '../types';

export const SUPPORTED_CLOUDFLARE_MODELS = [
  { id: '@cf/meta/llama-3.1-8b-instruct-fp8', name: 'Llama 3.1 8B Instruct (Recommended)' },
  { id: '@cf/meta/llama-3.2-3b-instruct', name: 'Llama 3.2 3B Instruct (Fast)' },
  { id: '@cf/openai/gpt-oss-20b', name: 'GPT OSS 20B' },
  { id: '@cf/qwen/qwen3-30b-a3b-fp8', name: 'Qwen3 30B' },
  { id: '@cf/zai-org/glm-4.7-flash', name: 'GLM 4.7 Flash' },
  { id: '@cf/google/gemma-4-26b-a4b-it', name: 'Gemma 4 26B IT' },
  { id: '@cf/moonshotai/kimi-k2.6', name: 'Kimi K2.6' },
  { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Distill Qwen 32B' },
];

export interface RAGContext {
  chunks: FileChunk[];
  citations: ChatCitation[];
}

export function retrieveRelevantChunks(
  query: string,
  files: VaultFile[],
  targetFileId?: string,
  maxChunks: number = 4
): RAGContext {
  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

  let eligibleFiles = targetFileId
    ? files.filter((f) => f.id === targetFileId)
    : files;
  // Target-file chat must always have context: fall back to whole vault
  // if the target file has no indexed text (e.g. image without OCR).
  if (eligibleFiles.length === 0) eligibleFiles = files;

  interface ScoredChunk {
    chunk: FileChunk;
    score: number;
  }

  const scored: ScoredChunk[] = [];
  // Greeting / acknowledgement queries carry no keywords — still ground
  // them in the target file instead of returning zero chunks.
  const isGreeting =
    queryWords.length === 0 ||
    /^(hi+|hie+|hello+|hey+|yo|thanks?|thank you|ok|okay|yes|no|please|explain|summariz(e|e this|ation)|tell me|describe)\b/.test(
      queryLower
    );

  for (const file of eligibleFiles) {
    if (!file.chunks || file.chunks.length === 0) {
      if (file.extractedText) {
        // Fallback: create virtual chunk
        const textSample = file.extractedText.slice(0, 400);
        scored.push({
          chunk: {
            id: file.id + '-v1',
            fileId: file.id,
            fileName: file.name,
            text: textSample,
            line: 1,
          },
          score:
            isGreeting || queryWords.some((w) => textSample.toLowerCase().includes(w))
              ? 5
              : targetFileId && file.id === targetFileId
                ? 2
                : 1,
        });
      }
      continue;
    }

    for (const chunk of file.chunks) {
      const textLower = chunk.text.toLowerCase();
      let score = 0;

      // Exact phrase match bonus
      if (queryLower && textLower.includes(queryLower)) {
        score += 20;
      }

      // Keyword match frequency
      for (const word of queryWords) {
        if (textLower.includes(word)) {
          score += 4;
        }
      }

      // File name match bonus
      if (queryLower && file.name.toLowerCase().includes(queryLower)) {
        score += 6;
      }

      // Target-file grounding: when chatting about one file, its chunks
      // are always relevant even for vague queries ("explain", "hie").
      if (targetFileId && file.id === targetFileId) {
        score += isGreeting ? 10 : 3;
      } else if (isGreeting && score === 0) {
        score += 1;
      }

      if (score > 0) {
        scored.push({ chunk, score });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, maxChunks).map((s) => s.chunk);

  const citations: ChatCitation[] = selected.map((c) => ({
    fileId: c.fileId,
    fileName: c.fileName,
    snippet: c.text.slice(0, 160) + (c.text.length > 160 ? '...' : ''),
    pageOrLine: c.page ? `Page ${c.page}` : c.line ? `Line ${c.line}` : undefined,
  }));

  return { chunks: selected, citations };
}

// Client-side intelligent RAG reasoning engine for instant offline / local file answering
export function generateLocalRAGResponse(
  query: string,
  rag: RAGContext,
  targetFile?: VaultFile | null
): string {
  const queryLower = query.toLowerCase();

  if (rag.chunks.length === 0) {
    if (targetFile) {
      return `I reviewed **${targetFile.name}**, but could not find specific content matching your question "${query}". You can ask me to summarize this document, explain its technical details, or search for other keywords.`;
    }
    return `I searched across your vault files, but could not find specific references matching "${query}".\n\nTry asking about:\n- **Project notes and architecture** (*Project-Notes.md*)\n- **Python functions and code logic** (*app.py*)\n- **Vector search research findings** (*Research-Paper.pdf*)\n- **Technical background and experience** (*Resume.docx*)`;
  }

  // 1. Summarization requests
  if (queryLower.includes('summar') || queryLower.includes('overview') || queryLower.includes('what is this') || queryLower.includes('explain')) {
    const primaryFile = rag.chunks[0].fileName;
    const bulletPoints = rag.chunks
      .map((c, i) => `• **${c.fileName}${c.page ? ` (Page ${c.page})` : c.line ? ` (Line ${c.line})` : ''}**: ${c.text}`)
      .join('\n\n');

    return `Here is a summary based on your stored documents:\n\n${bulletPoints}\n\n*Source: Retrieved from ${primaryFile} using local RAG index.*`;
  }

  // 2. Code explanation requests
  if (queryLower.includes('code') || queryLower.includes('function') || queryLower.includes('python') || queryLower.includes('hello')) {
    const codeChunk = rag.chunks.find((c) => c.fileName.endsWith('.py') || c.fileName.endsWith('.ts') || c.fileName.endsWith('.js')) || rag.chunks[0];
    return `Based on **${codeChunk.fileName}**${codeChunk.line ? ` (starting at Line ${codeChunk.line})` : ''}:\n\n\`\`\`${codeChunk.fileName.split('.').pop() || 'text'}\n${codeChunk.text}\n\`\`\`\n\n**Analysis:**\nThis section defines the file processing logic and entry point. It categorizes files by extension and handles metadata normalization.`;
  }

  // 3. General Question Answering with factual citations
  const findings = rag.chunks
    .map((c) => {
      const loc = c.page ? ` (Page ${c.page})` : c.line ? ` (Line ${c.line})` : '';
      return `According to **${c.fileName}**${loc}:\n> "${c.text}"`;
    })
    .join('\n\n');

  return `Based on your vault files, here is the relevant information for your query:\n\n${findings}\n\n*All insights are grounded directly in your private uploaded documents.*`;
}

// Cloudflare Workers AI caller (Pages Functions same-origin first, then custom endpoint, then local fallback)
export async function askCloudflareWorkersAI(
  query: string,
  files: VaultFile[],
  config: CloudflareConfig | null,
  targetFileId?: string
): Promise<{ answer: string; citations: ChatCitation[] }> {
  const rag = retrieveRelevantChunks(query, files, targetFileId);
  const targetFile = targetFileId ? files.find((f) => f.id === targetFileId) : null;
  const model = config?.aiModel || '@cf/meta/llama-3.1-8b-instruct-fp8';

  const endpoints: string[] = [];
  // 1. Same-origin Pages Function (works on deployed site + `wrangler pages dev` with zero config)
  if (typeof window !== 'undefined') {
    endpoints.push('/api/chat');
  }
  // 2. Custom worker endpoint (user-configured standalone Worker URL)
  if (config?.workerEndpoint && !endpoints.includes(config.workerEndpoint)) {
    endpoints.push(config.workerEndpoint);
  }

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          model,
          contextChunks: rag.chunks,
          targetFileName: targetFile?.name,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const answer =
          (typeof data.response === 'string' && data.response.trim()) ||
          (typeof data.result?.response === 'string' && data.result.response.trim()) ||
          '';
        if (answer) {
          return { answer, citations: rag.citations };
        }
        // empty but ok → fall through to local engine rather than returning blank
        console.warn(`Worker endpoint ${endpoint} returned empty response, using local RAG engine`);
        break;
      }
    } catch (err) {
      console.warn(`Worker endpoint ${endpoint} call failed, trying next:`, err);
    }
  }

  // Built-in intelligent RAG engine (offline / local fallback)
  const answer = generateLocalRAGResponse(query, rag, targetFile);
  return {
    answer,
    citations: rag.citations,
  };
}
