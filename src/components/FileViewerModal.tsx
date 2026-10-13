import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Download,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  FileCode,
  FileText,
  Volume2,
  Share2,
} from 'lucide-react';
import { VaultFile } from '../types';
import { getFileBlob } from '../services/db';

interface FileViewerModalProps {
  file: VaultFile | null;
  onClose: () => void;
  onAskAI: (file: VaultFile) => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  file,
  onClose,
  onAskAI,
}) => {
  if (!file) return null;

  const [copied, setCopied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activeTab, setActiveTab] = useState<'preview' | 'source'>('preview');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loadingBlob, setLoadingBlob] = useState(false);

  // Rehydrate the real file bytes from IndexedDB. file.blobUrl is an
  // in-memory URL that does not survive reloads (and is no longer
  // persisted), so image/video/audio preview + download must rebuild it.
  useEffect(() => {
    let revoked = false;
    let url: string | null = null;
    setObjectUrl(null);
    if (!file) return;
    if (file.blobUrl) {
      setObjectUrl(file.blobUrl);
      return;
    }
    if (file.category === 'image' || file.category === 'video' || file.category === 'audio' || file.category === 'pdf') {
      setLoadingBlob(true);
      getFileBlob(file.id)
        .then((blob) => {
          if (revoked) return;
          if (blob) {
            url = URL.createObjectURL(blob);
            setObjectUrl(url);
          }
        })
        .catch((err) => console.warn('Could not load file blob:', err))
        .finally(() => {
          if (!revoked) setLoadingBlob(false);
        });
    }
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file?.id]);

  const previewSrc = objectUrl || file.blobUrl || null;

  const totalPages = file.metadata?.pageCount || 3;

  const handleCopyCode = () => {
    if (file.extractedText) {
      navigator.clipboard.writeText(file.extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    try {
      // Prefer the real stored bytes (binary files download correctly).
      const stored = await getFileBlob(file.id);
      const blob =
        stored || new Blob([file.extractedText || ''], { type: file.mimeType });
      const url = previewSrc && stored ? previewSrc : URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (!previewSrc || !stored) URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#07090e] dark:bg-[#07090e] light:bg-slate-50 text-slate-100 dark:text-slate-100 light:text-slate-900 animate-fade-in">
      {/* Top Navigation Bar */}
      <div className="h-14 px-4 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 flex items-center justify-between backdrop-blur-md bg-[#07090e]/90 dark:bg-[#07090e]/90 light:bg-white/90">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/70 dark:bg-slate-800/70 light:bg-slate-100 flex items-center justify-center text-slate-300 hover:text-white dark:text-slate-300 light:text-slate-700 transition-colors cursor-pointer"
            aria-label="Back to files"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white dark:text-white light:text-slate-900 truncate">
              {file.name}
            </h2>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="uppercase">{file.extension}</span>
              <span>·</span>
              <span>{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onAskAI(file)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition-all cursor-pointer shadow-sm"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ask AI</span>
          </button>

          {file.category === 'code' && (
            <button
              onClick={handleCopyCode}
              className="w-8 h-8 rounded-lg bg-slate-800 dark:bg-slate-800 light:bg-slate-200 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Copy Code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={handleDownload}
            className="w-8 h-8 rounded-lg bg-slate-800 dark:bg-slate-800 light:bg-slate-200 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Viewer Main Canvas */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-start">
        {/* 1a. PDF Viewer — native browser renderer when bytes are available */}
        {file.category === 'pdf' && previewSrc && (
          <div className="w-full max-w-2xl flex flex-col items-center">
            <iframe
              src={`${previewSrc}#page=${currentPage}&toolbar=1&view=FitH`}
              title={file.name}
              className="w-full h-[75dvh] rounded-2xl bg-white border border-slate-700 shadow-2xl"
            />
            <div className="flex items-center gap-4 mt-4 px-4 py-2 rounded-full bg-slate-900/80 border border-slate-800 shadow-lg">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-slate-200 font-mono">{currentPage} / {totalPages}</span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 1b. PDF Viewer fallback — extracted text page */}
        {file.category === 'pdf' && !previewSrc && (
          <div className="w-full max-w-xl flex flex-col items-center">
            {/* White Paper Page (Matches screenshot) */}
            <div className="w-full min-h-[520px] bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="border-b border-slate-200 pb-3 mb-4">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {file.name.replace('.pdf', '')}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Page {currentPage} of {totalPages} · Verified Document Extract
                  </p>
                </div>

                <div className="text-sm text-slate-800 space-y-4 leading-relaxed font-sans">
                  {file.extractedText ? (
                    file.extractedText.split('\n\n').slice(0, 5).map((para, i) => (
                      <p key={i} className="whitespace-pre-wrap">{para}</p>
                    ))
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-bold text-slate-900 mb-1">1. Overview</h3>
                        <p className="text-slate-600 text-xs">
                          Secure edge-first file vault with intelligent document indexing and Cloudflare Workers AI integration.
                        </p>
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 mb-1">2. Architecture</h3>
                        <p className="text-slate-600 text-xs">
                          PWA installability with zero-latency IndexedDB local caching, full-text search, and offline reader.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* PDF Footer Controls */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>FileMind Secure PDF Reader</span>
                <span>Encrypted Vault Document</span>
              </div>
            </div>

            {/* Bottom Page Navigation Controls (< 1/3 > matching screenshot) */}
            <div className="flex items-center gap-4 mt-4 px-4 py-2 rounded-full bg-slate-900/80 dark:bg-slate-900/80 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-300 shadow-lg">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-semibold text-slate-200 dark:text-slate-200 light:text-slate-800 font-mono">
                {currentPage} / {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 2. Code Viewer (Syntax Highlighted with Line Numbers matching screenshot) */}
        {file.category === 'code' && (
          <div className="w-full max-w-2xl rounded-2xl bg-[#090d16] dark:bg-[#090d16] light:bg-[#0d1117] border border-slate-800 dark:border-slate-800 light:border-slate-700 overflow-hidden shadow-2xl">
            <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span className="font-mono text-slate-200">{file.name}</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                {file.metadata?.language?.toUpperCase() || file.extension.toUpperCase()} · UTF-8
              </span>
            </div>

            <div className="p-4 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed text-slate-200">
              <table className="w-full border-collapse">
                <tbody>
                  {(file.extractedText || '').split('\n').map((line, idx) => {
                    const lineNum = idx + 1;
                    // Simple token highlighting
                    const isDef = line.includes('def ') || line.includes('function ') || line.includes('export ');
                    const isComment = line.trim().startsWith('#') || line.trim().startsWith('//') || line.trim().startsWith('"""');
                    const isImport = line.includes('import ') || line.includes('from ');

                    return (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="w-8 pr-4 text-right text-slate-600 select-none font-mono text-xs">
                          {lineNum}
                        </td>
                        <td className="font-mono whitespace-pre text-left">
                          {isComment ? (
                            <span className="text-slate-500 italic">{line}</span>
                          ) : isDef ? (
                            <span className="text-cyan-300 font-semibold">{line}</span>
                          ) : isImport ? (
                            <span className="text-fuchsia-400">{line}</span>
                          ) : (
                            <span className="text-emerald-300">{line}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Markdown Viewer (Rendered + Source mode toggle matching screenshot) */}
        {file.category === 'markdown' && (
          <div className="w-full max-w-2xl rounded-2xl bg-[#090d16] dark:bg-[#090d16] light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 dark:border-slate-800 light:border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Markdown
                </span>
              </div>
              <div className="flex items-center gap-1 bg-slate-900 dark:bg-slate-900 light:bg-slate-100 p-0.5 rounded-lg border border-slate-800 dark:border-slate-800 light:border-slate-200 text-xs">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    activeTab === 'preview' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setActiveTab('source')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    activeTab === 'source' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Source
                </button>
              </div>
            </div>

            {activeTab === 'preview' ? (
              <div className="prose prose-invert max-w-none text-slate-200 dark:text-slate-200 light:text-slate-800 space-y-4 text-sm leading-relaxed">
                {(file.extractedText || '').split('\n').map((line, idx) => {
                  if (line.startsWith('# ')) {
                    return <h1 key={idx} className="text-xl font-extrabold text-white dark:text-white light:text-slate-900">{line.replace('# ', '')}</h1>;
                  }
                  if (line.startsWith('## ')) {
                    return <h2 key={idx} className="text-base font-bold text-cyan-400 light:text-indigo-600 mt-4">{line.replace('## ', '')}</h2>;
                  }
                  if (line.startsWith('- ')) {
                    return <li key={idx} className="ml-4 list-disc text-slate-300 dark:text-slate-300 light:text-slate-700">{line.replace('- ', '')}</li>;
                  }
                  return <p key={idx} className="text-slate-300 dark:text-slate-300 light:text-slate-700">{line}</p>;
                })}
              </div>
            ) : (
              <pre className="p-4 bg-slate-950 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
                {file.extractedText}
              </pre>
            )}
          </div>
        )}

        {/* 4. Image Viewer (Zoom controls matching screenshot) */}
        {file.category === 'image' && (
          <div className="w-full max-w-2xl flex flex-col items-center">
            <div className="relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center p-2 min-h-[360px]">
              <img
                src={previewSrc || file.dataUrl || '/icon.svg'}
                alt={file.name}
                className="max-h-[70dvh] object-contain rounded-xl transition-transform duration-200"
                style={{ transform: `scale(${zoomLevel / 100})` }}
              />
              {!previewSrc && !file.dataUrl && (
                <span className="absolute bottom-2 text-[10px] text-slate-500">
                  {loadingBlob ? 'Loading image…' : 'Image bytes unavailable'}
                </span>
              )}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-3 mt-4 px-4 py-2 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300 shadow-lg">
              <button
                onClick={() => setZoomLevel((z) => Math.max(50, z - 20))}
                className="p-1 hover:text-white cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-medium">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(250, z + 20))}
                className="p-1 hover:text-white cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className="p-1 hover:text-white cursor-pointer"
                title="Reset Zoom"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 5. Video Player (Matching screenshot with play controls) */}
        {file.category === 'video' && (
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col">
            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              {previewSrc ? (
                <video
                  src={previewSrc}
                  controls
                  className="w-full h-full object-contain"
                  autoPlay={false}
                />
              ) : (
                <div className="text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mx-auto mb-3">
                    <Maximize2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white">{file.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {loadingBlob ? 'Loading video…' : 'Video bytes unavailable — re-upload to preview'}
                  </p>
                </div>
              )}
            </div>
            <div className="p-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Duration: 0:00 / 1:24</span>
              <span>1080p HD Native Player</span>
            </div>
          </div>
        )}

        {/* 6. Audio Player */}
        {file.category === 'audio' && (
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-center">
            <div className="w-20 h-20 rounded-2xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 mx-auto mb-4">
              <Volume2 className="w-10 h-10" />
            </div>
            <h3 className="text-base font-bold text-white">{file.name}</h3>
            <p className="text-xs text-slate-400 mt-1 mb-6">High-Fidelity Audio Stream</p>
            {previewSrc ? (
              <audio src={previewSrc} controls className="w-full" />
            ) : (
              <div className="p-3 rounded-xl bg-slate-950 text-xs text-slate-400 font-mono">
                {loadingBlob ? 'Loading audio…' : 'Audio bytes unavailable — re-upload to play'}
              </div>
            )}
          </div>
        )}

        {/* 6.5 Spreadsheet Preview — real table from CSV/TSV/XLSX text extraction */}
        {file.category === 'spreadsheet' && (
          <div className="w-full max-w-3xl rounded-2xl bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold">{file.name}</h2>
                <p className="text-[10px] text-slate-500">
                  {file.metadata?.rows ? `${file.metadata.rows} rows` : ''}
                  {file.metadata?.columns ? ` × ${file.metadata.columns} cols` : ''}
                  {file.metadata?.sheetName ? ` · ${file.metadata.sheetName}` : ''} · Parsed locally
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                SPREADSHEET
              </span>
            </div>
            <div className="overflow-auto max-h-[70dvh]">
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {(file.extractedText || '')
                    .split('\n')
                    .slice(0, 300)
                    .map((row, rIdx) => {
                      const cells = (row.includes('\t') ? row.split('\t') : row.split(/,|;(?! )/)).map((c) => c.trim());
                      return (
                        <tr key={rIdx} className={rIdx === 0 ? 'bg-emerald-500/10 dark:bg-emerald-500/10' : 'odd:bg-slate-50 dark:odd:bg-slate-950/40'}>
                          {cells.map((cell, cIdx) => {
                            const Tag = rIdx === 0 ? 'th' : 'td';
                            return (
                              <Tag
                                key={cIdx}
                                className={`px-3 py-1.5 border border-slate-200 dark:border-slate-800 whitespace-nowrap max-w-[280px] truncate ${
                                  rIdx === 0 ? 'font-bold text-emerald-700 dark:text-emerald-300 text-left' : ''
                                }`}
                              >
                                {cell}
                              </Tag>
                            );
                          })}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {(file.extractedText || '').split('\n').length > 300 && (
              <div className="px-4 py-2 text-[10px] text-slate-500 border-t border-slate-200 dark:border-slate-800">
                Showing first 300 of {(file.extractedText || '').split('\n').length} rows · ask the AI for insights on the rest
              </div>
            )}
          </div>
        )}

        {/* 6.6 Presentation / Ebook / Archive preview */}
        {['presentation', 'ebook', 'archive'].includes(file.category) && (
          <div className="w-full max-w-xl rounded-2xl bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-bold truncate">{file.name}</h2>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {file.category === 'presentation' && `${file.metadata?.slideCount ?? '—'} slides · Parsed locally`}
                  {file.category === 'ebook' && `${file.metadata?.chapters ?? '—'} chapters · ${file.metadata?.author || 'Unknown author'}`}
                  {file.category === 'archive' && `${file.metadata?.entries ?? '—'} entries · listing`}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                  file.category === 'presentation'
                    ? 'bg-orange-500/15 text-orange-500 border-orange-500/30'
                    : file.category === 'ebook'
                      ? 'bg-violet-500/15 text-violet-500 border-violet-500/30'
                      : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                }`}
              >
                {file.category.toUpperCase()}
              </span>
            </div>
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200 max-h-[65dvh] overflow-y-auto">
              {file.extractedText || 'No content extracted for this file.'}
            </div>
          </div>
        )}

        {/* 7. DOCX & Text Viewers */}
        {(file.category === 'docx' || file.category === 'text' || file.category === 'other') && (
          <div className="w-full max-w-xl rounded-2xl bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h2 className="text-xl font-bold">{file.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {(file.extractedText?.split(/\s+/).length || 0)} words · Extracted Text
              </p>
            </div>
            <div className="text-sm whitespace-pre-wrap leading-relaxed font-sans text-slate-800 dark:text-slate-200">
              {file.extractedText || 'No text extracted for this document.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
