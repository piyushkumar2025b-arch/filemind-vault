import React from 'react';
import { Home, FolderOpen, MessageSquare, Search, Settings } from 'lucide-react';

export type NavTab = 'home' | 'files' | 'chat' | 'search' | 'settings';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  unreadCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  const tabs: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'files', label: 'Files', icon: FolderOpen },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t bg-[#07090e]/95 dark:bg-[#07090e]/95 light:bg-white/95 border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-5 items-center h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center h-full relative cursor-pointer transition-all duration-200 group ${
                isActive
                  ? 'text-cyan-400 light:text-indigo-600 scale-105'
                  : 'text-slate-400 hover:text-slate-200 dark:text-slate-400 dark:hover:text-slate-200 light:text-slate-500 light:hover:text-slate-800'
              }`}
              aria-label={tab.label}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'stroke-[2.4] filter drop-shadow-[0_0_8px_rgba(0,242,254,0.6)]' : 'stroke-[1.8]'
                  }`}
                />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400 light:bg-indigo-600 shadow-[0_0_6px_#00f2fe]" />
                )}
              </div>
              <span
                className={`text-[10px] tracking-tight mt-1 font-medium transition-colors ${
                  isActive ? 'font-semibold text-cyan-400 light:text-indigo-600' : ''
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
