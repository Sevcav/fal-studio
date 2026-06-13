// Model kinds. "image" = text-to-image, "edit" = image(s)+prompt -> image,
// "video" = text-to-video, "i2v" = image+prompt -> video.
export type ModelKind = "image" | "edit" | "video" | "i2v";

// Where the model expects input image(s). Each endpoint names this differently.
export type ImageInputField = "image_urls" | "image_url" | "start_image_url";

export interface SelectDef {
  key: string;
  label: string;
  values: readonly string[];
  defaultValue: string;
  /** Send this field to the API as a number instead of a string. */
  numeric?: boolean;
}

export interface ToggleDef {
  key: string;
  label: string;
  defaultValue: boolean;
}

// Pricing specs. All USD figures are taken verbatim from each model's fal.ai
// pricing section (verified, not guessed). `note` documents anything fal does
// not publish, so the estimate stays honest.
export type Pricing =
  // Flat per-image. `quad` = multiplier applied when resolution === "4K".
  | { type: "per_image"; usd: number; quadResolution?: boolean }
  // Per megapixel, billed rounded up to the nearest MP. `mpBySize` maps the
  // model's named image_size values to their megapixel count.
  | { type: "per_megapixel"; usd: number; mpBySize: Record<string, number> }
  // Per second of video. Optional audio surcharge swaps the rate.
  | { type: "per_second"; usd: number; usdWithAudio?: number; note?: string }
  // Per second where the rate depends on the chosen resolution value.
  | { type: "per_second_by_resolution"; usdByResolution: Record<string, number>; note?: string }
  // Token-based / usage-based pricing fal does not publish as a flat per-image
  // figure (e.g. GPT Image 2). We show `note` instead of a fabricated number.
  | { type: "varies"; note: string };

export interface ModelDef {
  endpoint: string;
  name: string;
  kind: ModelKind;
  blurb: string;
  /** Plain-English "when to use this" line for newcomers. */
  pick: string;
  selects: SelectDef[];
  toggles: ToggleDef[];
  /** For edit/i2v models: the input field name and whether it takes an array. */
  imageInput?: { field: ImageInputField; multiple: boolean };
  /** Cost basis from fal.ai's published pricing. */
  pricing: Pricing;
}

export function isImageKind(kind: ModelKind): boolean {
  return kind === "image" || kind === "edit";
}

export function needsImageInput(kind: ModelKind): boolean {
  return kind === "edit" || kind === "i2v";
}

// Option values mirror each endpoint's published input schema on fal.ai
// (verified via each model's llms.txt). Do not guess these.
export const MODELS: ModelDef[] = [
  // ---------- Text to image ----------
  {
    endpoint: "fal-ai/nano-banana-pro",
    name: "Nano Banana Pro",
    kind: "image",
    blurb: "Google's flagship image model (aka Nano Banana 2)",
    pick: "Best all-round photo & art generator.",
    selects: [
      {
        key: "aspect_ratio",
        label: "Aspect ratio",
        values: ["1:1", "16:9", "9:16", "21:9", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5"],
        defaultValue: "16:9",
      },
      { key: "resolution", label: "Resolution", values: ["1K", "2K", "4K"], defaultValue: "1K" },
      { key: "num_images", label: "Images", values: ["1", "2", "3", "4"], defaultValue: "1", numeric: true },
    ],
    toggles: [],
    pricing: { type: "per_image", usd: 0.15, quadResolution: true }, // 4K = 2x
  },
  {
    endpoint: "fal-ai/imagen4/preview",
    name: "Imagen 4",
    kind: "image",
    blurb: "Google Imagen 4 — photorealistic text-to-image",
    pick: "Great for realistic photography.",
    selects: [
      { key: "aspect_ratio", label: "Aspect ratio", values: ["1:1", "16:9", "9:16", "4:3", "3:4"], defaultValue: "16:9" },
      { key: "resolution", label: "Resolution", values: ["1K", "2K"], defaultValue: "1K" },
      { key: "num_images", label: "Images", values: ["1", "2", "3", "4"], defaultValue: "1", numeric: true },
    ],
    toggles: [],
    pricing: { type: "per_image", usd: 0.05 }, // Standard tier
  },
  {
    endpoint: "fal-ai/flux-pro/v1.1",
    name: "FLUX 1.1 Pro",
    kind: "image",
    blurb: "Black Forest Labs FLUX — sharp, fast, stylistic",
    pick: "Fast, stylish, good with text in images.",
    selects: [
      {
        key: "image_size",
        label: "Size",
        // FLUX uses named sizes, not aspect-ratio strings.
        values: ["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"],
        defaultValue: "landscape_16_9",
      },
      { key: "num_images", label: "Images", values: ["1", "2", "3", "4"], defaultValue: "1", numeric: true },
    ],
    toggles: [],
    // $0.04/MP billed rounded UP to the nearest MP. MP figures are the
    // billed (rounded-up) megapixels for fal's standard size presets.
    pricing: {
      type: "per_megapixel",
      usd: 0.04,
      mpBySize: {
        square_hd: 2, // 1024x1024 = 1.05MP -> 2
        square: 1, // 512x512 = 0.26MP -> 1
        portrait_4_3: 1, // ~0.79MP -> 1
        landscape_4_3: 1,
        portrait_16_9: 1, // ~0.92MP -> 1
        landscape_16_9: 1,
      },
    },
  },
  {
    endpoint: "openai/gpt-image-2",
    name: "GPT Image 2",
    kind: "image",
    blurb: "OpenAI's GPT Image 2 — top-tier text rendering & realism",
    pick: "Best for accurate text in images and realism.",
    selects: [
      {
        key: "image_size",
        label: "Size",
        values: ["auto", "square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"],
        defaultValue: "landscape_4_3",
      },
      { key: "quality", label: "Quality", values: ["auto", "low", "medium", "high"], defaultValue: "high" },
      { key: "num_images", label: "Images", values: ["1", "2", "3", "4"], defaultValue: "1", numeric: true },
    ],
    toggles: [],
    // Token/usage-based; fal does not publish a flat per-image price.
    pricing: { type: "varies", note: "usage-based price (varies by quality)" },
  },

  // ---------- Image edit (reference image in) ----------
  {
    endpoint: "fal-ai/nano-banana-pro/edit",
    name: "Nano Banana Pro — Edit",
    kind: "edit",
    blurb: "Edit or remix an existing image with a prompt + reference(s)",
    pick: "Change or restyle an image you already have.",
    imageInput: { field: "image_urls", multiple: true },
    selects: [
      {
        key: "aspect_ratio",
        label: "Aspect ratio",
        values: ["auto", "1:1", "16:9", "9:16", "21:9", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5"],
        defaultValue: "auto",
      },
      { key: "resolution", label: "Resolution", values: ["1K", "2K", "4K"], defaultValue: "1K" },
      { key: "num_images", label: "Images", values: ["1", "2", "3", "4"], defaultValue: "1", numeric: true },
    ],
    toggles: [],
    pricing: { type: "per_image", usd: 0.15, quadResolution: true }, // 4K = 2x
  },

  // ---------- Text to video ----------
  {
    endpoint: "bytedance/seedance-2.0/text-to-video",
    name: "Seedance 2.0",
    kind: "video",
    blurb: "ByteDance video — native audio, real-world physics, camera control",
    pick: "Cinematic video with sound, from text.",
    selects: [
      { key: "aspect_ratio", label: "Aspect ratio", values: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], defaultValue: "16:9" },
      { key: "resolution", label: "Resolution", values: ["480p", "720p", "1080p"], defaultValue: "720p" },
      { key: "duration", label: "Duration (s)", values: ["auto", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"], defaultValue: "5" },
    ],
    toggles: [{ key: "generate_audio", label: "Audio", defaultValue: true }],
    // 480p rate not published by fal; falls back to "varies" in the estimate.
    pricing: {
      type: "per_second_by_resolution",
      usdByResolution: { "720p": 0.3034, "1080p": 0.682 },
      note: "480p price not published by fal",
    },
  },
  {
    endpoint: "fal-ai/kling-video/v3/standard/text-to-video",
    name: "Kling 3.0",
    kind: "video",
    blurb: "Kling v3 — cinematic visuals, fluid motion, native audio",
    pick: "Smooth motion & strong prompt-following.",
    selects: [
      { key: "aspect_ratio", label: "Aspect ratio", values: ["16:9", "9:16", "1:1"], defaultValue: "16:9" },
      { key: "duration", label: "Duration (s)", values: ["3", "4", "5", "6", "7", "8", "9", "10"], defaultValue: "5" },
    ],
    toggles: [{ key: "generate_audio", label: "Audio", defaultValue: true }],
    pricing: { type: "per_second", usd: 0.084, usdWithAudio: 0.126 },
  },

  // ---------- Image to video (animate a still) ----------
  {
    endpoint: "bytedance/seedance-2.0/image-to-video",
    name: "Seedance 2.0 — Animate",
    kind: "i2v",
    blurb: "Animate a still image into video with native audio",
    pick: "Turn one of your images into a video.",
    imageInput: { field: "image_url", multiple: false },
    selects: [
      { key: "resolution", label: "Resolution", values: ["480p", "720p", "1080p"], defaultValue: "720p" },
      { key: "duration", label: "Duration (s)", values: ["auto", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"], defaultValue: "5" },
      { key: "aspect_ratio", label: "Aspect ratio", values: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], defaultValue: "auto" },
    ],
    toggles: [{ key: "generate_audio", label: "Audio", defaultValue: true }],
    pricing: {
      type: "per_second_by_resolution",
      usdByResolution: { "720p": 0.3024, "1080p": 0.682 },
      note: "480p price not published by fal",
    },
  },
  {
    endpoint: "fal-ai/kling-video/v3/standard/image-to-video",
    name: "Kling 3.0 — Animate",
    kind: "i2v",
    blurb: "Animate a still image with Kling v3 motion",
    pick: "Animate an image with smooth Kling motion.",
    imageInput: { field: "start_image_url", multiple: false },
    selects: [
      { key: "duration", label: "Duration (s)", values: ["3", "4", "5", "6", "7", "8", "9", "10"], defaultValue: "5" },
    ],
    toggles: [{ key: "generate_audio", label: "Audio", defaultValue: true }],
    pricing: { type: "per_second", usd: 0.084, usdWithAudio: 0.126 },
  },
];

export function defaultOptions(model: ModelDef): Record<string, string> {
  return Object.fromEntries(model.selects.map((s) => [s.key, s.defaultValue]));
}

export function defaultToggles(model: ModelDef): Record<string, boolean> {
  return Object.fromEntries(model.toggles.map((t) => [t.key, t.defaultValue]));
}

export interface CostEstimate {
  /** Total USD, or null when fal does not publish the needed rate. */
  usd: number | null;
  /** One-line plain-English breakdown, e.g. "4 images x $0.04". */
  detail: string;
  /** True when the figure is approximate (rounding, "auto" duration, etc.). */
  approximate: boolean;
}

function fmtUsd(n: number): string {
  return n < 0.1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;
}

// Estimate the cost of a generation from the model's published pricing and the
// user's current options. Returns usd: null (not a fabricated number) whenever
// fal has not published the rate for the chosen settings.
export function estimateCost(
  model: ModelDef,
  options: Record<string, string>,
  toggles: Record<string, boolean>,
): CostEstimate {
  const p = model.pricing;

  switch (p.type) {
    case "per_image": {
      const count = Number(options.num_images ?? "1") || 1;
      const is4K = (options.resolution ?? "") === "4K";
      const unit = p.quadResolution && is4K ? p.usd * 2 : p.usd;
      const total = unit * count;
      const res = is4K && p.quadResolution ? " @ 4K (2x)" : "";
      return {
        usd: total,
        detail: `${count} image${count > 1 ? "s" : ""} x ${fmtUsd(unit)}${res}`,
        approximate: false,
      };
    }

    case "per_megapixel": {
      const count = Number(options.num_images ?? "1") || 1;
      const size = options.image_size ?? "";
      const mp = p.mpBySize[size];
      if (mp == null) return { usd: null, detail: "price varies by size", approximate: true };
      const unit = p.usd * mp;
      const total = unit * count;
      return {
        usd: total,
        detail: `${count} image${count > 1 ? "s" : ""} x ${mp}MP x ${fmtUsd(p.usd)}`,
        approximate: false,
      };
    }

    case "per_second": {
      const durRaw = options.duration ?? "5";
      const audioOn = toggles.generate_audio ?? false;
      const rate = audioOn && p.usdWithAudio != null ? p.usdWithAudio : p.usd;
      const audioLbl = audioOn && p.usdWithAudio != null ? " (audio on)" : "";
      if (durRaw === "auto") {
        return { usd: null, detail: `${fmtUsd(rate)}/sec${audioLbl} x auto length`, approximate: true };
      }
      const secs = Number(durRaw) || 5;
      return {
        usd: rate * secs,
        detail: `${secs}s x ${fmtUsd(rate)}/sec${audioLbl}`,
        approximate: false,
      };
    }

    case "per_second_by_resolution": {
      const durRaw = options.duration ?? "5";
      const res = options.resolution ?? "";
      const rate = p.usdByResolution[res];
      if (rate == null) {
        return { usd: null, detail: p.note ?? "price varies by resolution", approximate: true };
      }
      if (durRaw === "auto") {
        return { usd: null, detail: `${fmtUsd(rate)}/sec @ ${res} x auto length`, approximate: true };
      }
      const secs = Number(durRaw) || 5;
      return {
        usd: rate * secs,
        detail: `${secs}s @ ${res} x ${fmtUsd(rate)}/sec`,
        approximate: false,
      };
    }

    case "varies":
      return { usd: null, detail: p.note, approximate: true };
  }
}
