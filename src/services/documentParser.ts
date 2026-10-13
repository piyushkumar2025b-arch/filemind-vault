import mammoth from 'mammoth';
import { VaultFile, FileCategory, FileChunk } from '../types';
import { listFiles, readZipText, type ZipEntry } from './zipReader';

export function categorizeFile(name: string, mimeType: string): { category: FileCategory; extension: string } {
  const parts = name.split('.');
  const extension = parts.length > 1 ? parts.pop()!.toLowerCase() : '';

  if (extension === 'pdf' || mimeType.includes('pdf')) {
    return { category: 'pdf', extension: 'pdf' };
  }
  if (extension === 'docx' || mimeType.includes('wordprocessingml') || extension === 'doc') {
    return { category: 'docx', extension };
  }
  if (['xlsx', 'xlsm', 'xls', 'ods'].includes(extension) || mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel')) {
    return { category: 'spreadsheet', extension };
  }
  if (['pptx', 'ppt', 'odp'].includes(extension) || mimeType.includes('presentationml')) {
    return { category: 'presentation', extension };
  }
  if (['epub'].includes(extension) || mimeType.includes('epub')) {
    return { category: 'ebook', extension };
  }
  if (['zip', 'rar', '7z', 'gz', 'tar', 'bz2'].includes(extension)) {
    return { category: 'archive', extension };
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
  let metadata: NonNullable<VaultFile['metadata']> = {};
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
    } else if (category === 'spreadsheet' && ['xlsx', 'xlsm', 'ods'].includes(extension)) {
      extractedText = await parseSpreadsheet(await file.arrayBuffer(), file.name, metadata);
    } else if (category === 'spreadsheet') {
      // Legacy .xls / .csv-as-xls — index the raw text so search still works.
      const raw = await file.text();
      extractedText = `Spreadsheet: ${file.name}\n\n` + raw.slice(0, 8000);
      metadata.rows = raw.split('\n').length;
    } else if (category === 'presentation' && ['pptx', 'odp'].includes(extension)) {
      extractedText = await parsePresentation(await file.arrayBuffer(), file.name, metadata);
    } else if (category === 'ebook') {
      extractedText = await parseEpub(await file.arrayBuffer(), file.name, metadata);
    } else if (category === 'archive') {
      extractedText = await parseArchive(await file.arrayBuffer(), file.name, extension, metadata);
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

/** Convert a File/Blob to a base64 data URL (for vision API payloads). */
export async function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// OOXML / ODF parsers (XLSX, PPTX, EPUB) + ZIP archive listing.
// Pure functions over an ArrayBuffer using the dependency-free zipReader.
// ---------------------------------------------------------------------------

/** Pull cell text out of a sheet XML doc, joining columns with tabs and rows with newlines. */
function decodeSharedStrings(buffer: ArrayBuffer, entries: ZipEntry[]): Promise<string[]> {
  const ss = entries.find((e) => e.name === 'xl/sharedStrings.xml');
  if (!ss) return Promise.resolve([]);
  return readZipText(buffer, ss).then((xml) => {
    const items: string[] = [];
    for (const m of xml.match(/<si>[\s\S]*?<\/si>/g) || []) {
      items.push(
        (m.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() || '')
      );
    }
    return items;
  });
}

async function parseSpreadsheet(buffer: ArrayBuffer, fileName: string, metadata: NonNullable<VaultFile['metadata']>): Promise<string> {
  const entries = listFiles(buffer);
  const shared = await decodeSharedStrings(buffer, entries);
  const sheets = entries.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name));
  if (!sheets.length) throw new Error('No worksheets found');

  const out: string[] = [`Spreadsheet: ${fileName}`, ''];
  let totalRows = 0;
  let maxCols = 0;
  let sheetIdx = 0;
  for (const sheet of sheets.slice(0, 12)) {
    sheetIdx++;
    const xml = await readZipText(buffer, sheet);
    out.push(`=== Sheet ${sheetIdx} ===`);
    const rowMatches = xml.match(/<row[ >][\s\S]*?<\/row>/g) || [];
    let rowCount = 0;
    for (const rowXml of rowMatches.slice(0, 200)) {
      const cells: string[] = [];
      let colIdx = 0;
      for (const c of rowXml.match(/<c[ >][\s\S]*?(?:\/>|<\/c>)/g) || []) {
        const ref = (c.match(/\br="([A-Z]+)\d+"/) || [])[1];
        if (ref) colIdx = ref.charCodeAt(0) - 65;
        const type = (c.match(/\bt="([a-z]+)"/) || [])[1];
        let val = c.replace(/<[^>]+>/g, '');
        if (type === 's' && val) {
          const idx = parseInt(val, 10);
          val = shared[idx] ?? '';
        }
        while (cells.length < colIdx) cells.push('');
        cells[colIdx] = val;
        colIdx++;
      }
      const line = cells.join('\t').trim();
      if (line) {
        out.push(line);
        rowCount++;
        maxCols = Math.max(maxCols, cells.length);
      }
    }
    totalRows += rowCount;
    out.push('');
  }
  metadata.sheetName = `Sheet 1`;
  metadata.rows = totalRows;
  metadata.columns = maxCols;
  metadata.wordCount = out.join('\n').split(/\s+/).filter(Boolean).length;
  return out.join('\n').slice(0, 12000);
}

async function parsePresentation(buffer: ArrayBuffer, fileName: string, metadata: NonNullable<VaultFile['metadata']>): Promise<string> {
  const entries = listFiles(buffer);
  const slides = entries
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name))
    .sort((a, b) => parseInt(a.name.match(/(\d+)/)![1]) - parseInt(b.name.match(/(\d+)/)![1]));
  const out: string[] = [`Presentation: ${fileName}`, ''];
  for (let i = 0; i < slides.length; i++) {
    const xml = await readZipText(buffer, slides[i]);
    const text = xml
      .replace(/<a:t>/g, ' ')
      .replace(/<\/a:t>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    out.push(`--- Slide ${i + 1} ---`);
    out.push(text || '(no text)');
    out.push('');
  }
  metadata.slideCount = slides.length;
  metadata.wordCount = out.join('\n').split(/\s+/).filter(Boolean).length;
  return out.join('\n').slice(0, 12000);
}

async function parseEpub(buffer: ArrayBuffer, fileName: string, metadata: NonNullable<VaultFile['metadata']>): Promise<string> {
  const entries = listFiles(buffer);
  const htmlFiles = entries.filter((e) => /\.(xhtml|html)$/i.test(e.name)).sort((a, b) => a.name.localeCompare(b.name));
  const out: string[] = [`Ebook: ${fileName}`, ''];
  let chapters = 0;
  for (const f of htmlFiles.slice(0, 60)) {
    const html = await readZipText(buffer, f);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/(p|div|h[1-6]|li|br)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
      .replace(/[ \t]+/g, ' ')
      .trim();
    if (text.length > 40) {
      chapters++;
      out.push(`--- ${f.name} ---`);
      out.push(text);
      out.push('');
    }
  }
  metadata.chapters = chapters;
  metadata.wordCount = out.join('\n').split(/\s+/).filter(Boolean).length;
  return out.join('\n').slice(0, 12000);
}

async function parseArchive(
  buffer: ArrayBuffer,
  fileName: string,
  extension: string,
  metadata: NonNullable<VaultFile['metadata']>
): Promise<string> {
  // Only ZIP-based archives can be read in-browser; others get a listing note.
  if (!['zip', 'xlsx', 'pptx', 'epub', 'docx'].includes(extension) && extension !== 'zip') {
    return `Archive: ${fileName} (${extension.toUpperCase()}). Contents listed in the viewer; binary ${extension.toUpperCase()} streams cannot be read directly in the browser.`;
  }
  const files = listFiles(buffer);
  metadata.entries = files.length;
  const listing = files.slice(0, 200).map((e) => `  ${e.name}  (${(e.uncompressedSize / 1024).toFixed(1)} KB)`);
  return [`Archive: ${fileName}`, `${files.length} files`, '', ...listing].join('\n').slice(0, 8000);
}
