import React, { useState } from 'react';
import {
  Search,
  MoreVertical,
  FileText,
  Code,
  Image as ImageIcon,
  Video,
  Music,
  File,
  Star,
  Download,
  Trash2,
  Edit2,
  MessageSquare,
  Eye,
  WifiOff,
  CheckCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { VaultFile, FilterCategory, SortField } from '../types';

interface FilesScreenProps {
  files: VaultFile[];
  onSelectFile: (file: VaultFile) => void;
  onDeleteFile: (fileId: string) => void;
  onToggleStar: (fileId: string) => void;
  onToggleOfflineCache: (fileId: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  onAskAIAboutFile: (file: VaultFile) => void;
}

export const FilesScreen: React.FC<FilesScreenProps> = ({
  files,
  onSelectFile,
  onDeleteFile,
  onToggleStar,
  onToggleOfflineCache,
  onRenameFile,
  onAskAIAboutFile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const filterTabs: { id: FilterCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'docs', label: 'Docs' },
    { id: 'images', label: 'Images' },
    { id: 'videos', label: 'Videos' },
    { id: 'code', label: 'Code' },
  ];

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getFileIcon = (file: VaultFile) => {
    switch (file.category) {
      case 'pdf':
        return (
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        );
      case 'docx':
        return (
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        );
      case 'markdown':
        return (
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        );
      case 'code':
        return (
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Code className="w-5 h-5" />
          </div>
        );
      case 'image':
        return (
          <div className="w-10 h-10 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 shrink-0">
            <ImageIcon className="w-5 h-5" />
          </div>
        );
      case 'video':
        return (
          <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/30 flex items-center justify-center text-green-400 shrink-0">
            <Video className="w-5 h-5" />
          </div>
        );
      case 'audio':
        return (
          <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
            <Music className="w-5 h-5" />
          </div>
        );
      case 'spreadsheet':
        return (
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        );
      case 'presentation':
        return (
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        );
      case 'ebook':
        return (
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        );
      case 'archive':
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <File className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
            <File className="w-5 h-5" />
          </div>
        );
    }
  };

  // Filter & Sort
  const filteredFiles = files.filter((f) => {
    // Search query
    if (searchQuery) {
      const match = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.extractedText && f.extractedText.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!match) return false;
    }

    // Category
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'docs') return ['pdf', 'docx', 'markdown', 'text'].includes(f.category);
    if (selectedFilter === 'images') return f.category === 'image';
    if (selectedFilter === 'videos') return f.category === 'video';
    if (selectedFilter === 'code') return f.category === 'code';
    return true;
  });

  filteredFiles.sort((a, b) => {
    if (sortField === 'name') return a.name.localeCompare(b.name);
    if (sortField === 'size') return b.size - a.size;
    if (sortField === 'type') return a.category.localeCompare(b.category);
    return b.updatedAt - a.updatedAt;
  });

  const handleDownload = async (file: VaultFile) => {
    try {
      const { getFileBlob } = await import('../services/db');
      const stored = await getFileBlob(file.id);
      const blob =
        stored || new Blob([file.extractedText || ''], { type: file.mimeType });
      const url = file.blobUrl && !stored ? file.blobUrl : URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (!file.blobUrl || stored) URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleStartRename = (file: VaultFile) => {
    setRenamingFileId(file.id);
    setRenameValue(file.name);
    setActiveMenuFileId(null);
  };

  const handleConfirmRename = (fileId: string) => {
    if (renameValue.trim()) {
      onRenameFile(fileId, renameValue.trim());
    }
    setRenamingFileId(null);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
      {/* Search Input Bar */}
      <div className="relative mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files..."
          className="w-full h-11 pl-10 pr-4 rounded-xl text-sm bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 text-slate-100 dark:text-slate-100 light:text-slate-900 border border-slate-800 dark:border-slate-800 light:border-slate-300 focus:border-cyan-400 light:focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 placeholder:text-slate-500"
        />
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
      </div>

      {/* Filter Tabs & Sort Controls */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/50 dark:bg-slate-900/50 light:bg-slate-100 rounded-xl border border-slate-800/60 dark:border-slate-800/60 light:border-slate-200">
          {filterTabs.map((tab) => {
            const isActive = selectedFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedFilter(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm light:bg-indigo-600 light:text-white light:border-transparent'
                    : 'text-slate-400 hover:text-slate-200 light:text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-1 shrink-0 text-xs text-slate-400">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="bg-transparent text-slate-300 dark:text-slate-300 light:text-slate-700 font-medium text-xs border-none focus:outline-none cursor-pointer"
          >
            <option value="date" className="bg-[#090d16] text-white">Recent</option>
            <option value="name" className="bg-[#090d16] text-white">Name</option>
            <option value="size" className="bg-[#090d16] text-white">Size</option>
            <option value="type" className="bg-[#090d16] text-white">Type</option>
          </select>
        </div>
      </div>

      {/* Files List */}
      {filteredFiles.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/20 dark:bg-slate-900/20 light:bg-slate-50 border border-slate-800/60 dark:border-slate-800/60 light:border-slate-200">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700">
            No files found
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {searchQuery ? `No matches for "${searchQuery}"` : 'Upload your first document or code file'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFiles.map((file) => {
            const isMenuOpen = activeMenuFileId === file.id;

            return (
              <div
                key={file.id}
                className="relative group rounded-2xl p-3 bg-slate-900/40 dark:bg-slate-900/40 light:bg-white border border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 hover:border-cyan-500/40 hover:bg-slate-900/60 dark:hover:bg-slate-900/60 light:hover:bg-slate-50 transition-all flex items-center justify-between"
              >
                {/* File Row Body (Click to Preview) */}
                <div
                  onClick={() => onSelectFile(file)}
                  className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer pr-2"
                >
                  {getFileIcon(file)}

                  <div className="flex-1 min-w-0">
                    {renamingFileId === file.id ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename(file.id)}
                          className="px-2 py-0.5 rounded text-xs bg-slate-800 text-white border border-cyan-400 focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleConfirmRename(file.id)}
                          className="text-[10px] bg-cyan-500 text-black px-2 py-0.5 rounded font-bold"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white dark:text-white light:text-slate-900 truncate">
                          {file.name}
                        </h3>
                        {file.isStarred && (
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-400 light:text-slate-500 mt-0.5">
                      <span>{formatFileSize(file.size)}</span>
                      <span>·</span>
                      <span>Modified {formatRelativeTime(file.updatedAt)}</span>
                      {file.isCachedOffline && (
                        <>
                          <span>·</span>
                          <span className="text-[10px] text-cyan-400 light:text-indigo-600 font-medium">
                            Cached Offline
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3-Dots Action Trigger */}
                <div className="relative">
                  <button
                    onClick={() => setActiveMenuFileId(isMenuOpen ? null : file.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white dark:hover:text-white light:hover:text-slate-900 hover:bg-slate-800/80 dark:hover:bg-slate-800/80 light:hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div className="absolute right-0 top-10 z-50 w-48 rounded-xl bg-[#0d121d] dark:bg-[#0d121d] light:bg-white border border-slate-700/80 dark:border-slate-700/80 light:border-slate-200 shadow-2xl py-1 text-xs divide-y divide-slate-800 dark:divide-slate-800 light:divide-slate-100">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            onSelectFile(file);
                            setActiveMenuFileId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-slate-200 dark:text-slate-200 light:text-slate-700 hover:bg-cyan-500/10 hover:text-cyan-400 flex items-center gap-2 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview Document</span>
                        </button>

                        <button
                          onClick={() => {
                            onAskAIAboutFile(file);
                            setActiveMenuFileId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-cyan-300 hover:bg-cyan-500/10 flex items-center gap-2 cursor-pointer font-medium"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat with This File</span>
                        </button>
                      </div>

                      <div className="py-1">
                        <button
                          onClick={() => {
                            onToggleStar(file.id);
                            setActiveMenuFileId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-slate-300 dark:text-slate-300 light:text-slate-700 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                        >
                          <Star className={`w-3.5 h-3.5 ${file.isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                          <span>{file.isStarred ? 'Unstar' : 'Add to Starred'}</span>
                        </button>

                        <button
                          onClick={() => {
                            onToggleOfflineCache(file.id);
                            setActiveMenuFileId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-slate-300 dark:text-slate-300 light:text-slate-700 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                        >
                          <WifiOff className="w-3.5 h-3.5" />
                          <span>{file.isCachedOffline ? 'Remove from Cache' : 'Cache for Offline'}</span>
                        </button>

                        <button
                          onClick={() => {
                            handleDownload(file);
                            setActiveMenuFileId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-slate-300 dark:text-slate-300 light:text-slate-700 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>

                        <button
                          onClick={() => handleStartRename(file)}
                          className="w-full px-3 py-2 text-left text-slate-300 dark:text-slate-300 light:text-slate-700 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Rename</span>
                        </button>
                      </div>

                      <div className="py-1">
                        <button
                          onClick={() => {
                            onDeleteFile(file.id);
                            setActiveMenuFileId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete File</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
