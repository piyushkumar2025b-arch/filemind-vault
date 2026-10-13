import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Cloud,
  FileText,
  Code,
  Image as ImageIcon,
  Video,
  Music,
  File,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  Camera,
} from 'lucide-react';
import { parseUploadedFile } from '../services/documentParser';
import { saveFile } from '../services/db';
import { VaultFile, StorageStats } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileUploaded: (file: VaultFile) => void;
  storageStats: StorageStats;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onFileUploaded,
  storageStats,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadSuccessName, setUploadSuccessName] = useState('');

  if (!isOpen) return null;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsProcessing(true);
    setErrorMsg('');
    setUploadSuccessName('');

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setProgressMsg(`Parsing & indexing ${file.name}...`);
      try {
        const { vaultFile, blob } = await parseUploadedFile(file);
        await saveFile(vaultFile, blob);
        onFileUploaded(vaultFile);
        setUploadSuccessName(file.name);
      } catch (err: any) {
        console.error('File upload error:', err);
        setErrorMsg(`Failed to process ${file.name}: ${err.message || 'Unknown error'}`);
      }
    }

    setIsProcessing(false);
    setProgressMsg('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const formatStorageMB = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  const storagePercentage = Math.min(100, Math.round((storageStats.usedBytes / storageStats.quotaBytes) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#090d16] dark:bg-[#090d16] light:bg-white rounded-3xl border border-slate-800 dark:border-slate-800 light:border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800/60 dark:bg-slate-800/60 light:bg-slate-100 flex items-center justify-center text-slate-300 hover:text-white dark:text-slate-300 light:text-slate-600 transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-base font-bold text-white dark:text-white light:text-slate-900 leading-none">
                Upload Files
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-500 mt-1">
                Drag & drop files or tap to upload
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Hidden File Inputs */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFiles(e.target.files)}
            multiple
            className="hidden"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={(e) => handleFiles(e.target.files)}
            accept="image/*,video/*"
            capture="environment"
            className="hidden"
          />

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center transition-all duration-200 ${
              isDragging
                ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                : 'border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 bg-slate-900/30 dark:bg-slate-900/30 light:bg-slate-50/50 hover:border-slate-600'
            }`}
          >
            {/* Cloud Icon */}
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-3">
              <Cloud className="w-8 h-8 text-cyan-400" />
            </div>

            <p className="text-sm font-semibold text-slate-200 dark:text-slate-200 light:text-slate-800 mb-2">
              Drag & drop files here
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-500 mb-4">
              or
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-xs shadow-md hover:from-cyan-400 hover:to-blue-500 active:scale-95 transition-all cursor-pointer"
              >
                Choose Files
              </button>

              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={isProcessing}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-800 light:bg-slate-200 text-slate-200 dark:text-slate-200 light:text-slate-700 hover:bg-slate-700 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 text-xs"
                title="Capture with camera"
              >
                <Camera className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Camera</span>
              </button>
            </div>
          </div>

          {/* Processing / Success / Error Feedback */}
          {isProcessing && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span className="text-xs font-medium">{progressMsg}</span>
            </div>
          )}

          {uploadSuccessName && !isProcessing && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="text-xs font-medium">Successfully added {uploadSuccessName}!</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-xs font-medium">{errorMsg}</span>
            </div>
          )}

          {/* Supported Formats Grid (Matches Screenshot) */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-400 light:text-slate-500 mb-3 uppercase tracking-wider">
              Supported Formats
            </h3>

            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="p-2 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 flex flex-col items-center">
                <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center text-red-400 mb-1">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700">PDF</span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 flex flex-col items-center">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400 mb-1">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700">DOCX</span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 flex flex-col items-center">
                <div className="w-8 h-8 rounded-lg bg-slate-500/15 flex items-center justify-center text-slate-400 mb-1">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700">TXT</span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 flex flex-col items-center">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400 mb-1">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700">MD</span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 flex flex-col items-center">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 mb-1">
                  <Code className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700">Code</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center mt-2">
              <div className="p-2 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 flex flex-col items-center">
                <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center text-fuchsia-400 mb-1">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700">Images</span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 flex flex-col items-center">
                <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400 mb-1">
                  <Video className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700">Video</span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 flex flex-col items-center">
                <div className="w-8 h-8 rounded-lg bg-pink-500/15 flex items-center justify-center text-pink-400 mb-1">
                  <Music className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700">Audio</span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 flex flex-col items-center">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 mb-1">
                  <File className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700">Other</span>
              </div>
            </div>
          </div>

          {/* Storage Bar (Matches Screenshot: Storage: 245 MB / 1 GB) */}
          <div className="p-4 rounded-2xl bg-slate-900/40 dark:bg-slate-900/40 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-200">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium text-slate-400 dark:text-slate-400 light:text-slate-600">Storage:</span>
              <span className="font-bold text-white dark:text-white light:text-slate-900">
                <span className="text-cyan-400 light:text-indigo-600">{formatStorageMB(storageStats.usedBytes)} MB</span> / 1 GB
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-slate-800 dark:bg-slate-800 light:bg-slate-300 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 transition-all duration-300"
                style={{ width: `${Math.max(5, storagePercentage)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
