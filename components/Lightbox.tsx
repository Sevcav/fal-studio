"use client";

import { useEffect } from "react";
import type { GalleryItem } from "@/lib/storage";

interface LightboxProps {
  item: GalleryItem | null;
  onClose: () => void;
}

export default function Lightbox({ item, onClose }: LightboxProps) {
  // Close on Esc; lock body scroll while open.
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [item, onClose]);

  if (!item) return null;

  const isVideo = item.kind === "video" || item.kind === "i2v";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6 backdrop-blur-sm"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/80 text-xl text-zinc-200 transition hover:bg-zinc-700 hover:text-white"
      >
        ✕
      </button>

      {/* Media — stopPropagation so clicking the image itself doesn't close */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] max-w-[90vw] items-center justify-center"
      >
        {isVideo ? (
          <video
            src={item.url}
            controls
            autoPlay
            loop
            className="max-h-[85vh] max-w-[90vw] rounded-lg"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- remote fal CDN URLs
          <img
            src={item.url}
            alt={item.prompt}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
          />
        )}
      </div>

      {/* Caption */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="mt-4 max-w-2xl text-center"
      >
        <p className="text-sm text-zinc-300">{item.prompt}</p>
        <div className="mt-1 flex items-center justify-center gap-3 text-xs text-zinc-500">
          <span>{item.model}</span>
          <span>·</span>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:underline"
          >
            Open original ↗
          </a>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-zinc-600">Click anywhere or press Esc to close</p>
    </div>
  );
}
