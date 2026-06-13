// Project workspace backed by a real local folder (File System Access API).
//
// Structure under the user-picked root folder:
//   <root>/<project>/images
//   <root>/<project>/videos
//   <root>/<project>/storyboard
//   <root>/<project>/project.json   (prompts + storyboard order + metadata)
//
// Supported in Chromium browsers (Chrome/Edge). On Firefox/Safari the API is
// absent — callers should feature-detect with `fsAccessSupported()` and fall
// back to ZIP download (see lib/zipExport.ts).

import type { GalleryItem } from "./storage";

// Minimal structural types so we don't depend on lib.dom's experimental defs.
type DirHandle = {
  name: string;
  kind: "directory";
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileHandle>;
  removeEntry?(name: string, opts?: { recursive?: boolean }): Promise<void>;
  entries(): AsyncIterableIterator<[string, DirHandle | FileHandle]>;
  queryPermission?(opts?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(opts?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
};
type FileHandle = {
  name: string;
  kind: "file";
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }>;
};

export interface ProjectMeta {
  name: string;
  updatedAt: number;
}

export function fsAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

// ---- IndexedDB: persist the root directory handle across reloads ----
const DB_NAME = "fal-studio-fs";
const STORE = "handles";
const ROOT_KEY = "root";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, val: unknown) {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key: string) {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Permission helpers ----
// Query only — safe to call on load (no user gesture needed).
async function queryGranted(handle: DirHandle): Promise<boolean> {
  const opts = { mode: "readwrite" as const };
  if (!handle.queryPermission) return true;
  return (await handle.queryPermission(opts)) === "granted";
}

// Request permission — MUST be called from a user gesture (button click),
// otherwise the browser throws SecurityError ("User activation is required").
async function ensurePermission(handle: DirHandle): Promise<boolean> {
  if (await queryGranted(handle)) return true;
  const opts = { mode: "readwrite" as const };
  try {
    if (handle.requestPermission && (await handle.requestPermission(opts)) === "granted") {
      return true;
    }
  } catch {
    // SecurityError if called without a user gesture — caller should retry from a click.
    return false;
  }
  return false;
}

// ---- Root folder ----
export async function pickRoot(): Promise<DirHandle | null> {
  const picker = (window as unknown as {
    showDirectoryPicker(opts?: { mode?: string; id?: string }): Promise<DirHandle>;
  }).showDirectoryPicker;
  try {
    const handle = await picker({ mode: "readwrite", id: "fal-studio-root" });
    await idbSet(ROOT_KEY, handle);
    return handle;
  } catch {
    return null; // user cancelled
  }
}

// Result of trying to re-attach a saved root folder on load.
export type RestoreState =
  | { status: "none" } // no saved folder
  | { status: "ready"; handle: DirHandle } // saved + permission already granted
  | { status: "needs-reconnect" }; // saved but needs a click to re-grant permission

// Safe to call on page load: only QUERIES permission, never requests it.
export async function restoreRootSilent(): Promise<RestoreState> {
  const handle = await idbGet<DirHandle>(ROOT_KEY);
  if (!handle) return { status: "none" };
  try {
    if (await queryGranted(handle)) return { status: "ready", handle };
  } catch {
    // Handle may be stale/invalid — fall through to needing reconnect.
  }
  return { status: "needs-reconnect" };
}

// Call this from a BUTTON CLICK to re-grant permission on the saved folder.
// Returns null if permission denied or the folder no longer exists.
export async function reconnectRoot(): Promise<DirHandle | null> {
  const handle = await idbGet<DirHandle>(ROOT_KEY);
  if (!handle) return null;
  try {
    const ok = await ensurePermission(handle);
    if (!ok) return null;
    // Verify the folder still exists (user may have deleted it).
    await listProjects(handle);
    return handle;
  } catch {
    // Folder was deleted/moved — forget the stale handle so the user re-picks.
    await idbDelete(ROOT_KEY);
    return null;
  }
}

// Forget the saved root (e.g. after the folder was deleted on disk).
export async function forgetRoot() {
  await idbDelete(ROOT_KEY);
}

// ---- Projects ----
export async function listProjects(root: DirHandle): Promise<string[]> {
  const names: string[] = [];
  for await (const [name, handle] of root.entries()) {
    if (handle.kind === "directory") names.push(name);
  }
  return names.sort();
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "Untitled";
}

export async function openProject(root: DirHandle, rawName: string): Promise<DirHandle> {
  const name = sanitize(rawName);
  const proj = await root.getDirectoryHandle(name, { create: true });
  // Ensure the standard subfolders exist.
  await proj.getDirectoryHandle("images", { create: true });
  await proj.getDirectoryHandle("videos", { create: true });
  await proj.getDirectoryHandle("storyboard", { create: true });
  return proj;
}

// ---- Saving media ----
function extFor(item: GalleryItem): string {
  try {
    const m = /\.(\w{2,4})(?:\?|$)/.exec(new URL(item.url).pathname);
    if (m) return m[1];
  } catch {
    /* ignore */
  }
  return item.kind === "video" || item.kind === "i2v" ? "mp4" : "png";
}

async function writeBlob(dir: DirHandle, filename: string, blob: Blob) {
  const fh = await dir.getFileHandle(filename, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
}

export interface SaveResult {
  saved: number;
  failed: number;
}

// Fetch each item's bytes from fal's CDN and write into images/ or videos/.
export async function saveItemsToProject(
  project: DirHandle,
  items: GalleryItem[],
): Promise<SaveResult> {
  const imagesDir = await project.getDirectoryHandle("images", { create: true });
  const videosDir = await project.getDirectoryHandle("videos", { create: true });
  let saved = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const blob = await res.blob();
      const isVideo = item.kind === "video" || item.kind === "i2v";
      const dir = isVideo ? videosDir : imagesDir;
      await writeBlob(dir, `${item.id}.${extFor(item)}`, blob);
      saved++;
    } catch {
      failed++;
    }
  }
  return { saved, failed };
}

// Persist prompts + storyboard order as project.json.
export async function saveProjectMeta(
  project: DirHandle,
  data: { storyboard: GalleryItem[]; prompts: unknown },
) {
  await writeBlob(
    project,
    "project.json",
    new Blob([JSON.stringify({ ...data, updatedAt: Date.now() }, null, 2)], {
      type: "application/json",
    }),
  );
}

// Read back the images in a project's images/ folder as object URLs for preview.
export interface SavedImage {
  name: string;
  url: string; // object URL — caller should revoke when done
}

export async function listProjectImages(project: DirHandle): Promise<SavedImage[]> {
  const out: SavedImage[] = [];
  const imagesDir = await project.getDirectoryHandle("images", { create: true });
  for await (const [name, handle] of imagesDir.entries()) {
    if (handle.kind === "file") {
      const file = await (handle as FileHandle).getFile();
      out.push({ name, url: URL.createObjectURL(file) });
    }
  }
  return out;
}
