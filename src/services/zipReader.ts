/**
 * FileMind ZIP Reader — minimal, dependency-free OOXML/ZIP container reader.
 *
 * Enables real parsing of .xlsx / .pptx / .epub / .odt / .ods files in the
 * browser: walks the central directory, then inflates entries with
 * DecompressionStream('deflate-raw'). No external libraries required.
 */

export interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  method: number; // 0 = stored, 8 = deflate
  localOffset: number;
}

const textDecoder = new TextDecoder('utf-8');

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as any).DecompressionStream;
  if (!DS) return bytes; // no inflate support — caller falls back
  const stream = new DS('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const buf = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(buf);
}

function findEOCD(view: DataView): number {
  // End of central directory record: scan back from the end for the signature
  for (let i = view.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}

/** Parse the ZIP central directory. Throws if the buffer is not a ZIP. */
export function readZipIndex(buffer: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buffer);
  const eocd = findEOCD(view);
  if (eocd < 0) throw new Error('Not a ZIP archive (no end-of-central-directory found)');
  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const uncompressedSize = view.getUint32(ptr + 24, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = textDecoder.decode(new Uint8Array(buffer, ptr + 46, nameLen));
    entries.push({ name, compressedSize, uncompressedSize, method, localOffset });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Read one entry's raw bytes from the archive. */
export async function readZipFile(buffer: ArrayBuffer, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(buffer);
  const nameLen = view.getUint16(entry.localOffset + 26, true);
  const extraLen = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLen + extraLen;
  const raw = new Uint8Array(buffer, start, entry.compressedSize);
  if (entry.method === 0) return raw;
  if (entry.method === 8) {
    try {
      return await inflateRaw(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/** Read + UTF-8 decode one entry as text. */
export async function readZipText(buffer: ArrayBuffer, entry: ZipEntry): Promise<string> {
  return textDecoder.decode(await readZipFile(buffer, entry));
}

/** List user-facing entries (no folders / macOS metadata). */
export function listFiles(buffer: ArrayBuffer): ZipEntry[] {
  try {
    return readZipIndex(buffer).filter((e) => !e.name.endsWith('/') && !e.name.startsWith('__MACOSX'));
  } catch {
    return [];
  }
}
