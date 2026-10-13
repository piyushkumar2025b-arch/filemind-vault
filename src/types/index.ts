export type FileCategory = 
  | 'pdf' 
  | 'docx' 
  | 'markdown' 
  | 'code' 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'text' 
  | 'other';

export interface FileChunk {
  id: string;
  fileId: string;
  fileName: string;
  text: string;
  page?: number;
  line?: number;
}

export interface VaultFile {
  id: string;
  name: string;
  size: number;
  category: FileCategory;
  mimeType: string;
  extension: string;
  updatedAt: number;
  createdAt: number;
  isStarred: boolean;
  isCachedOffline: boolean;
  uploadStatus: 'completed' | 'uploading' | 'queued' | 'failed';
  uploadProgress: number; // 0 - 100
  storageLocation: 'local' | 'cloud' | 'cached';
  extractedText?: string;
  chunks?: FileChunk[];
  metadata?: {
    pageCount?: number;
    dimensions?: { width: number; height: number };
    duration?: number;
    language?: string;
    lineCount?: number;
    wordCount?: number;
    author?: string;
  };
  blobUrl?: string; // in-memory object URL
  dataUrl?: string; // cached data URL or text content
}

export interface ChatCitation {
  fileId: string;
  fileName: string;
  snippet: string;
  pageOrLine?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  citations?: ChatCitation[];
  targetedFileId?: string;
}

export type FilterCategory = 'all' | 'docs' | 'images' | 'videos' | 'code' | 'audio';

export type SortField = 'date' | 'name' | 'size' | 'type';

export interface SearchResult {
  file: VaultFile;
  matchScore: number;
  snippet: string;
  matchedField: 'name' | 'content' | 'metadata';
}

export interface StorageStats {
  usedBytes: number;
  quotaBytes: number;
  filesCount: number;
  cachedCount: number;
}

export interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  aiModel: string;
  r2BucketName: string;
  d1DatabaseId: string;
  workerEndpoint: string;
}
