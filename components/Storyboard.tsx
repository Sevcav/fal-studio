"use client";

import { useState } from "react";
import type { GalleryItem } from "@/lib/storage";

interface StoryboardProps {
  shots: GalleryItem[];
  onReorder: (shots: GalleryItem[]) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onDropItem: (item: GalleryItem) => void;
}

export default function Storyboard({
  shots,
  onReorder,
  onRemove,
  onClear,
  onDropItem,
}: StoryboardProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [paneHot, setPaneHot] = useState(false);

  function handlePaneDrop(e: React.DragEvent) {
    e.preventDefault();
    setPaneHot(false);
    const raw = e.dataTransfer.getData("application/x-fal-item");
    if (!raw) return;
    try {
      onDropItem(JSON.parse(raw) as GalleryItem);
    } catch {
      /* ignore malformed payload */
    }
  }

  // Reorder when dragging an existing shot over another shot.
  function handleShotDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = shots.findIndex((s) => s.id === dragId);
    const to = shots.findIndex((s) => s.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...shots];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950/40">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Story <span className="text-zinc-600">({shots.length})</span>
        </h2>
        {shots.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-zinc-500 transition hover:text-red-400"
          >
            Clear
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setPaneHot(true);
        }}
        onDragLeave={() => setPaneHot(false)}
        onDrop={handlePaneDrop}
        className={`flex-1 space-y-3 overflow-y-auto px-4 pb-4 transition ${
          paneHot ? "bg-violet-950/20" : ""
        }`}
      >
        {shots.length === 0 ? (
          <div
            className={`mt-2 rounded-lg border border-dashed p-6 text-center text-xs leading-relaxed transition ${
              paneHot ? "border-violet-500 text-violet-300" : "border-zinc-800 text-zinc-600"
            }`}
          >
            Drag images or videos here from the gallery to build your story, then drag shots up or
            down to reorder.
          </div>
        ) : (
          shots.map((shot, i) => (
            <div
              key={shot.id}
              draggable
              onDragStart={() => setDragId(shot.id)}
              onDragEnd={() => {
                setDragId(null);
                setOver(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(shot.id);
              }}
              onDrop={() => {
                handleShotDrop(shot.id);
                setOver(null);
              }}
              className={`group relative cursor-grab overflow-hidden rounded-lg border bg-zinc-900 active:cursor-grabbing ${
                over === shot.id ? "border-violet-500" : "border-zinc-800"
              }`}
            >
              <span className="absolute left-1.5 top-1.5 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-200">
                {i + 1}
              </span>
              <button
                onClick={() => onRemove(shot.id)}
                className="absolute right-1.5 top-1.5 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-zinc-300 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
              >
                ✕
              </button>
              {shot.kind === "video" || shot.kind === "i2v" ? (
                <video src={shot.url} muted loop className="aspect-video w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- remote fal CDN URLs
                <img src={shot.url} alt={shot.prompt} className="aspect-video w-full object-cover" />
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
