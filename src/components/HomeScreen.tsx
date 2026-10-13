import React from 'react';
import {
  Upload,
  Search,
  FolderOpen,
  MessageSquare,
  Settings,
  FileText,
  Lock,
  WifiOff,
  Sparkles,
  Smartphone,
  ArrowRight,
  Cloud,
} from 'lucide-react';
import { NavTab } from './BottomNav';

interface HomeScreenProps {
  onNavigateTab: (tab: NavTab) => void;
  onOpenUpload: () => void;
  onGlobalSearch: (query: string) => void;
  theme: 'dark' | 'light';
  totalFilesCount: number;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateTab,
  onOpenUpload,
  onGlobalSearch,
  theme,
  totalFilesCount,
}) => {
  const [searchInput, setSearchInput] = React.useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onGlobalSearch(searchInput.trim());
    } else {
      onNavigateTab('search');
    }
  };

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem-4rem)] flex flex-col justify-between overflow-hidden pb-12">
      {/* Ambient background glow accents */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-cyan-500/10 dark:bg-cyan-500/15 light:bg-indigo-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute top-36 left-1/3 w-64 h-64 rounded-full bg-fuchsia-600/10 dark:bg-fuchsia-600/15 light:bg-purple-500/10 blur-[90px] pointer-events-none" />

      {/* Main Hero Section */}
      <div className="relative z-10 max-w-xl mx-auto w-full px-6 pt-6 sm:pt-10 flex flex-col items-center text-center">
        {/* Glowing Cloud Logo */}
        <div className="relative mb-6 cursor-pointer group" onClick={onOpenUpload}>
          {/* Subtle Outer Neon Aura */}
          <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-cyan-500 via-indigo-600 to-fuchsia-500 opacity-40 blur-xl group-hover:opacity-65 transition-opacity duration-300" />
          
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl p-[2px] bg-gradient-to-tr from-cyan-400 via-purple-500 to-fuchsia-500 shadow-2xl flex items-center justify-center transform group-hover:scale-105 transition-transform duration-300">
            <div className="w-full h-full bg-[#07090e] dark:bg-[#07090e] light:bg-white rounded-[22px] flex items-center justify-center overflow-hidden relative">
              <svg
                viewBox="0 0 100 100"
                className="w-20 h-20 filter drop-shadow-[0_0_12px_rgba(0,242,254,0.5)]"
                fill="none"
              >
                <defs>
                  <linearGradient id="cloudHolo" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00f2fe" />
                    <stop offset="50%" stopColor="#7f00ff" />
                    <stop offset="100%" stopColor="#e100ff" />
                  </linearGradient>
                </defs>
                <path
                  d="M72 65H32a13 13 0 01-6-24.5 17 17 0 0132-7.5 15 15 0 0119 14 11 11 0 01-5 18z"
                  stroke="url(#cloudHolo)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M50 42v15m0 0l-4-4m4 4l4-4"
                  stroke="#00f2fe"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Brand Headline & Tagline */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white dark:text-white light:text-slate-900 mb-2">
          File<span className="neon-text-gradient">Mind</span>
        </h1>
        
        <p className="text-base sm:text-lg font-semibold tracking-wide neon-text-gradient mb-3">
          Your Files. AI Powered.
        </p>

        {/* Navigation keywords */}
        <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-slate-400 dark:text-slate-400 light:text-slate-500 mb-7">
          <span>Upload</span>
          <span className="text-cyan-400/60 font-bold">·</span>
          <span>Preview</span>
          <span className="text-cyan-400/60 font-bold">·</span>
          <span>Search</span>
          <span className="text-cyan-400/60 font-bold">·</span>
          <span>Chat</span>
        </div>

        {/* Primary Action Button: Upload Files */}
        <button
          onClick={onOpenUpload}
          className="w-full sm:w-80 h-13 rounded-2xl neon-btn-gradient text-white font-bold text-base flex items-center justify-center gap-2.5 neon-glow-button hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer shadow-lg mb-4"
        >
          <Upload className="w-5 h-5 stroke-[2.5]" />
          <span>Upload Files</span>
        </button>

        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="w-full sm:w-80 relative mb-8">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search your files..."
            className="w-full h-12 pl-11 pr-4 rounded-xl text-sm bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100/90 text-slate-100 dark:text-slate-100 light:text-slate-900 border border-slate-700/60 dark:border-slate-700/60 light:border-slate-300 focus:border-cyan-400 light:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all placeholder:text-slate-400"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        </form>

        {/* 4 Quick Launch Tiles (Matching Mobile Phone Mockup) */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <button
            onClick={() => onNavigateTab('files')}
            className="p-3.5 rounded-2xl bg-slate-900/40 dark:bg-slate-900/40 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all text-left flex flex-col justify-between group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <FolderOpen className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white dark:text-white light:text-slate-900">Files</div>
              <div className="text-xs text-slate-400">{totalFilesCount} stored</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('chat')}
            className="p-3.5 rounded-2xl bg-slate-900/40 dark:bg-slate-900/40 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200 hover:border-fuchsia-500/50 hover:bg-fuchsia-500/5 transition-all text-left flex flex-col justify-between group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <MessageSquare className="w-5 h-5 text-fuchsia-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white dark:text-white light:text-slate-900">Chat</div>
              <div className="text-xs text-slate-400">Workers AI</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('search')}
            className="p-3.5 rounded-2xl bg-slate-900/40 dark:bg-slate-900/40 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left flex flex-col justify-between group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Search className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white dark:text-white light:text-slate-900">Search</div>
              <div className="text-xs text-slate-400">Deep content</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('settings')}
            className="p-3.5 rounded-2xl bg-slate-900/40 dark:bg-slate-900/40 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left flex flex-col justify-between group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Settings className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white dark:text-white light:text-slate-900">Settings</div>
              <div className="text-xs text-slate-400">Offline & Vault</div>
            </div>
          </button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="w-full text-left space-y-3 pt-2">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/30 dark:bg-slate-900/30 light:bg-slate-50 border border-slate-800/60 dark:border-slate-800/60 light:border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <Upload className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white dark:text-white light:text-slate-900">Upload & Manage</h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 light:text-slate-600">
                PDF, DOCX, TXT, MD, code, images, video, audio and more.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/30 dark:bg-slate-900/30 light:bg-slate-50 border border-slate-800/60 dark:border-slate-800/60 light:border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white dark:text-white light:text-slate-900">Chat with Your Files</h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 light:text-slate-600">
                Powered by Cloudflare Workers AI with verified clickable source citations.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/30 dark:bg-slate-900/30 light:bg-slate-50 border border-slate-800/60 dark:border-slate-800/60 light:border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <WifiOff className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white dark:text-white light:text-slate-900">Offline Access</h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 light:text-slate-600">
                Works offline with PWA + IndexedDB for flight & commute peace of mind.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Futuristic Neon Cyber Waves at bottom (Matches the screenshot) */}
      <div className="w-full relative mt-8 pointer-events-none select-none overflow-hidden h-28 sm:h-36">
        <svg
          viewBox="0 0 1440 280"
          className="w-full h-full object-cover"
          preserveAspectRatio="none"
          fill="none"
        >
          <defs>
            <linearGradient id="waveCyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#4facfe" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#7f00ff" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="waveMagentaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7f00ff" stopOpacity="0.3" />
              <stop offset="60%" stopColor="#e100ff" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#00f2fe" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Sinuous Neon Ribbon 1 */}
          <path
            d="M -50 190 Q 250 80, 600 170 T 1300 130 T 1500 210"
            stroke="url(#waveCyanGrad)"
            strokeWidth="4"
            className="filter drop-shadow-[0_0_10px_#00f2fe]"
          />
          {/* Sinuous Neon Ribbon 2 */}
          <path
            d="M -50 240 Q 350 150, 750 230 T 1400 180 T 1500 250"
            stroke="url(#waveMagentaGrad)"
            strokeWidth="3.5"
            className="filter drop-shadow-[0_0_12px_#e100ff]"
          />
          {/* Sinuous Neon Ribbon 3 */}
          <path
            d="M -50 220 Q 200 260, 500 200 T 1100 240 T 1500 190"
            stroke="#00f2fe"
            strokeWidth="2"
            opacity="0.4"
          />
        </svg>
      </div>
    </div>
  );
};
