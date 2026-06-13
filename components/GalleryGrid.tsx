"use client";

import type { GalleryItem } from "@/lib/storage";

interface GalleryGridProps {
  items: GalleryItem[];
  /** Which tab is active — drives the empty-state copy. */
  tab: "images" | "videos";
  onDelete: (id: string) => void;
  onAddToStory: (item: GalleryItem) => void;
  onUseImage: (item: GalleryItem) => void;
}

function extensionFromUrl(url: string, kind: GalleryItem["kind"]): string {
  try {
    const match = /\.(\w{2,4})(?:\?|$)/.exec(new URL(url).pathname);
    if (match) return match[1];
  } catch {
    /* fall through */
  }
  return kind === "video" || kind === "i2v" ? "mp4" : "png";
}

async function downloadItem(item: GalleryItem) {
  try {
    const res = await fetch(item.url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `fal-${item.id}.${extensionFromUrl(item.url, item.kind)}`;
    a.click();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(item.url, "_blank", "noopener");
  }
}

export default function GalleryGrid({ items, tab, onDelete, onAddToStory, onUseImage }: GalleryGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-center text-zinc-600">
        <div>
          <p className="text-lg text-zinc-500">
            No {tab} yet — generate something ✨
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            Results land here. Drag your favorites to the Story panel on the right.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => {
        const isVideo = item.kind === "video" || item.kind === "i2v";
        const isImage = item.kind === "image" || item.kind === "edit";
        return (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-fal-item", JSON.stringify(item));
              e.dataTransfer.effectAllowed = "copy";
            }}
            className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60"
          >
            <div className="relative aspect-video cursor-grab bg-black active:cursor-grabbing">
              {isVideo ? (
                <video src={item.url} controls loop className="h-full w-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- remote fal CDN URLs
                <img src={item.url} alt={item.prompt} className="h-full w-full object-contain" />
              )}
              <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                {item.kind}
              </span>
              {/* Hover delete overlay for bad generations */}
              <button
                onClick={() => onDelete(item.id)}
                title="Delete this generation"
                className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-sm text-zinc-200 opacity-0 transition hover:bg-red-600 hover:text-white group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 p-2.5">
              <p className="line-clamp-2 text-xs text-zinc-400" title={item.prompt}>
                {item.prompt}
              </p>
              <div className="flex items-center justify-between text-[10px] text-zinc-600">
                <span className="truncate">{item.model}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => onAddToStory(item)}
                  className="rounded-md bg-violet-600/90 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-violet-500"
                >
                  + Story
                </button>
                {isImage && (
                  <button
                    onClick={() => onUseImage(item)}
                    className="rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-700"
                    title="Send to Edit / Animate"
                  >
                    Use →
                  </button>
                )}
                <button
                  onClick={() => downloadItem(item)}
                  className="rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-700"
                >
                  ↓ Save
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
