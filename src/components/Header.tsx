import React from 'react';
import { Sun, Moon, Cloud, Wifi, WifiOff, CloudLightning } from 'lucide-react';

interface HeaderProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isOnline: boolean;
  onOpenDeploy: () => void;
  onNavigateHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  onToggleTheme,
  isOnline,
  onOpenDeploy,
  onNavigateHome,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl border-b transition-colors duration-200 bg-[#07090e]/85 dark:bg-[#07090e]/85 light:bg-white/90 border-slate-800/80 dark:border-slate-800/80 light:border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand Lockup */}
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 group cursor-pointer focus:outline-none"
          aria-label="Go to Home"
        >
          <div className="relative w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-tr from-cyan-500 via-indigo-600 to-fuchsia-500 p-[1.5px] shadow-sm group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#07090e] dark:bg-[#07090e] light:bg-white rounded-[10px] flex items-center justify-center">
              <Cloud className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
            </div>
            <div className="absolute inset-0 rounded-xl bg-cyan-400/20 blur-md pointer-events-none group-hover:bg-cyan-400/40 transition-colors" />
          </div>

          <div className="flex flex-col text-left">
            <span className="text-base font-extrabold tracking-tight text-white dark:text-white light:text-slate-900 leading-none">
              File<span className="neon-text-gradient">Mind</span>
            </span>
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400 light:text-slate-500 tracking-wide mt-0.5">
              Personal Vault
            </span>
          </div>
        </button>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Online/Offline Status Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 light:text-emerald-700'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400 light:text-amber-700'
            }`}
            title={isOnline ? 'Connected to Network' : 'Operating Offline with Cached Vault'}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-400 light:text-emerald-600" />
                <span className="hidden sm:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-400 light:text-amber-600 animate-pulse" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Cloudflare Deploy Ready Button */}
          <button
            onClick={onOpenDeploy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/40 text-orange-300 hover:text-orange-200 hover:border-orange-400 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Cloudflare Deploy Architecture"
          >
            <CloudLightning className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden sm:inline">Cloudflare</span>
          </button>

          {/* Dark / Light Toggle */}
          <button
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white dark:hover:text-white light:text-slate-600 light:hover:text-slate-900 hover:bg-slate-800/60 dark:hover:bg-slate-800/60 light:hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Toggle dark/light theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
