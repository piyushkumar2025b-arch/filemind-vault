import React, { useState } from 'react';
import {
  Sun,
  Moon,
  Smartphone,
  HardDrive,
  Trash2,
  Download,
  CloudLightning,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Info,
  ExternalLink,
} from 'lucide-react';
import { StorageStats, CloudflareConfig, GuardLevel } from '../types';
import { clearAllLocalCache } from '../services/db';

interface SettingsScreenProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  storageStats: StorageStats;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  onInstallPWA: () => void;
  onOpenDeploy: () => void;
  onExportVault: () => void;
  cloudflareConfig: CloudflareConfig | null;
  onSaveCloudflareConfig: (config: CloudflareConfig) => void;
  guardLevel: GuardLevel;
  onSaveGuardLevel: (level: GuardLevel) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  theme,
  onToggleTheme,
  storageStats,
  isInstallable,
  isInstalled,
  isIOS,
  onInstallPWA,
  onOpenDeploy,
  onExportVault,
  cloudflareConfig,
  onSaveCloudflareConfig,
  guardLevel,
  onSaveGuardLevel,
}) => {
  const [clearingCache, setClearingCache] = useState(false);
  const [clearedNotice, setClearedNotice] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear locally cached binary files?')) return;
    setClearingCache(true);
    await clearAllLocalCache();
    setClearingCache(false);
    setClearedNotice(true);
    setTimeout(() => setClearedNotice(false), 3000);
  };

  const formatMB = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(2);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-28 space-y-5">
      {/* 1. Theme Configuration */}
      <div className="p-4 rounded-2xl bg-slate-900/40 dark:bg-slate-900/40 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 light:text-slate-500 mb-3">
          Appearance & Theme
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-500" />}
            </div>
            <div>
              <div className="text-sm font-bold text-white dark:text-white light:text-slate-900">
                {theme === 'dark' ? 'Futuristic Neon Dark' : 'Crisp Minimal Light'}
              </div>
              <div className="text-xs text-slate-400">
                {theme === 'dark' ? 'Deep dark navy with electric cyan glow' : 'Clean white with refined accents'}
              </div>
            </div>
          </div>

          <button
            onClick={onToggleTheme}
            className="px-4 py-2 rounded-xl bg-slate-800 dark:bg-slate-800 light:bg-slate-100 hover:bg-slate-700 text-xs font-semibold text-white dark:text-white light:text-slate-800 transition-colors cursor-pointer"
          >
            Switch to {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      {/* 2. PWA Installation */}
      <div className="p-4 rounded-2xl bg-slate-900/40 dark:bg-slate-900/40 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 light:text-slate-500 mb-3">
          App Installation (PWA)
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white dark:text-white light:text-slate-900">
                {isInstalled ? 'Installed as Native App' : 'Add to Home Screen'}
              </div>
              <div className="text-xs text-slate-400">
                {isInstalled
                  ? 'Running in standalone mobile viewport'
                  : 'Install for offline access, full-screen UI, and zero browser clutter'}
              </div>
            </div>
          </div>

          {isInstalled ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Installed</span>
            </span>
          ) : isInstallable ? (
            <button
              onClick={onInstallPWA}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              Install App
            </button>
          ) : isIOS ? (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-medium cursor-pointer"
            >
              iOS Guide
            </button>
          ) : (
            <span className="text-xs text-slate-500 font-medium">Available via Browser Menu</span>
          )}
        </div>

        {showIOSGuide && (
          <div className="mt-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-200 space-y-1.5 animate-fade-in">
            <p className="font-bold text-cyan-300">How to install on iOS Safari:</p>
            <p>1. Tap the <strong>Share</strong> button at the bottom of Safari.</p>
            <p>2. Scroll down and tap <strong>Add to Home Screen</strong>.</p>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-2 text-[11px] text-cyan-400 font-bold underline"
            >
              Got it
            </button>
          </div>
        )}
      </div>

      {/* 3. Storage & Cache Management */}
      <div className="p-4 rounded-2xl bg-slate-900/40 dark:bg-slate-900/40 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 light:text-slate-500 mb-3">
          Local Storage & IndexedDB
        </h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-slate-950/40 dark:bg-slate-950/40 light:bg-slate-50 border border-slate-800/60 dark:border-slate-800/60 light:border-slate-200">
            <div className="text-[11px] text-slate-400">Total Indexed Files</div>
            <div className="text-lg font-bold text-white dark:text-white light:text-slate-900 font-mono mt-0.5">
              {storageStats.filesCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/40 dark:bg-slate-950/40 light:bg-slate-50 border border-slate-800/60 dark:border-slate-800/60 light:border-slate-200">
            <div className="text-[11px] text-slate-400">Storage Used</div>
            <div className="text-lg font-bold text-cyan-400 light:text-indigo-600 font-mono mt-0.5">
              {formatMB(storageStats.usedBytes)} MB
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleClearCache}
            disabled={clearingCache}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Local Cache</span>
          </button>

          <button
            onClick={onExportVault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Vault Backup</span>
          </button>
        </div>

        {clearedNotice && (
          <p className="text-xs text-emerald-400 mt-2">Local cache successfully cleared.</p>
        )}
      </div>

      {/* 4. Cloudflare Deployment Overview Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#1e1b4b] border border-cyan-500/30 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CloudLightning className="w-5 h-5 text-orange-400" />
            <h3 className="text-sm font-bold text-white">Cloudflare Edge Architecture</h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40">
            Production Ready
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          FileMind is architected for zero-cost deployment on the Cloudflare Free Tier using Cloudflare Pages, Workers AI, R2 buckets, and D1.
        </p>

        <button
          onClick={onOpenDeploy}
          className="w-full py-2.5 rounded-xl neon-btn-gradient text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
        >
          <span>View Cloudflare Deployment Specs</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 5. AI Safety Guardrails */}
      <div className="p-4 rounded-2xl bg-slate-900/40 dark:bg-slate-900/40 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 light:text-slate-500">
            AI Safety Guardrails
          </h3>
        </div>
        <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
          On-device checks run before every message leaves your browser. Blocks harmful requests,
          prompt-injection attempts, and warns on detected secrets or personal data.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'off', label: 'Off', desc: 'No filtering' },
              { id: 'standard', label: 'Standard', desc: 'Block unsafe' },
              { id: 'strict', label: 'Strict', desc: 'Block + secrets' },
            ] as { id: GuardLevel; label: string; desc: string }[]
          ).map((lvl) => (
            <button
              key={lvl.id}
              onClick={() => onSaveGuardLevel(lvl.id)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                guardLevel === lvl.id
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-50 border-slate-800 dark:border-slate-800 light:border-slate-200 text-slate-400'
              }`}
            >
              {guardLevel === lvl.id ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>{lvl.label}</span>
              <span className="text-[9px] font-normal text-slate-500">{lvl.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 6. Privacy Notice */}
      <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
        <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-200">Zero-Trust Personal Vault:</span>
          <p className="mt-0.5 text-[11px] leading-relaxed">
            Your documents remain stored exclusively on your device's IndexedDB and your private Cloudflare account. No unauthorized third-party telemetry or AI tracking.
          </p>
        </div>
      </div>
    </div>
  );
};
