import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  Clock,
  FileText,
  Code,
  Image as ImageIcon,
  Video,
  File,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { VaultFile, SearchResult, FilterCategory } from '../types';
import { searchVaultFiles, getRecentSearches, saveRecentSearch } from '../services/searchEngine';

interface SearchScreenProps {
  files: VaultFile[];
  onSelectFile: (file: VaultFile) => void;
  initialQuery?: string;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  files,
  onSelectFile,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  useEffect(() => {
    if (query.trim()) {
      const res = searchVaultFiles(files, query, selectedFilter);
      setResults(res);
      saveRecentSearch(query);
    } else {
      setResults([]);
    }
  }, [query, selectedFilter, files]);

  const handleSelectRecent = (term: string) => {
    setQuery(term);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'pdf':
      case 'docx':
      case 'markdown':
      case 'text':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      case 'code':
        return <Code className="w-4 h-4 text-emerald-400" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-fuchsia-400" />;
      case 'video':
        return <Video className="w-4 h-4 text-purple-400" />;
      default:
        return <File className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
      {/* Search Input Bar */}
      <div className="relative mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search file names, code, or document text..."
          autoFocus
          className="w-full h-12 pl-11 pr-10 rounded-2xl bg-slate-900/60 dark:bg-slate-900/60 light:bg-white text-slate-100 dark:text-slate-100 light:text-slate-900 border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 focus:border-cyan-400 light:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 text-sm placeholder:text-slate-500 shadow-lg"
        />
        <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-5 no-scrollbar">
        {(['all', 'docs', 'images', 'videos', 'code'] as FilterCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedFilter(cat)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              selectedFilter === cat
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm light:bg-indigo-600 light:text-white'
                : 'text-slate-400 bg-slate-900/30 dark:bg-slate-900/30 light:bg-slate-100 hover:text-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Recent Searches (When query is empty) */}
      {!query && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Recent Searches</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term, i) => (
              <button
                key={i}
                onClick={() => handleSelectRecent(term)}
                className="px-3 py-1.5 rounded-xl bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-200 text-xs text-slate-300 dark:text-slate-300 light:text-slate-700 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                {term}
              </button>
            ))}
          </div>

          <div className="mt-8 p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/15 text-xs text-slate-400 leading-relaxed">
            <span className="font-semibold text-cyan-300">Deep Full-Text Indexing:</span> Searches inside PDFs, DOCX paragraphs, Markdown sections, Python/TypeScript source lines, and media metadata.
          </div>
        </div>
      )}

      {/* Search Results */}
      {query && (
        <div className="space-y-3">
          <div className="text-xs text-slate-400">
            Found <span className="font-bold text-cyan-400">{results.length}</span> results for "{query}"
          </div>

          {results.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/20 border border-slate-800">
              <p className="text-xs text-slate-400">No matching documents or code lines found.</p>
            </div>
          ) : (
            results.map(({ file, snippet, matchedField }) => (
              <div
                key={file.id}
                onClick={() => onSelectFile(file)}
                className="p-3.5 rounded-2xl bg-slate-900/40 dark:bg-slate-900/40 light:bg-white border border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 hover:border-cyan-500/40 hover:bg-slate-900/70 transition-all cursor-pointer flex flex-col gap-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(file.category)}
                    <h4 className="text-sm font-bold text-white dark:text-white light:text-slate-900 group-hover:text-cyan-300 transition-colors">
                      {file.name}
                    </h4>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 capitalize">
                    {matchedField}
                  </span>
                </div>

                <p className="text-xs text-slate-300 dark:text-slate-300 light:text-slate-600 font-mono bg-slate-950/40 dark:bg-slate-950/40 light:bg-slate-50 p-2 rounded-lg border border-slate-800/50">
                  {snippet}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
