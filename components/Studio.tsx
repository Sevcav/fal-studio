"use client";

import { useEffect, useMemo, useState } from "react";
import { fal } from "@fal-ai/client";
import {
  MODELS,
  defaultOptions,
  defaultToggles,
  estimateCost,
  isImageKind,
  needsImageInput,
  type ModelDef,
} from "@/lib/models";
import {
  loadApiKey,
  saveApiKey,
  clearApiKey,
  loadGallery,
  saveGallery,
  loadStoryboard,
  saveStoryboard,
  type GalleryItem,
} from "@/lib/storage";
import {
  loadSpend,
  addSpend,
  resetSpend,
  loadBalance,
  setBalance as persistBalance,
  clearBalance,
  deductBalance,
} from "@/lib/balance";
import GalleryGrid from "./GalleryGrid";
import Storyboard from "./Storyboard";
import Lightbox from "./Lightbox";
import ProjectBar from "./ProjectBar";

type Status =
  | { state: "idle" }
  | { state: "running"; message: string }
  | { state: "error"; message: string };

// Enhanced prompts written by Claude Code into public/prompts.json.
interface EnhancedPrompt {
  id: string;
  label: string;
  target: "image" | "video" | "any";
  skill?: string;
  text: string;
}

function buildInput(
  model: ModelDef,
  prompt: string,
  options: Record<string, string>,
  toggles: Record<string, boolean>,
  refImages: string[],
): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  if (prompt.trim()) input.prompt = prompt.trim();

  if (model.imageInput) {
    input[model.imageInput.field] = model.imageInput.multiple ? refImages : refImages[0];
  }
  for (const select of model.selects) {
    const value = options[select.key] ?? select.defaultValue;
    input[select.key] = select.numeric ? Number(value) : value;
  }
  for (const toggle of model.toggles) {
    input[toggle.key] = toggles[toggle.key] ?? toggle.defaultValue;
  }
  return input;
}

function extractItems(
  model: ModelDef,
  prompt: string,
  data: Record<string, unknown>,
): GalleryItem[] {
  const now = Date.now();
  if (isImageKind(model.kind)) {
    const images = (data.images ?? []) as { url?: string }[];
    return images
      .filter((img): img is { url: string } => typeof img.url === "string")
      .map((img, i) => ({
        id: `${now}-${i}`,
        kind: model.kind,
        url: img.url,
        prompt,
        model: model.name,
        createdAt: now,
      }));
  }
  const video = data.video as { url?: string } | undefined;
  if (!video?.url) return [];
  return [{ id: `${now}-0`, kind: model.kind, url: video.url, prompt, model: model.name, createdAt: now }];
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const body = (err as { body?: { detail?: unknown } }).body;
    if (body?.detail) return JSON.stringify(body.detail);
    if ("message" in err) return String((err as Error).message);
  }
  return String(err);
}

export default function Studio() {
  const [apiKey, setApiKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [modelEndpoint, setModelEndpoint] = useState(MODELS[0].endpoint);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<Record<string, string>>(defaultOptions(MODELS[0]));
  const [toggles, setToggles] = useState<Record<string, boolean>>(defaultToggles(MODELS[0]));
  const [refImages, setRefImages] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [storyboard, setStoryboard] = useState<GalleryItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [galleryTab, setGalleryTab] = useState<"images" | "videos">("images");
  const [enhanced, setEnhanced] = useState<EnhancedPrompt[]>([]);
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [zoomItem, setZoomItem] = useState<GalleryItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [spend, setSpend] = useState(0);
  // Mobile single-column view: which panel is showing (ignored on md+ screens).
  const [mobileView, setMobileView] = useState<"create" | "gallery" | "story">("create");
  const [balance, setBalanceState] = useState<number | null>(null);
  const [balanceDraft, setBalanceDraft] = useState("");
  const [editingBalance, setEditingBalance] = useState(false);

  const model = useMemo(
    () => MODELS.find((m) => m.endpoint === modelEndpoint) ?? MODELS[0],
    [modelEndpoint],
  );

  useEffect(() => {
    const key = loadApiKey();
    setApiKey(key);
    setShowKey(!key);
    setGallery(loadGallery());
    setStoryboard(loadStoryboard());
    setSpend(loadSpend());
    setBalanceState(loadBalance());
    setHydrated(true);
  }, []);

  function saveBalance() {
    const n = Number(balanceDraft.trim());
    if (!Number.isFinite(n)) return;
    persistBalance(n);
    setBalanceState(n);
    setEditingBalance(false);
  }

  // Load Claude Code-authored enhanced prompts. Re-fetched on demand via refresh.
  function loadEnhanced() {
    fetch("/prompts.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.prompts) setEnhanced(data.prompts as EnhancedPrompt[]);
      })
      .catch(() => {
        /* file optional — ignore if missing */
      });
  }
  useEffect(loadEnhanced, []);

  function selectModel(endpoint: string) {
    const next = MODELS.find((m) => m.endpoint === endpoint) ?? MODELS[0];
    setModelEndpoint(next.endpoint);
    setOptions(defaultOptions(next));
    setToggles(defaultToggles(next));
    if (!needsImageInput(next.kind)) setRefImages([]);
  }

  function handleSaveKey() {
    const trimmed = keyDraft.trim();
    if (!trimmed) return;
    saveApiKey(trimmed);
    setApiKey(trimmed);
    setKeyDraft("");
    setShowKey(false);
  }

  function handleClearKey() {
    clearApiKey();
    setApiKey("");
    setShowKey(true);
  }

  function updateGallery(items: GalleryItem[]) {
    setGallery(items);
    saveGallery(items);
  }

  function updateStoryboard(items: GalleryItem[]) {
    setStoryboard(items);
    saveStoryboard(items);
  }

  function addToStory(item: GalleryItem) {
    if (storyboard.some((s) => s.id === item.id)) return;
    updateStoryboard([...storyboard, item]);
  }

  // "Use →" on a gallery image: switch to an edit/animate model and load it as the reference.
  function useImage(item: GalleryItem) {
    const target =
      MODELS.find((m) => m.kind === "edit") ?? MODELS.find((m) => m.kind === "i2v");
    if (!target) return;
    selectModel(target.endpoint);
    setRefImages([item.url]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Insert a saved project image (object URL) as a reference into edit/animate.
  function insertSavedImage(url: string) {
    const target =
      MODELS.find((m) => m.kind === "edit") ?? MODELS.find((m) => m.kind === "i2v");
    if (!target) return;
    selectModel(target.endpoint);
    setRefImages([url]);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // New project = fully fresh start: clear gallery, storyboard, and prompts.
  function newProjectReset() {
    updateGallery([]);
    updateStoryboard([]);
    setEnhanced([]);
    setSelectedIds(new Set());
  }

  async function generate() {
    if (!apiKey) {
      setShowKey(true);
      setStatus({ state: "error", message: "Add your fal.ai API key first." });
      return;
    }
    if (needsImageInput(model.kind) && refImages.length === 0) {
      setStatus({ state: "error", message: "This model needs a reference image — add one or use 'Use →' on a gallery image." });
      return;
    }
    if (!prompt.trim() && !needsImageInput(model.kind)) return;
    if (status.state === "running") return;

    fal.config({ credentials: apiKey });
    setStatus({
      state: "running",
      message: isImageKind(model.kind) ? "Submitting…" : "Submitting… video can take a few minutes",
    });

    try {
      const result = await fal.subscribe(model.endpoint, {
        input: buildInput(model, prompt, options, toggles, refImages),
        onQueueUpdate(update) {
          if (update.status === "IN_QUEUE") {
            const pos = (update as { queue_position?: number }).queue_position;
            setStatus({ state: "running", message: pos != null ? `In queue (position ${pos})…` : "In queue…" });
          } else if (update.status === "IN_PROGRESS") {
            setStatus({ state: "running", message: `Generating with ${model.name}…` });
          }
        },
      });

      const items = extractItems(model, prompt.trim() || "(image-driven)", result.data as Record<string, unknown>);
      if (items.length === 0) {
        setStatus({ state: "error", message: "Generation finished but returned no media." });
        return;
      }
      updateGallery([...items, ...gallery]);
      // Jump to the tab matching what was just generated so the result is visible.
      setGalleryTab(isImageKind(model.kind) ? "images" : "videos");
      setMobileView("gallery"); // on mobile, surface the new result
      // Track estimated spend (counts up) and deduct from manual balance (counts down).
      if (cost.usd != null) {
        setSpend(addSpend(cost.usd));
        const next = deductBalance(cost.usd);
        if (next != null) setBalanceState(next);
      }
      setStatus({ state: "idle" });
    } catch (err) {
      setStatus({ state: "error", message: errorMessage(err) });
    }
  }

  const running = status.state === "running";
  const cost = useMemo(() => estimateCost(model, options, toggles), [model, options, toggles]);

  // Split the gallery into Images (image/edit) and Videos (video/i2v) for the tabs.
  const imageItems = useMemo(
    () => gallery.filter((g) => g.kind === "image" || g.kind === "edit"),
    [gallery],
  );
  const videoItems = useMemo(
    () => gallery.filter((g) => g.kind === "video" || g.kind === "i2v"),
    [gallery],
  );
  const shownItems = galleryTab === "images" ? imageItems : videoItems;

  // Enhanced prompts relevant to the current model (image vs video, or "any").
  const wantTarget = isImageKind(model.kind) ? "image" : "video";
  const relevantEnhanced = useMemo(
    () => enhanced.filter((p) => p.target === wantTarget || p.target === "any"),
    [enhanced, wantTarget],
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* Reassurance band + balance/spend chip */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-zinc-800 bg-zinc-950 px-4 py-2 text-xs">
        <p className="hidden text-zinc-400 sm:block">
          No signup. No subscription. You pay <span className="text-zinc-200">fal</span>, nobody else —
          and your key is saved to <span className="text-violet-300">this browser alone</span>.
        </p>
        <div className="flex shrink-0 items-center gap-3">
          {/* Short note: these are local estimates, not live fal figures */}
          <span className="hidden whitespace-nowrap text-zinc-600 lg:inline">
            Estimated locally from each generation —
          </span>
          {/* Estimated spend — summed from each generation's cost, fully local */}
          <span
            className="whitespace-nowrap text-zinc-500"
            title="Estimated from each generation's cost. Your fal dashboard is the true balance."
          >
            Spent (est): <span className="font-semibold text-zinc-300">${spend.toFixed(2)}</span>
          </span>
          <button
            onClick={() => {
              resetSpend();
              setSpend(0);
            }}
            title="Reset the estimated-spend counter"
            className="whitespace-nowrap text-zinc-600 transition hover:text-zinc-400"
          >
            reset
          </button>

          <span className="text-zinc-700">|</span>

          {/* Manual balance — you set it from the dashboard, it counts down */}
          {hydrated && (editingBalance || balance == null) ? (
            <span className="flex items-center gap-1">
              <span className="text-zinc-500">Balance $</span>
              <input
                type="number"
                step="0.01"
                autoFocus
                value={balanceDraft}
                onChange={(e) => setBalanceDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveBalance();
                  if (e.key === "Escape") setEditingBalance(false);
                }}
                placeholder="17.75"
                className="w-16 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-200 outline-none focus:border-violet-500"
              />
              <button onClick={saveBalance} className="text-violet-400 hover:underline">save</button>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span
                className="whitespace-nowrap text-zinc-500"
                title="The balance you last entered, minus estimated spend since. Click Update to re-sync from fal."
              >
                Balance (est):{" "}
                <span className={`font-semibold ${(balance ?? 0) < 1 ? "text-red-400" : "text-emerald-400"}`}>
                  ${(balance ?? 0).toFixed(2)}
                </span>
              </span>
              <button
                onClick={() => {
                  setBalanceDraft(balance != null ? balance.toFixed(2) : "");
                  setEditingBalance(true);
                }}
                title="Set this to your real balance from the fal dashboard"
                className="text-zinc-600 transition hover:text-zinc-400"
              >
                update
              </button>
            </span>
          )}

          <a
            href="https://fal.ai/dashboard/usage"
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap text-violet-400 hover:underline"
            title="Open your fal dashboard to read your real balance"
          >
            fal balance ↗
          </a>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ---------- LEFT RAIL (Create) ---------- */}
        <div
          className={`${
            mobileView === "create" ? "flex" : "hidden"
          } w-full shrink-0 flex-col overflow-y-auto border-r border-zinc-800 bg-zinc-950/40 p-4 md:flex md:w-80`}
        >
          <div className="mb-4">
            <h1 className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-xl font-bold text-transparent">
              Fal Studio
            </h1>
            <p className="text-xs text-zinc-500">Every top fal.ai model in one window.</p>
          </div>

          {/* Model selector */}
          <label className="mb-1 block text-xs font-medium text-zinc-400">Model</label>
          <select
            value={model.endpoint}
            onChange={(e) => selectModel(e.target.value)}
            className="mb-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500"
          >
            <optgroup label="📷 Text → Image">
              {MODELS.filter((m) => m.kind === "image").map((m) => (
                <option key={m.endpoint} value={m.endpoint}>{m.name}</option>
              ))}
            </optgroup>
            <optgroup label="✏️ Edit an Image">
              {MODELS.filter((m) => m.kind === "edit").map((m) => (
                <option key={m.endpoint} value={m.endpoint}>{m.name}</option>
              ))}
            </optgroup>
            <optgroup label="🎬 Text → Video">
              {MODELS.filter((m) => m.kind === "video").map((m) => (
                <option key={m.endpoint} value={m.endpoint}>{m.name}</option>
              ))}
            </optgroup>
            <optgroup label="🎞️ Animate an Image">
              {MODELS.filter((m) => m.kind === "i2v").map((m) => (
                <option key={m.endpoint} value={m.endpoint}>{m.name}</option>
              ))}
            </optgroup>
          </select>
          <p className="mb-4 text-xs text-zinc-500">{model.pick}</p>

          {/* Reference image input for edit / animate models */}
          {needsImageInput(model.kind) && (
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Reference image {model.imageInput?.multiple ? "(one or more)" : ""}
              </label>
              {refImages.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {refImages.map((url, i) => (
                    <div key={url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element -- user/CDN URLs */}
                      <img src={url} alt="" className="h-14 w-14 rounded border border-zinc-700 object-cover" />
                      <button
                        onClick={() => setRefImages((r) => r.filter((_, j) => j !== i))}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-800 px-1 text-[10px] text-zinc-300 hover:text-red-400"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
              <input
                type="url"
                placeholder="Paste an image URL, or use '→' on a gallery image"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) {
                      setRefImages((r) => (model.imageInput?.multiple ? [...r, v] : [v]));
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500"
              />
            </div>
          )}

          {/* Prompt */}
          <label className="mb-1 block text-xs font-medium text-zinc-400">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) generate();
            }}
            rows={4}
            placeholder={isImageKind(model.kind) ? "Describe your image…" : "Describe your video — subject, action, camera, mood…"}
            className="mb-2 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500"
          />

          {/* Enhanced prompts — written by Claude Code (your skills) into public/prompts.json */}
          {relevantEnhanced.length > 0 && (
            <div className="mb-2 rounded-lg border border-zinc-800 bg-zinc-900/40">
              <button
                onClick={() => setShowEnhanced((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-zinc-300 hover:text-zinc-100"
              >
                <span>✨ Enhanced prompts ({relevantEnhanced.length})</span>
                <span className="text-zinc-600">{showEnhanced ? "▲" : "▼"}</span>
              </button>
              {showEnhanced && (
                <div className="space-y-1.5 px-2 pb-2">
                  {relevantEnhanced.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPrompt(p.text)}
                      title={p.text}
                      className="block w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-left text-[11px] text-zinc-300 transition hover:border-violet-500 hover:text-violet-200"
                    >
                      <span className="font-medium">{p.label}</span>
                      <span className="mt-0.5 line-clamp-2 text-[10px] text-zinc-500">{p.text}</span>
                    </button>
                  ))}
                  <button
                    onClick={loadEnhanced}
                    className="w-full pt-1 text-center text-[10px] text-zinc-600 hover:text-zinc-400"
                  >
                    ↻ Refresh from Claude Code
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Clear button (replaces the credit-wasting example chips) */}
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => setPrompt("")}
              disabled={!prompt}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
          </div>

          {/* Options */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            {model.selects.map((select) => (
              <label key={select.key} className="flex flex-col gap-1 text-[11px] text-zinc-400">
                {select.label}
                <select
                  value={options[select.key] ?? select.defaultValue}
                  onChange={(e) => setOptions((p) => ({ ...p, [select.key]: e.target.value }))}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-violet-500"
                >
                  {select.values.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
            ))}
            {model.toggles.map((toggle) => (
              <label key={toggle.key} className="flex items-center gap-2 self-end pb-1.5 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={toggles[toggle.key] ?? toggle.defaultValue}
                  onChange={(e) => setToggles((p) => ({ ...p, [toggle.key]: e.target.checked }))}
                  className="accent-violet-500"
                />
                {toggle.label}
              </label>
            ))}
          </div>

          {/* Cost estimate — shown before you spend any credits */}
          <div className="mb-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs">
            {cost.usd != null ? (
              <p className="text-zinc-300">
                <span className="text-zinc-500">Est. cost:</span>{" "}
                <span className="font-semibold text-emerald-400">
                  {cost.approximate ? "~" : ""}
                  {cost.usd < 0.1 ? `$${cost.usd.toFixed(3)}` : `$${cost.usd.toFixed(2)}`}
                </span>{" "}
                <span className="text-zinc-500">— {cost.detail}</span>
              </p>
            ) : (
              <p className="text-amber-300/90">
                <span className="text-zinc-500">Est. cost:</span> {cost.detail}
              </p>
            )}
          </div>

          <button
            onClick={generate}
            disabled={running}
            className="mb-1 w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running
              ? "Generating…"
              : `Generate ${isImageKind(model.kind) ? "Image" : "Video"}${
                  cost.usd != null
                    ? ` · ${cost.usd < 0.1 ? `$${cost.usd.toFixed(3)}` : `$${cost.usd.toFixed(2)}`}`
                    : ""
                }`}
          </button>
          <p className="mb-2 text-center text-[10px] text-zinc-600">Ctrl+Enter to generate</p>

          {status.state === "running" && (
            <p className="mb-2 flex items-center gap-2 text-xs text-violet-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
              {status.message}
            </p>
          )}
          {status.state === "error" && (
            <p className="mb-2 break-all rounded-lg border border-red-900/60 bg-red-950/40 px-2 py-1.5 text-xs text-red-300">
              {status.message}
            </p>
          )}

          {/* BYO key — quiet utility at the bottom */}
          <div className="mt-auto pt-4">
            <button
              onClick={() => setShowKey((v) => !v)}
              className="mb-1 flex w-full items-center justify-between text-xs text-zinc-400 hover:text-zinc-200"
            >
              <span>{apiKey ? "🔑 API key ✓" : "🔑 Set fal.ai API key"}</span>
              <span className="text-zinc-600">{showKey ? "▲" : "▼"}</span>
            </button>
            {hydrated && showKey && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
                <div className="flex gap-1.5">
                  <input
                    type="password"
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                    placeholder={apiKey ? "•••• saved — paste to replace" : "key_id:key_secret"}
                    className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500"
                  />
                  <button onClick={handleSaveKey} disabled={!keyDraft.trim()} className="rounded bg-violet-600 px-2.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40">Save</button>
                </div>
                {apiKey && (
                  <button onClick={handleClearKey} className="mt-1.5 text-[10px] text-zinc-500 hover:text-red-400">Remove key</button>
                )}
                <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener noreferrer" className="mt-1.5 block text-[10px] text-violet-400 hover:underline">
                  Get a key → fal.ai/dashboard/keys
                </a>
              </div>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
              Open DevTools → Network. The only host your key is ever sent to is{" "}
              <span className="text-zinc-500">fal.run</span>.
            </p>
          </div>
        </div>

        {/* ---------- CENTER GALLERY ---------- */}
        <main
          className={`${
            mobileView === "gallery" ? "flex" : "hidden"
          } min-w-0 flex-1 flex-col overflow-y-auto md:flex`}
        >
          {/* Project workspace bar */}
          <ProjectBar
            gallery={gallery}
            storyboard={storyboard}
            prompts={enhanced}
            selectedIds={selectedIds}
            onClearSelection={() => setSelectedIds(new Set())}
            onNewProject={newProjectReset}
            onInsertImage={(url) => insertSavedImage(url)}
          />

          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
            <div className="flex items-center gap-1">
              {(["images", "videos"] as const).map((t) => {
                const count = t === "images" ? imageItems.length : videoItems.length;
                const active = galleryTab === t;
                return (
                  <button
                    key={t}
                    onClick={() => setGalleryTab(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                      active
                        ? "bg-violet-600 text-white"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    {t} <span className={active ? "text-violet-200" : "text-zinc-600"}>({count})</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3 text-xs">
              {shownItems.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      const allSelected = shownItems.every((i) => selectedIds.has(i.id));
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        for (const i of shownItems) {
                          if (allSelected) next.delete(i.id);
                          else next.add(i.id);
                        }
                        return next;
                      });
                    }}
                    className="text-zinc-400 transition hover:text-zinc-200"
                  >
                    {shownItems.every((i) => selectedIds.has(i.id)) ? "Deselect all" : "Select all"}
                  </button>
                  {selectedIds.size > 0 && (
                    <span className="text-violet-300">{selectedIds.size} selected</span>
                  )}
                  <button
                    onClick={() => {
                      if (
                        window.confirm(`Clear all ${galleryTab}? Downloaded files are unaffected.`)
                      ) {
                        const keep = galleryTab === "images" ? videoItems : imageItems;
                        updateGallery(keep);
                      }
                    }}
                    className="text-zinc-500 transition hover:text-red-400"
                  >
                    Clear {galleryTab}
                  </button>
                </>
              )}
            </div>
          </div>
          <GalleryGrid
            items={shownItems}
            tab={galleryTab}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onDelete={(id) => updateGallery(gallery.filter((g) => g.id !== id))}
            onAddToStory={addToStory}
            onUseImage={useImage}
            onZoom={setZoomItem}
          />
        </main>

        {/* ---------- RIGHT STORYBOARD ---------- */}
        <Storyboard
          shots={storyboard}
          onReorder={updateStoryboard}
          onRemove={(id) => updateStoryboard(storyboard.filter((s) => s.id !== id))}
          onClear={() => updateStoryboard([])}
          onDropItem={addToStory}
          className={`${mobileView === "story" ? "flex w-full" : "hidden"} md:flex md:w-72`}
        />
      </div>

      {/* Mobile bottom tab bar — hidden on md+ where all three panels show at once */}
      <nav className="flex shrink-0 border-t border-zinc-800 bg-zinc-950 md:hidden">
        {([
          { key: "create", label: "Create", icon: "✨" },
          { key: "gallery", label: `Gallery (${gallery.length})`, icon: "🖼" },
          { key: "story", label: `Story (${storyboard.length})`, icon: "🎬" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMobileView(tab.key)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
              mobileView === tab.key
                ? "bg-violet-600/20 text-violet-300"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Fullscreen viewer */}
      <Lightbox item={zoomItem} onClose={() => setZoomItem(null)} />
    </div>
  );
}
