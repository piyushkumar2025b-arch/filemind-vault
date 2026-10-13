export type FileCategory = 
  | 'pdf' 
  | 'docx' 
  | 'spreadsheet'
  | 'presentation'
  | 'ebook'
  | 'archive'
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
    sheetName?: string;
    rows?: number;
    columns?: number;
    slideCount?: number;
    chapters?: number;
    entries?: number;
  };
  blobUrl?: string; // in-memory object URL
  dataUrl?: string; // cached data URL or text content
}

/** Image attached to a chat message (persisted as dataURL). */
export interface ChatAttachment {
  kind: 'image';
  name: string;
  dataUrl: string;
  analysis?: string; // AI vision description (from /api/vision)
}

/** Live web result returned by /api/websearch (real-time internet access). */
export interface WebResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

export type GuardLevel = 'off' | 'standard' | 'strict';

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
  attachments?: ChatAttachment[];
  voice?: boolean; // message was dictated via speech-to-text
  blocked?: boolean; // stopped by guardrails
  imageUrl?: string; // generated image (dataURL) attached to the message
  webResults?: WebResult[]; // live web sources used for the answer
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
