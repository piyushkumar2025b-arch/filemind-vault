import React, { useState } from 'react';
import { Code, Copy, Check } from 'lucide-react';
import { highlightCode, resolveLang } from '../services/highlight';

/**
 * RichContent — renders AI chat text with:
 *  - ```fenced code blocks``` highlighted via Prism (real syntax colors)
 *  - inline `code` chips
 *  - bold **text** → bold
 * A copy button sits on every code block.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  // Split on inline `code` and **bold** segments.
  const parts: React.ReactNode[] = [];
  const re = /(`[^`\n]+`)|(\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const seg = m[0];
    if (seg.startsWith('`')) {
      parts.push(
        <code key={`${keyBase}-c${i++}`} className="px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-300 text-[0.9em] font-mono">
          {seg.slice(1, -1)}
        </code>
      );
    } else {
      parts.push(<strong key={`${keyBase}-b${i++}`} className="font-bold text-white">{seg.slice(2, -2)}</strong>);
    }
    last = m.index + seg.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const CodeBlock: React.FC<{ code: string; lang?: string }> = ({ code, lang }) => {
  const [copied, setCopied] = useState(false);
  const cleanLang = resolveLang(lang);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-slate-700/80 bg-[#0d1117] shadow-lg">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <Code className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase">{cleanLang || 'code'}</span>
        </div>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
          title="Copy code"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[11px] sm:text-xs leading-relaxed m-0">
        <code
          className={`language-${cleanLang || 'text'} font-mono text-slate-100`}
          dangerouslySetInnerHTML={{ __html: highlightCode(code, cleanLang) }}
        />
      </pre>
    </div>
  );
};

export const RichContent: React.FC<{ content: string }> = ({ content }) => {
  const segments = (content || '').split('```');

  return (
    <div className="whitespace-pre-wrap">
      {segments.map((seg, i) => {
        if (i % 2 === 1) {
          // Code segment: first line may declare the language.
          const nl = seg.indexOf('\n');
          const firstLine = (nl >= 0 ? seg.slice(0, nl) : seg).trim();
          const lang = /^[a-z0-9+#-]{1,20}$/i.test(firstLine) ? firstLine : undefined;
          const code = (nl >= 0 && lang ? seg.slice(nl + 1) : seg).replace(/\n$/, '');
          return <CodeBlock key={i} code={code} lang={lang} />;
        }
        if (!seg) return null;
        return <span key={i}>{renderInline(seg, `s${i}`)}</span>;
      })}
    </div>
  );
};
