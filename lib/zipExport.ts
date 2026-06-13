// Minimal zero-dependency ZIP writer (STORE method — no compression).
//
// Used as the fallback for browsers without the File System Access API
// (Firefox/Safari): instead of writing into a folder, we bundle the selected
// media into a single .zip the user downloads. STORE is ideal here because
// images/videos are already compressed, so deflate would add cost for ~0 gain.

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

// CRC-32 (IEEE) — required by the ZIP format.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function strBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function buildZip(entries: ZipEntry[]): Blob {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = strBytes(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // Local file header (30 bytes + name)
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // method = STORE
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // compressed size
    lv.setUint32(22, size, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra len
    local.set(nameBytes, 30);

    chunks.push(local, entry.data);

    // Central directory record (46 bytes + name)
    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true); // signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true); // method
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra
    cv.setUint16(32, 0, true); // comment
    cv.setUint16(34, 0, true); // disk
    cv.setUint16(36, 0, true); // internal attrs
    cv.setUint32(38, 0, true); // external attrs
    cv.setUint32(42, offset, true); // local header offset
    cen.set(nameBytes, 46);
    central.push(cen);

    offset += local.length + entry.data.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);

  // End of central directory (22 bytes)
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  // Cast through ArrayBuffer-backed views so TS accepts them as BlobParts.
  const parts: BlobPart[] = [...chunks, ...central, end].map(
    (u) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer,
  );
  return new Blob(parts, { type: "application/zip" });
}

import type { GalleryItem } from "./storage";

function extFor(item: GalleryItem): string {
  try {
    const m = /\.(\w{2,4})(?:\?|$)/.exec(new URL(item.url).pathname);
    if (m) return m[1];
  } catch {
    /* ignore */
  }
  return item.kind === "video" || item.kind === "i2v" ? "mp4" : "png";
}

// Fetch selected items and bundle them into a downloaded zip, foldered by type.
export async function zipAndDownload(
  items: GalleryItem[],
  projectName: string,
): Promise<{ saved: number; failed: number }> {
  const entries: ZipEntry[] = [];
  let failed = 0;
  for (const item of items) {
    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      const sub = item.kind === "video" || item.kind === "i2v" ? "videos" : "images";
      entries.push({ name: `${sub}/${item.id}.${extFor(item)}`, data: buf });
    } catch {
      failed++;
    }
  }
  if (entries.length > 0) {
    const blob = buildZip(entries);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName || "fal-project"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return { saved: entries.length, failed };
}
