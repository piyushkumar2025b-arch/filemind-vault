import { VaultFile, ChatMessage, FileCategory, CloudflareConfig } from '../types';

const DB_NAME = 'filemind_vault_v1';
const DB_VERSION = 1;

interface DBSchema {
  files: VaultFile;
  blobs: { id: string; blob: Blob; mimeType: string };
  chat: ChatMessage;
  settings: { key: string; value: any };
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('chat')) {
        db.createObjectStore('chat', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// File operations
export async function getAllFiles(): Promise<VaultFile[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readonly');
    const store = tx.objectStore('files');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getFile(id: string): Promise<VaultFile | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readonly');
    const store = tx.objectStore('files');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFile(file: VaultFile, blob?: Blob): Promise<void> {
  const db = await openDB();
  // Never persist in-memory blob: URLs — they die on reload and break
  // preview/download for every file loaded back from IndexedDB.
  const { blobUrl: _dropped, ...storable } = file;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['files', 'blobs'], 'readwrite');
    tx.objectStore('files').put(storable as VaultFile);
    if (blob) {
      tx.objectStore('blobs').put({ id: file.id, blob, mimeType: file.mimeType });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteFile(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['files', 'blobs'], 'readwrite');
    tx.objectStore('files').delete(id);
    tx.objectStore('blobs').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFileBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blobs', 'readonly');
    const store = tx.objectStore('blobs');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result ? request.result.blob : null);
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllLocalCache(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['blobs'], 'readwrite');
    tx.objectStore('blobs').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Chat operations
export async function getChatMessages(): Promise<ChatMessage[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chat', 'readonly');
    const store = tx.objectStore('chat');
    const request = store.getAll();
    request.onsuccess = () => {
      const messages: ChatMessage[] = request.result || [];
      messages.sort((a, b) => a.timestamp - b.timestamp);
      resolve(messages);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveChatMessage(message: ChatMessage): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chat', 'readwrite');
    tx.objectStore('chat').put(message);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearChatHistory(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chat', 'readwrite');
    tx.objectStore('chat').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Settings
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.get(key);
      request.onsuccess = () => {
        resolve(request.result !== undefined ? request.result.value : defaultValue);
      };
      request.onerror = () => resolve(defaultValue);
    });
  } catch {
    return defaultValue;
  }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Seed Initial Files from Screenshot
export async function seedDemoVaultIfNeeded(): Promise<VaultFile[]> {
  const existing = await getAllFiles();
  if (existing.length > 0) return existing;

  const now = Date.now();
  const hour = 3600 * 1000;
  const day = 24 * hour;

  const sampleFiles: VaultFile[] = [
    {
      id: 'demo-notes-md',
      name: 'Project-Notes.md',
      size: 2450,
      category: 'markdown',
      mimeType: 'text/markdown',
      extension: 'md',
      updatedAt: now - 2 * hour,
      createdAt: now - 2 * day,
      isStarred: true,
      isCachedOffline: true,
      uploadStatus: 'completed',
      uploadProgress: 100,
      storageLocation: 'cached',
      extractedText: `# Project Notes

## 1. Overview
- Build a simple file manager with AI support
- Deploy on Cloudflare
- Offline access (PWA)

## 2. Tech Stack
- HTML / CSS / JS / React + Vite
- Cloudflare Workers (Workers AI, R2, D1)
- PWA + IndexedDB for offline resilience

## 3. Next Steps
- Implement file upload
- Add search functionality
- Integrate AI chat
- Test offline airplane mode caching

## 4. Architecture Decisions
- Mobile-first responsive viewport with edge-to-edge layout
- Futuristic neon theme: deep dark navy background, electric cyan, purple, and magenta accents
- Private personal file vault: safe parsing, client-side indexing, RAG chunking`,
      chunks: [
        {
          id: 'chunk-1',
          fileId: 'demo-notes-md',
          fileName: 'Project-Notes.md',
          text: 'Build a simple file manager with AI support. Deploy on Cloudflare. Offline access (PWA).',
          line: 4,
        },
        {
          id: 'chunk-2',
          fileId: 'demo-notes-md',
          fileName: 'Project-Notes.md',
          text: 'Tech Stack: HTML, CSS, JS, React + Vite, Cloudflare Workers (Workers AI, R2, D1), PWA + IndexedDB for offline resilience.',
          line: 8,
        },
        {
          id: 'chunk-3',
          fileId: 'demo-notes-md',
          fileName: 'Project-Notes.md',
          text: 'Architecture Decisions: Mobile-first responsive viewport with edge-to-edge layout, futuristic neon theme with deep dark navy background and cyan/purple accents.',
          line: 18,
        },
      ],
      metadata: {
        lineCount: 22,
        wordCount: 88,
      },
    },
    {
      id: 'demo-app-py',
      name: 'app.py',
      size: 12800,
      category: 'code',
      mimeType: 'text/x-python',
      extension: 'py',
      updatedAt: now - 3 * hour,
      createdAt: now - 3 * day,
      isStarred: true,
      isCachedOffline: true,
      uploadStatus: 'completed',
      uploadProgress: 100,
      storageLocation: 'cached',
      extractedText: `"""
FileMind Core Server Pipeline
Cloudflare Worker & Local Python Microservice Bridge
"""

def hello_world():
    print("Hello, World!")

def process_file_metadata(file_name: str, file_size: int) -> dict:
    """Extract clean metadata and categorize file."""
    extension = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else ''
    category_map = {
        'pdf': 'pdf',
        'docx': 'docx',
        'md': 'markdown',
        'py': 'code',
        'ts': 'code',
        'png': 'image',
        'jpg': 'image',
        'mp4': 'video'
    }
    return {
        "status": "ready",
        "file": file_name,
        "category": category_map.get(extension, "other"),
        "size_kb": round(file_size / 1024, 2)
    }

if __name__ == "__main__":
    hello_world()
    sample = process_file_metadata("Project-Notes.pdf", 2100000)
    print(f"File verified: {sample}")
`,
      chunks: [
        {
          id: 'chunk-py-1',
          fileId: 'demo-app-py',
          fileName: 'app.py',
          text: 'def hello_world(): print("Hello, World!") - Entry greeting function.',
          line: 6,
        },
        {
          id: 'chunk-py-2',
          fileId: 'demo-app-py',
          fileName: 'app.py',
          text: 'process_file_metadata(file_name: str, file_size: int) categorizes extensions into pdf, docx, markdown, code, image, video.',
          line: 9,
        },
      ],
      metadata: {
        language: 'python',
        lineCount: 32,
      },
    },
    {
      id: 'demo-design-ui',
      name: 'Design-UI.png',
      size: 1250000,
      category: 'image',
      mimeType: 'image/png',
      extension: 'png',
      updatedAt: now - 5 * hour,
      createdAt: now - 4 * day,
      isStarred: false,
      isCachedOffline: true,
      uploadStatus: 'completed',
      uploadProgress: 100,
      storageLocation: 'cached',
      extractedText: 'Design-UI mockup with neon cyan, electric violet highlights, and clean typography.',
      dataUrl: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="100%" height="100%">
          <defs>
            <linearGradient id="bgG" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#07090e"/>
              <stop offset="50%" stop-color="#0f172a"/>
              <stop offset="100%" stop-color="#1e1035"/>
            </linearGradient>
            <linearGradient id="cyanPurple" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#00f2fe"/>
              <stop offset="50%" stop-color="#7f00ff"/>
              <stop offset="100%" stop-color="#e100ff"/>
            </linearGradient>
          </defs>
          <rect width="1200" height="800" fill="url(#bgG)"/>
          <circle cx="300" cy="400" r="220" fill="#00f2fe" opacity="0.12" filter="blur(60px)"/>
          <circle cx="900" cy="350" r="260" fill="#e100ff" opacity="0.12" filter="blur(70px)"/>
          <!-- Neon Waves -->
          <path d="M 0 650 Q 300 520, 600 640 T 1200 580" fill="none" stroke="url(#cyanPurple)" stroke-width="6" opacity="0.8"/>
          <path d="M 0 710 Q 350 620, 700 700 T 1200 660" fill="none" stroke="#00f2fe" stroke-width="3" opacity="0.5"/>
          <!-- UI card mock -->
          <rect x="250" y="160" width="700" height="440" rx="24" fill="#0d1322" stroke="rgba(0,242,254,0.3)" stroke-width="2"/>
          <circle cx="600" cy="270" r="50" fill="url(#cyanPurple)"/>
          <text x="600" y="380" font-family="system-ui, sans-serif" font-size="34" font-weight="bold" fill="#ffffff" text-anchor="middle">FileMind Mobile Architecture</text>
          <text x="600" y="420" font-family="system-ui, sans-serif" font-size="18" fill="#94a3b8" text-anchor="middle">Neon Aesthetics • Cloudflare Workers • Offline PWA</text>
        </svg>
      `),
      metadata: {
        dimensions: { width: 1200, height: 800 },
      },
    },
    {
      id: 'demo-meeting-rec',
      name: 'Meeting-Recording.mp4',
      size: 34600000,
      category: 'video',
      mimeType: 'video/mp4',
      extension: 'mp4',
      updatedAt: now - 1 * day,
      createdAt: now - 5 * day,
      isStarred: false,
      isCachedOffline: true,
      uploadStatus: 'completed',
      uploadProgress: 100,
      storageLocation: 'cached',
      extractedText: 'Meeting recording: Team discussion regarding Cloudflare R2 bucket integration, D1 indexing schema, and zero-latency PWA offline sync.',
      chunks: [
        {
          id: 'chunk-vid-1',
          fileId: 'demo-meeting-rec',
          fileName: 'Meeting-Recording.mp4',
          text: 'Discussion covering Cloudflare R2 bucket storage integration, zero public access authorization, and D1 indexing schema.',
          line: 1,
        },
      ],
      metadata: {
        duration: 84, // 1m 24s
      },
    },
    {
      id: 'demo-research-paper',
      name: 'Research-Paper.pdf',
      size: 2100000,
      category: 'pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
      updatedAt: now - 1 * day,
      createdAt: now - 6 * day,
      isStarred: true,
      isCachedOffline: true,
      uploadStatus: 'completed',
      uploadProgress: 100,
      storageLocation: 'cached',
      extractedText: `RESEARCH PAPER: HIGH-PERFORMANCE CLIENT-SIDE VECTOR SEARCH IN OFFLINE PWAs

Author: Dr. Elena Vance
Date: October 2026
Abstract:
Modern Progressive Web Applications (PWAs) increasingly demand offline-capable intelligent retrieval. This paper presents an ergonomic method for running localized semantic search and chunked document indexing inside browser memory and IndexedDB.

Section 1. Introduction
Traditional cloud search architectures rely on remote endpoints for each query. In high-latency or disconnected scenarios (such as subway commutes or flight mode), users lose access to their document search capability. By performing text tokenization, chunking, and similarity ranking directly on the client device, query latency drops below 8 milliseconds.

Section 2. Document Chunking Strategy
Documents are partitioned into overlapping windows of 350 characters with a 50-character stride. Each chunk retains source document metadata, including section headings, page index, and line numbers.

Section 3. Retrieval Accuracy
Tests across 1,000 PDF documents demonstrate a 94.6% recall rate for factual cross-document queries when using BM25 and keyword frequency weighting combined with semantic cosine filtering.

Section 4. Conclusion
Client-side indexing paired with Cloudflare Workers AI creates an optimal hybrid architecture: instant offline search with cloud LLM summarization when online.`,
      chunks: [
        {
          id: 'chunk-pdf-1',
          fileId: 'demo-research-paper',
          fileName: 'Research-Paper.pdf',
          text: 'Abstract: Modern PWAs demand offline-capable intelligent retrieval using localized semantic search and chunked document indexing in IndexedDB.',
          page: 1,
        },
        {
          id: 'chunk-pdf-2',
          fileId: 'demo-research-paper',
          fileName: 'Research-Paper.pdf',
          text: 'Section 2. Chunking Strategy: Documents are partitioned into overlapping windows of 350 characters with 50-character stride, retaining section headings and page indices.',
          page: 2,
        },
        {
          id: 'chunk-pdf-3',
          fileId: 'demo-research-paper',
          fileName: 'Research-Paper.pdf',
          text: 'Section 4. Conclusion: Client-side indexing paired with Cloudflare Workers AI creates optimal hybrid architecture: instant offline search with cloud LLM summarization.',
          page: 3,
        },
      ],
      metadata: {
        pageCount: 3,
        author: 'Dr. Elena Vance',
      },
    },
    {
      id: 'demo-resume-docx',
      name: 'Resume.docx',
      size: 856000,
      category: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
      updatedAt: now - 2 * day,
      createdAt: now - 7 * day,
      isStarred: false,
      isCachedOffline: true,
      uploadStatus: 'completed',
      uploadProgress: 100,
      storageLocation: 'cached',
      extractedText: `ALEX RIVERA — PRINCIPAL FULL-STACK & CLOUD ARCHITECT

Contact: alex.rivera@techvault.io | San Francisco, CA | github.com/arivera

SUMMARY:
Staff Cloud & Mobile Engineer with 8+ years building edge-first distributed systems, PWA architectures, Cloudflare Workers, and intelligent personal file vaults.

EXPERIENCE:
Principal Engineer — CloudEdge Technologies (2023 - Present)
- Architected zero-trust personal knowledge storage supporting 500,000 active users.
- Reduced edge API latency by 68% using Cloudflare Workers and R2 bucket caching.
- Spearheaded PWA implementation with offline IndexedDB synchronization and background sync.

Lead Frontend Engineer — VaultIQ (2020 - 2023)
- Built high-performance multi-document preview engine supporting PDF, DOCX, Code, and video streams.
- Designed dark-neon futuristic UI design system using Tailwind CSS and ergonomic mobile navigation.

TECHNICAL SKILLS:
Languages: TypeScript, JavaScript, Python, Go, SQL, HTML5, CSS3
Frameworks: React 19, Vite, Tailwind CSS, Next.js, Express
Cloud & Edge: Cloudflare Workers, R2, D1, Workers AI, Pages, AWS S3
Storage: IndexedDB, SQLite, PostgreSQL, Redis`,
      chunks: [
        {
          id: 'chunk-docx-1',
          fileId: 'demo-resume-docx',
          fileName: 'Resume.docx',
          text: 'Alex Rivera — Principal Full-Stack & Cloud Architect. 8+ years building edge-first distributed systems, Cloudflare Workers, and personal file vaults.',
          line: 1,
        },
        {
          id: 'chunk-docx-2',
          fileId: 'demo-resume-docx',
          fileName: 'Resume.docx',
          text: 'CloudEdge Experience: Reduced edge API latency by 68% using Cloudflare Workers and R2. Spearheaded PWA with offline IndexedDB synchronization.',
          line: 8,
        },
        {
          id: 'chunk-docx-3',
          fileId: 'demo-resume-docx',
          fileName: 'Resume.docx',
          text: 'Skills: TypeScript, Python, Go, React, Vite, Tailwind, Cloudflare Workers, R2, D1, Workers AI, IndexedDB.',
          line: 18,
        },
      ],
      metadata: {
        wordCount: 165,
      },
    },
  ];

  for (const f of sampleFiles) {
    // Also generate sample text or svg blob so blob download works out of the box
    const blobContent = f.extractedText || 'File content for ' + f.name;
    const blob = new Blob([blobContent], { type: f.mimeType });
    await saveFile(f, blob);
  }

  return sampleFiles;
}
