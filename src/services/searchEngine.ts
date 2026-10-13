import { VaultFile, SearchResult, FilterCategory } from '../types';

export function searchVaultFiles(
  files: VaultFile[],
  query: string,
  categoryFilter: FilterCategory = 'all'
): SearchResult[] {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return [];

  const queryTerms = cleanQuery.split(/\s+/).filter(Boolean);
  const results: SearchResult[] = [];

  for (const file of files) {
    // Check category filter
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'docs' && !['pdf', 'docx', 'markdown', 'text', 'spreadsheet', 'presentation', 'ebook'].includes(file.category)) {
        continue;
      }
      if (categoryFilter === 'images' && file.category !== 'image') {
        continue;
      }
      if (categoryFilter === 'videos' && file.category !== 'video') {
        continue;
      }
      if (categoryFilter === 'code' && file.category !== 'code') {
        continue;
      }
      if (categoryFilter === 'audio' && file.category !== 'audio') {
        continue;
      }
    }

    let score = 0;
    let matchedField: SearchResult['matchedField'] = 'name';
    let snippet = '';

    const nameLower = file.name.toLowerCase();
    const textLower = (file.extractedText || '').toLowerCase();

    // 1. Exact or partial filename match
    if (nameLower === cleanQuery) {
      score += 100;
      snippet = `Exact filename match: ${file.name}`;
      matchedField = 'name';
    } else if (nameLower.includes(cleanQuery)) {
      score += 60;
      snippet = `Filename match: ${file.name}`;
      matchedField = 'name';
    } else {
      // Check multi-term in filename
      const allTermsInName = queryTerms.every((term) => nameLower.includes(term));
      if (allTermsInName) {
        score += 45;
        snippet = `Filename terms match: ${file.name}`;
        matchedField = 'name';
      }
    }

    // 2. Content search inside extracted document text / code
    if (textLower.includes(cleanQuery)) {
      score += 50;
      matchedField = 'content';

      const matchIdx = textLower.indexOf(cleanQuery);
      const start = Math.max(0, matchIdx - 45);
      const end = Math.min(file.extractedText!.length, matchIdx + cleanQuery.length + 55);
      let excerpt = file.extractedText!.slice(start, end).replace(/\s+/g, ' ');

      if (start > 0) excerpt = '...' + excerpt;
      if (end < file.extractedText!.length) excerpt = excerpt + '...';
      snippet = excerpt;
    } else {
      // Check if individual terms appear in chunks
      let matchedChunk = '';
      let chunkHits = 0;
      if (file.chunks && file.chunks.length > 0) {
        for (const chunk of file.chunks) {
          const chunkLower = chunk.text.toLowerCase();
          const hits = queryTerms.filter((term) => chunkLower.includes(term)).length;
          if (hits > chunkHits) {
            chunkHits = hits;
            matchedChunk = chunk.text;
          }
        }
      }

      if (chunkHits > 0) {
        score += chunkHits * 15;
        matchedField = 'content';
        snippet = matchedChunk.slice(0, 120) + (matchedChunk.length > 120 ? '...' : '');
      }
    }

    // 3. Extension or metadata search
    if (file.extension.toLowerCase() === cleanQuery) {
      score += 30;
      snippet = snippet || `File extension .${file.extension}`;
      matchedField = 'metadata';
    }

    if (score > 0) {
      results.push({
        file,
        matchScore: score,
        snippet: snippet || `Found in ${file.name}`,
        matchedField,
      });
    }
  }

  // Sort by score descending, then recent
  results.sort((a, b) => b.matchScore - a.matchScore || b.file.updatedAt - a.file.updatedAt);
  return results;
}

const RECENT_SEARCHES_KEY = 'filemind_recent_searches';

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return ['Project Notes', 'Cloudflare', 'Python', 'hello_world'];
    return JSON.parse(raw);
  } catch {
    return ['Project Notes', 'Cloudflare', 'Python'];
  }
}

export function saveRecentSearch(query: string): void {
  const clean = query.trim();
  if (!clean || clean.length < 2) return;
  try {
    const existing = getRecentSearches().filter((s) => s.toLowerCase() !== clean.toLowerCase());
    const updated = [clean, ...existing].slice(0, 8);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not save recent search:', err);
  }
}
