import type { ModelKind } from "./models";

export interface GalleryItem {
  id: string;
  kind: ModelKind;
  url: string;
  prompt: string;
  model: string;
  createdAt: number;
}

const GALLERY_KEY = "fal-studio:gallery";
const STORYBOARD_KEY = "fal-studio:storyboard";
const API_KEY_KEY = "fal-studio:api-key";

export function loadGallery(): GalleryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GALLERY_KEY);
    return raw ? (JSON.parse(raw) as GalleryItem[]) : [];
  } catch {
    return [];
  }
}

export function saveGallery(items: GalleryItem[]) {
  window.localStorage.setItem(GALLERY_KEY, JSON.stringify(items));
}

export function loadStoryboard(): GalleryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORYBOARD_KEY);
    return raw ? (JSON.parse(raw) as GalleryItem[]) : [];
  } catch {
    return [];
  }
}

export function saveStoryboard(items: GalleryItem[]) {
  window.localStorage.setItem(STORYBOARD_KEY, JSON.stringify(items));
}

export function loadApiKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(API_KEY_KEY) ?? "";
}

export function saveApiKey(key: string) {
  window.localStorage.setItem(API_KEY_KEY, key);
}

export function clearApiKey() {
  window.localStorage.removeItem(API_KEY_KEY);
}
