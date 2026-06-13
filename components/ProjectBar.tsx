"use client";

import { useEffect, useState } from "react";
import type { GalleryItem } from "@/lib/storage";
import {
  fsAccessSupported,
  pickRoot,
  restoreRootSilent,
  reconnectRoot,
  forgetRoot,
  listProjects,
  openProject,
  saveItemsToProject,
  saveProjectMeta,
  listProjectImages,
  type SavedImage,
} from "@/lib/projects";
import { zipAndDownload } from "@/lib/zipExport";

// Loosely-typed directory handle (see lib/projects.ts).
type DirHandle = Awaited<ReturnType<typeof pickRoot>>;

interface ProjectBarProps {
  gallery: GalleryItem[];
  storyboard: GalleryItem[];
  prompts: unknown;
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onNewProject: () => void;
  onInsertImage: (url: string, name: string) => void;
}

export default function ProjectBar({
  gallery,
  storyboard,
  prompts,
  selectedIds,
  onClearSelection,
  onNewProject,
  onInsertImage,
}: ProjectBarProps) {
  const [root, setRoot] = useState<DirHandle>(null);
  const [project, setProject] = useState<DirHandle>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [showInsert, setShowInsert] = useState(false);
  // True when a folder was saved before but the browser needs a click to re-grant
  // permission (it cannot be requested automatically on load).
  const [needsReconnect, setNeedsReconnect] = useState(false);
  // Feature detection touches `window`, so it must not run during SSR — gate it
  // behind a mount flag to keep the first client render identical to the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const supported = mounted && fsAccessSupported();

  // On load: only QUERY permission (never request — that needs a user gesture).
  useEffect(() => {
    if (!supported) return;
    restoreRootSilent().then((state) => {
      if (state.status === "ready") {
        setRoot(state.handle);
        listProjects(state.handle).then(setProjects).catch(() => setProjects([]));
      } else if (state.status === "needs-reconnect") {
        setNeedsReconnect(true);
      }
    });
  }, [supported]);

  // Triggered by a button click, so requestPermission is allowed.
  async function handleReconnect() {
    setBusy("Reconnecting…");
    const h = await reconnectRoot();
    if (h) {
      setRoot(h);
      setNeedsReconnect(false);
      setProjects(await listProjects(h).catch(() => []));
      setBusy(null);
    } else {
      // Folder was deleted or permission denied — forget it and start over.
      await forgetRoot();
      setNeedsReconnect(false);
      setRoot(null);
      setProject(null);
      setBusy("Folder unavailable — choose a new one");
      setTimeout(() => setBusy(null), 3000);
    }
  }

  async function handlePickRoot() {
    const h = await pickRoot();
    if (!h) return;
    setRoot(h);
    setProject(null);
    const existing = await listProjects(h);
    setProjects(existing);
    // One smooth flow: right after picking the folder, ask for a project name
    // and create it (with its images/videos/storyboard subfolders) immediately.
    const name = window.prompt(
      "Name this project (a subfolder with images / videos / storyboard will be created):",
      existing.length === 0 ? "My First Project" : "",
    );
    if (name && name.trim()) {
      setBusy("Creating project…");
      try {
        const proj = await openProject(h, name.trim());
        setProject(proj);
        setProjects(await listProjects(h));
        setBusy(null);
        onNewProject(); // fresh start for the new project
      } catch {
        await handleFolderGone();
      }
    }
  }

  // Folder ops can throw NotFoundError if the folder was deleted on disk
  // mid-session — reset to a clean state and tell the user, rather than crash.
  async function handleFolderGone() {
    await forgetRoot();
    setRoot(null);
    setProject(null);
    setProjects([]);
    setNeedsReconnect(false);
    setBusy("Project folder was removed — choose a folder again");
    setTimeout(() => setBusy(null), 4000);
  }

  async function handleOpen(name: string) {
    if (!root) return;
    setBusy("Opening…");
    try {
      const proj = await openProject(root, name);
      setProject(proj);
      setProjects(await listProjects(root));
      setBusy(null);
    } catch {
      await handleFolderGone();
    }
  }

  async function handleNew() {
    if (!root || !newName.trim()) return;
    await handleOpen(newName.trim());
    setNewName("");
    onNewProject(); // clear gallery/storyboard/prompts for a fresh start
  }

  const selectedItems = gallery.filter((g) => selectedIds.has(g.id));
  const toSave = selectedItems.length > 0 ? selectedItems : gallery;

  async function handleSave() {
    if (toSave.length === 0) return;
    // If folder access is available but nothing's set up, guide rather than surprise-zip.
    if (supported && !root) {
      setBusy("Choose a project folder first ↑");
      setTimeout(() => setBusy(null), 3000);
      return;
    }
    if (supported && root && !project) {
      setBusy("Open or create a project first ↑");
      setTimeout(() => setBusy(null), 3000);
      return;
    }
    setBusy("Saving…");
    try {
      if (supported && project) {
        const res = await saveItemsToProject(project, toSave);
        await saveProjectMeta(project, { storyboard, prompts });
        setBusy(`Saved ${res.saved}${res.failed ? `, ${res.failed} failed` : ""} to folder`);
      } else {
        // Firefox/Safari fallback: ZIP download.
        const res = await zipAndDownload(toSave, "fal-project");
        setBusy(`Zipped ${res.saved}${res.failed ? `, ${res.failed} failed` : ""}`);
      }
      onClearSelection();
    } catch (e) {
      // If the project folder was deleted on disk, reset cleanly.
      if (e instanceof DOMException && e.name === "NotFoundError") {
        await handleFolderGone();
        return;
      }
      setBusy("Save failed");
    }
    setTimeout(() => setBusy(null), 3000);
  }

  async function handleBrowseSaved() {
    if (!project) return;
    // Revoke old object URLs before re-listing.
    savedImages.forEach((s) => URL.revokeObjectURL(s.url));
    const imgs = await listProjectImages(project);
    setSavedImages(imgs);
    setShowInsert(true);
  }

  const saveLabel =
    selectedItems.length > 0
      ? `Save ${selectedItems.length} selected`
      : gallery.length > 0
        ? `Save all (${gallery.length})`
        : "Save";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-900/40 px-4 py-2 text-xs">
      <span className="font-semibold uppercase tracking-wider text-zinc-500">Project</span>

      {mounted && !supported && (
        <span className="text-amber-400/80" title="Chrome/Edge support direct folder saving. Here we fall back to ZIP download.">
          ⚠ folder access unavailable — saves as ZIP
        </span>
      )}

      {/* A folder was saved before but needs a click to re-grant access. */}
      {supported && !root && needsReconnect && (
        <button
          onClick={handleReconnect}
          title="Re-grant access to your saved project folder"
          className="rounded-md bg-amber-600 px-3 py-1 font-medium text-white transition hover:bg-amber-500"
        >
          🔌 Reconnect folder
        </button>
      )}

      {supported && !root && !needsReconnect && (
        <button
          onClick={handlePickRoot}
          className="rounded-md bg-violet-600 px-3 py-1 font-medium text-white transition hover:bg-violet-500"
        >
          Choose project folder…
        </button>
      )}

      {supported && root && (
        <>
          <span className="text-zinc-500">
            Folder: <span className="text-zinc-300">{root.name}</span>
          </span>
          {/* Switch existing project */}
          {projects.length > 0 && (
            <select
              value={project?.name ?? ""}
              onChange={(e) => e.target.value && handleOpen(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200 outline-none focus:border-violet-500"
            >
              <option value="">Switch project…</option>
              {projects.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
          {/* New project */}
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleNew()}
            placeholder="New project name"
            className="w-36 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500"
          />
          <button
            onClick={handleNew}
            disabled={!newName.trim()}
            className="rounded-md bg-zinc-800 px-2.5 py-1 font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-40"
          >
            + New (fresh start)
          </button>
        </>
      )}

      {project && (
        <span className="rounded bg-violet-600/20 px-2 py-0.5 text-violet-300">
          Active: {project.name}
        </span>
      )}

      <span className="mx-1 text-zinc-700">|</span>

      {/* Save selected/all */}
      <button
        onClick={handleSave}
        disabled={gallery.length === 0 || busy != null}
        title={
          supported && !project
            ? "Choose a folder and open a project, then save"
            : "Save media to the project"
        }
        className="rounded-md bg-emerald-700 px-3 py-1 font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ↓ {saveLabel}
      </button>

      {/* Re-insert saved images */}
      {supported && project && (
        <button
          onClick={handleBrowseSaved}
          className="rounded-md bg-zinc-800 px-3 py-1 font-medium text-zinc-200 transition hover:bg-zinc-700"
        >
          📂 Insert saved image
        </button>
      )}

      {busy && <span className="text-zinc-400">{busy}</span>}

      {/* Saved-image picker overlay */}
      {showInsert && (
        <div
          onClick={() => setShowInsert(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">
                Insert a saved image from {project?.name}
              </h3>
              <button onClick={() => setShowInsert(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            {savedImages.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">No saved images in this project yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {savedImages.map((img) => (
                  <button
                    key={img.name}
                    onClick={() => {
                      onInsertImage(img.url, img.name);
                      setShowInsert(false);
                    }}
                    className="group overflow-hidden rounded-lg border border-zinc-800 transition hover:border-violet-500"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                    <img src={img.url} alt={img.name} className="aspect-square w-full object-cover" />
                    <span className="block truncate bg-zinc-950 px-1.5 py-1 text-[10px] text-zinc-400">
                      {img.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
