import Prism from './prismSetup';
// Language packs (order matters: base languages + dependencies first).
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
// markup-templating must load BEFORE php (php's after-tokenize hook calls it).
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-php';
import 'prismjs/themes/prism-tomorrow.css';

/** Map common aliases to Prism grammar names. */
const ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  html: 'markup',
  xml: 'markup',
  vue: 'markup',
  rs: 'rust',
  golang: 'go',
  csharp: 'clike',
  cs: 'clike',
  'c++': 'cpp',
};

export function resolveLang(lang: string | undefined): string {
  const l = (lang || '').toLowerCase().trim();
  return ALIASES[l] || l;
}

export function hasGrammar(lang: string): boolean {
  const l = resolveLang(lang);
  return Boolean((Prism.languages as any)[l]);
}

/** Highlight a code string. Falls back to escaped plain text. */
export function highlightCode(code: string, lang?: string): string {
  const grammar = (Prism.languages as any)[resolveLang(lang || '')];
  try {
    if (grammar) return Prism.highlight(code, grammar, resolveLang(lang || ''));
  } catch {
    /* fall through */
  }
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export { Prism };
