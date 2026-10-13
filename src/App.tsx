import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { FilesScreen } from './components/FilesScreen';
import { ChatScreen } from './components/ChatScreen';
import { SearchScreen } from './components/SearchScreen';
import { HubScreen } from './components/HubScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { UploadModal } from './components/UploadModal';
import { FileViewerModal } from './components/FileViewerModal';
import { CloudflareDeployModal } from './components/CloudflareDeployModal';
import { usePWA } from './hooks/usePWA';
import {
  getAllFiles,
  seedDemoVaultIfNeeded,
  saveFile,
  deleteFile,
  getChatMessages,
  clearChatHistory,
  getSetting,
  setSetting,
} from './services/db';
import { VaultFile, ChatMessage, StorageStats, CloudflareConfig, GuardLevel } from './types';
import { Plus, Upload } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDeployOpen, setIsDeployOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<VaultFile | null>(null);
  const [chatTargetFile, setChatTargetFile] = useState<VaultFile | null>(null);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [cloudflareConfig, setCloudflareConfig] = useState<CloudflareConfig | null>(null);
  const [guardLevel, setGuardLevel] = useState<GuardLevel>(() => {
    const saved = localStorage.getItem('filemind_guard_level');
    return saved === 'off' || saved === 'strict' ? saved : 'standard';
  });

  const { isInstallable, isInstalled, isIOS, isOnline, install } = usePWA();

  // Initialize theme from storage
  useEffect(() => {
    const savedTheme = localStorage.getItem('filemind_theme') as 'dark' | 'light' | null;
    const initial = savedTheme || 'dark';
    setTheme(initial);
    if (initial === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('filemind_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  };

  // Initialize files and chat history from IndexedDB
  useEffect(() => {
    async function loadData() {
      try {
        const seeded = await seedDemoVaultIfNeeded();
        setFiles(seeded);

        const msgs = await getChatMessages();
        setChatMessages(msgs);

        const savedConfig = await getSetting<CloudflareConfig | null>('cf_config', null);
        setCloudflareConfig(savedConfig);

        const savedGuard = await getSetting<GuardLevel>('guard_level', 'standard');
        setGuardLevel(savedGuard);
      } catch (err) {
        console.error('Failed to initialize database:', err);
      }
    }
    loadData();
  }, []);

  // Compute storage statistics
  const totalUsedBytes = files.reduce((acc, f) => acc + f.size, 0);
  const storageStats: StorageStats = {
    usedBytes: totalUsedBytes,
    quotaBytes: 1024 * 1024 * 1024, // 1 GB simulated quota
    filesCount: files.length,
    cachedCount: files.filter((f) => f.isCachedOffline).length,
  };

  // Handlers
  const handleFileUploaded = (newFile: VaultFile) => {
    setFiles((prev) => [newFile, ...prev.filter((f) => f.id !== newFile.id)]);
  };

  const handleDeleteFile = async (fileId: string) => {
    await deleteFile(fileId);
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (viewingFile?.id === fileId) {
      setViewingFile(null);
    }
  };

  const handleToggleStar = async (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    const updated = { ...file, isStarred: !file.isStarred };
    await saveFile(updated);
    setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
  };

  const handleToggleOfflineCache = async (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    const updated = { ...file, isCachedOffline: !file.isCachedOffline };
    await saveFile(updated);
    setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
  };

  const handleRenameFile = async (fileId: string, newName: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    const updated = { ...file, name: newName };
    await saveFile(updated);
    setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
  };

  const handleAskAIAboutFile = (file: VaultFile) => {
    setChatTargetFile(file);
    setViewingFile(null);
    setCurrentTab('chat');
  };

  const handleGlobalSearch = (query: string) => {
    setSearchInitialQuery(query);
    setCurrentTab('search');
  };

  const handleOpenCitationFile = (fileId: string) => {
    const target = files.find((f) => f.id === fileId);
    if (target) {
      setViewingFile(target);
    }
  };

  const handleClearChat = async () => {
    await clearChatHistory();
    setChatMessages([]);
  };

  const handleExportVault = () => {
    const exportData = {
      vaultVersion: '1.0',
      exportedAt: new Date().toISOString(),
      filesCount: files.length,
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        category: f.category,
        extension: f.extension,
        extractedText: f.extractedText,
        metadata: f.metadata,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filemind-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#07090e] dark:bg-[#07090e] light:bg-[#f8fafc] text-slate-100 dark:text-slate-100 light:text-slate-900 transition-colors duration-200">
      {/* Top Mobile Bar */}
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        isOnline={isOnline}
        onOpenDeploy={() => setIsDeployOpen(true)}
        onNavigateHome={() => setCurrentTab('home')}
      />

      {/* Main View Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto">
        {currentTab === 'home' && (
          <HomeScreen
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onOpenUpload={() => setIsUploadOpen(true)}
            onGlobalSearch={handleGlobalSearch}
            theme={theme}
            totalFilesCount={files.length}
          />
        )}

        {currentTab === 'files' && (
          <FilesScreen
            files={files}
            onSelectFile={(file) => setViewingFile(file)}
            onDeleteFile={handleDeleteFile}
            onToggleStar={handleToggleStar}
            onToggleOfflineCache={handleToggleOfflineCache}
            onRenameFile={handleRenameFile}
            onAskAIAboutFile={handleAskAIAboutFile}
          />
        )}

        {currentTab === 'chat' && (
          <ChatScreen
            files={files}
            messages={chatMessages}
            onNewMessage={(msg) => setChatMessages((prev) => [...prev, msg])}
            onClearChat={handleClearChat}
            onOpenCitationFile={handleOpenCitationFile}
            initialTargetFile={chatTargetFile}
            cloudflareConfig={cloudflareConfig}
            guardLevel={guardLevel}
          />
        )}

        {currentTab === 'search' && (
          <SearchScreen
            files={files}
            onSelectFile={(file) => setViewingFile(file)}
            initialQuery={searchInitialQuery}
          />
        )}

        {currentTab === 'hub' && (
          <HubScreen files={files} cloudflareConfig={cloudflareConfig} />
        )}

        {currentTab === 'settings' && (
          <SettingsScreen
            theme={theme}
            onToggleTheme={toggleTheme}
            storageStats={storageStats}
            isInstallable={isInstallable}
            isInstalled={isInstalled}
            isIOS={isIOS}
            onInstallPWA={install}
            onOpenDeploy={() => setIsDeployOpen(true)}
            onExportVault={handleExportVault}
            cloudflareConfig={cloudflareConfig}
            onSaveCloudflareConfig={(cfg) => {
              setCloudflareConfig(cfg);
              setSetting('cf_config', cfg);
            }}
            guardLevel={guardLevel}
            onSaveGuardLevel={(level) => {
              setGuardLevel(level);
              setSetting('guard_level', level);
              localStorage.setItem('filemind_guard_level', level);
            }}
          />
        )}
      </main>

      {/* Floating Upload Action Button on Files screen */}
      {currentTab === 'files' && (
        <button
          onClick={() => setIsUploadOpen(true)}
          className="fixed right-5 bottom-20 z-30 w-13 h-13 rounded-2xl neon-btn-gradient text-white flex items-center justify-center shadow-2xl neon-glow-button hover:scale-105 active:scale-95 transition-all cursor-pointer"
          aria-label="Upload files"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      )}

      {/* Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab !== 'chat') setChatTargetFile(null);
          if (tab !== 'search') setSearchInitialQuery('');
          setCurrentTab(tab);
        }}
      />

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onFileUploaded={handleFileUploaded}
        storageStats={storageStats}
      />

      <FileViewerModal
        file={viewingFile}
        onClose={() => setViewingFile(null)}
        onAskAI={handleAskAIAboutFile}
      />

      <CloudflareDeployModal
        isOpen={isDeployOpen}
        onClose={() => setIsDeployOpen(false)}
      />
    </div>
  );
}
