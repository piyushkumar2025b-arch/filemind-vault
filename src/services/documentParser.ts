import mammoth from 'mammoth';
import { VaultFile, FileCategory, FileChunk } from '../types';

export function categorizeFile(name: string, mimeType: string): { category: FileCategory; extension: string } {
  const parts = name.split('.');
  const extension = parts.length > 1 ? parts.pop()!.toLowerCase() : '';

  if (extension === 'pdf' || mimeType.includes('pdf')) {
    return { category: 'pdf', extension: 'pdf' };
  }
  if (extension === 'docx' || mimeType.includes('wordprocessingml') || extension === 'doc') {
    return { category: 'docx', extension };
  }
  if (['md', 'markdown'].includes(extension)) {
    return { category: 'markdown', extension: 'md' };
  }
  if (['py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'yaml', 'yml', 'sql', 'go', 'rs', 'c', 'cpp', 'h', 'java', 'sh', 'bash', 'xml'].includes(extension)) {
    return { category: 'code', extension };
  }
  if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(extension)) {
    return { category: 'image', extension };
  }
  if (mimeType.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(extension)) {
    return { category: 'video', extension };
  }
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(extension)) {
    return { category: 'audio', extension };
  }
  if (['txt', 'csv', 'log', 'env', 'tsv'].includes(extension) || mimeType.startsWith('text/')) {
    return { category: 'text', extension };
  }

  return { category: 'other', extension };
}

export function chunkText(fileId: string, fileName: string, text: string): FileChunk[] {
  if (!text || text.trim().length === 0) return [];

  const chunks: FileChunk[] = [];
  const lines = text.split('\n');
  let currentChunk = '';
  let startLine = 1;
  let chunkIdx = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentChunk += (currentChunk ? '\n' : '') + line;

    if (currentChunk.length >= 350 || i === lines.length - 1) {
      if (currentChunk.trim().length > 15) {
        chunks.push({
          id: `${fileId}-c${chunkIdx++}`,
          fileId,
          fileName,
          text: currentChunk.trim(),
          line: startLine,
          page: Math.floor(i / 35) + 1,
        });
      }
      currentChunk = '';
      startLine = i + 2;
    }
  }

  return chunks;
}

export async function parseUploadedFile(file: File): Promise<{
  vaultFile: VaultFile;
  blob: Blob;
  previewUrl?: string;
}> {
  const { category, extension } = categorizeFile(file.name, file.type);
  const fileId = 'file-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

  let extractedText = '';
  let metadata: VaultFile['metadata'] = {};
  let previewUrl = '';

  try {
    if (category === 'text' || category === 'markdown' || category === 'code') {
      extractedText = await file.text();
      metadata.lineCount = extractedText.split('\n').length;
      metadata.wordCount = extractedText.split(/\s+/).filter(Boolean).length;
      if (category === 'code') {
        metadata.language = extension;
      }
    } else if (category === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      extractedText = result.value;
      metadata.wordCount = extractedText.split(/\s+/).filter(Boolean).length;
    } else if (category === 'pdf') {
      // Text-first PDF extraction: pull literal string tokens out of the
      // raw bytes (works for text PDFs without a heavy pdf.js dependency).
      // Falls back to metadata header when the PDF is scanned/image-only.
      extractedText = `PDF Document: ${file.name}\nSize: ${(file.size / 1024).toFixed(1)} KB`;
      try {
        const buffer = await file.arrayBuffer();
        const textDecoder = new TextDecoder('utf-8');
        const rawString = textDecoder.decode(buffer.slice(0, 200000));
        // PDF literal strings live in (parentheses) — far higher signal
        // than raw byte soup.
        const literalMatches = rawString.match(/\((?:[^()\\]|\\.){4,}\)/g) || [];
        const literals = literalMatches
          .map((s) =>
            s
              .slice(1, -1)
              .replace(/\\n/g, ' ')
              .replace(/\\(.)/g, '$1')
              .trim()
          )
          .filter((s) => /[A-Za-z]{3,}/.test(s));
        const literalText = literals.slice(0, 120).join(' ').slice(0, 6000);
        if (literalText.length > 60) {
          extractedText += '\n\nExtracted PDF text:\n' + literalText;
        } else {
          // Fallback: printable ASCII runs (old behavior, capped).
          const words = rawString.match(/[A-Za-z0-9.,:;\-_]{4,}/g);
          if (words && words.length > 20) {
            extractedText += '\n\nExtracted PDF terms:\n' + words.slice(0, 300).join(' ');
          } else {
            extractedText += '\n\nNote: this PDF appears scanned/image-only — no text layer found.';
          }
        }
      } catch (err) {
        console.warn('PDF stream extraction fallback:', err);
      }
      metadata.pageCount = Math.max(1, Math.round(file.size / (60 * 1024)));
    } else if (category === 'image') {
      previewUrl = URL.createObjectURL(file);
      // Images have no text layer — index a rich descriptor so search +
      // RAG can still find/ground them (fixes "Design-UI.png (Line 1):
      // explain" returning zero chunks).
      extractedText =
        `Image: ${file.name} (${extension.toUpperCase()}, ${(file.size / 1024).toFixed(1)} KB). ` +
        `Visual content — use the image preview to inspect it. ` +
        `File name keywords: ${file.name.replace(/[._-]+/g, ' ')}.`;
    } else if (category === 'video' || category === 'audio') {
      previewUrl = URL.createObjectURL(file);
      extractedText = `Media Recording: ${file.name} (${extension.toUpperCase()}, ${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    }
  } catch (err) {
    console.error('Error during document text extraction:', err);
    extractedText = `File: ${file.name} (Binary format, ${(file.size / 1024).toFixed(1)} KB)`;
  }

  const chunks = chunkText(fileId, file.name, extractedText);

  const vaultFile: VaultFile = {
    id: fileId,
    name: file.name,
    size: file.size,
    category,
    mimeType: file.type || 'application/octet-stream',
    extension,
    updatedAt: Date.now(),
    createdAt: Date.now(),
    isStarred: false,
    isCachedOffline: true,
    uploadStatus: 'completed',
    uploadProgress: 100,
    storageLocation: 'cached',
    extractedText,
    chunks,
    metadata,
    blobUrl: previewUrl || undefined,
  };

  return { vaultFile, blob: file, previewUrl };
}
