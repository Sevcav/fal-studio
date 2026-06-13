# fal-studio

Used to create Images and Videos with Fal.ai with API keys.

A personal image & video generation studio for [fal.ai](https://fal.ai), built with Next.js. Runs entirely in your own browser — your API key is never sent to anyone but fal.ai.

## Layout

Three-panel "Director's Desk" workspace:

- **Left rail** — model selector (grouped by task), plain-English "which to pick" hints, clickable example prompts, per-model options, a reference-image input for edit/animate modes, and the bring-your-own-key utility.
- **Center** — the gallery contact sheet, split into **Images** / **Videos** tabs. Every result gets `+ Story`, `Use →` (send an image into edit/animate), download, delete (hover ✕), and **click-to-zoom** (or the ⤢ button) to open a full-screen lightbox — click anywhere or press Esc to close.
- **Right** — the **Story** panel. Drag images/videos in from the gallery and drag shots up/down to sequence them.

On **desktop** all three panels show side-by-side. On **mobile** the layout collapses to a single column with a bottom tab bar (✨ Create · 🖼 Gallery · 🎬 Story); a finished generation auto-switches to the Gallery tab.

## Projects (save to a real folder)

The bar above the gallery is a project workspace backed by an actual folder on your drive (via the browser's File System Access API).

- **Choose project folder** once — you can pick any folder. Each project the app creates is a subfolder with `images/`, `videos/`, `storyboard/`, a `project.json` (prompts + storyboard order), and a hidden `.falstudio` marker file.
- That marker is how the app keeps things tidy: the **Switch project** dropdown only lists folders *it* created, so picking a busy folder (even the app's own source folder) never shows `.git`, `node_modules`, or other unrelated directories.
- **New project** = a fresh start: it clears the on-screen gallery, storyboard, and prompts so each project is self-contained.
- **Select** items with the checkboxes (or **Select all**), then **Save selected** writes the media into the project's `images/` and `videos/` folders. With nothing selected, it saves everything.
- **Insert saved image** browses a project's `images/` folder as thumbnails; click one to load it as a reference into edit/animate mode.

**Browser support:** direct folder saving needs **Chrome or Edge**. On **Firefox/Safari** the app automatically falls back to bundling the selected media into a single **`.zip` download** (foldered by type) — same result, one extra unzip step. After a full page reload the browser may ask you to re-grant folder access (a one-click confirm), since handles are remembered but permission is re-checked for security.

## Enhanced prompts (Claude Code)

The **✨ Enhanced prompts** panel reads prompts that **Claude Code** writes into
`public/prompts.json`. You describe an idea in the Claude Code terminal
(`enhance: a cute robot watering plants, for an image`) and it writes a polished
prompt; in the app you click **↻ Refresh from Claude Code** and then the prompt to
load it. This rides on a **Claude Pro/Max subscription** — no extra API key or
per-prompt cost.

**Never used a terminal?** Follow the step-by-step guide:
[docs/ENHANCED_PROMPTS_SETUP.md](docs/ENHANCED_PROMPTS_SETUP.md).

## Tracking spend

The top bar shows two figures, both fully local (no key, no API call):

- **Spent (est)** — counts *up*, summed from each generation's cost estimate. **reset** zeroes it.
- **Balance (est)** — counts *down*. Click **update**, type the real balance you read off your fal dashboard, and each generation subtracts its estimated cost from it. When it drifts from reality (estimates aren't exact), open fal via the **↗** link and re-sync with one update. Turns red below $1.

We intentionally do *not* call fal's billing API in-app: that endpoint requires an **ADMIN-scoped** key (higher-privilege than the generation key — it can touch billing, private models, and CLI), which isn't worth storing in a browser given this app's "keys stay safe" premise. The manual balance gives you a live countdown without that exposure, and the dashboard stays the source of truth.

## Models

| Model | Task | Endpoint |
|---|---|---|
| Nano Banana Pro | Text → Image | `fal-ai/nano-banana-pro` |
| Imagen 4 | Text → Image | `fal-ai/imagen4/preview` |
| FLUX 1.1 Pro | Text → Image | `fal-ai/flux-pro/v1.1` |
| GPT Image 2 | Text → Image | `openai/gpt-image-2` |
| Nano Banana Pro — Edit | Edit an Image | `fal-ai/nano-banana-pro/edit` |
| Seedance 2.0 | Text → Video | `bytedance/seedance-2.0/text-to-video` |
| Kling 3.0 | Text → Video | `fal-ai/kling-video/v3/standard/text-to-video` |
| Seedance 2.0 — Animate | Image → Video | `bytedance/seedance-2.0/image-to-video` |
| Kling 3.0 — Animate | Image → Video | `fal-ai/kling-video/v3/standard/image-to-video` |

Each model exposes its own aspect-ratio / resolution / duration options, matching the published fal.ai input schemas (verified per-endpoint, not guessed). Note the differing image-input field names — Nano edit takes `image_urls` (array), Seedance animate takes `image_url`, Kling animate takes `start_image_url` — handled in [`lib/models.ts`](lib/models.ts). Add or change models there.

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000, click **Set API key**, and paste a key from
[fal.ai/dashboard/keys](https://fal.ai/dashboard/keys).

## Security model

- Your API key is stored **only** in your browser's `localStorage` (`fal-studio:api-key`). It is never written to disk in this repo, never sent to any server except `fal.ai`, and never baked into the build.
- All generation calls go **directly from your browser to fal.ai** via `@fal-ai/client` — there is no middleman server that could log your key.
- Because of that, anyone else who opens this app must enter their *own* key — yours cannot leak through the site.
- The fal client logs a console warning that credentials are exposed in the browser. That is expected for this personal-use design; for a multi-user product you would proxy requests through a server route instead.

## Cost estimates

Before you generate, the left rail shows an estimated cost (and it's repeated on the Generate button). Figures come straight from each model's published fal.ai pricing — flat per-image (Nano Pro $0.15, 4K = 2×; Imagen 4 $0.05), per-megapixel (FLUX $0.04/MP), or per-second (Kling $0.084/s, $0.126/s with audio; Seedance $0.3034/s at 720p, $0.682/s at 1080p). Where fal does not publish a rate (e.g. Seedance 480p) or the length is "auto", the estimate says so honestly instead of inventing a number. Treat estimates as guidance, not a billing guarantee — your fal dashboard is the source of truth. Rates are defined in [`lib/models.ts`](lib/models.ts).

## Notes

- Generated media is hosted on fal's CDN and links can expire — use the **Download** button on anything you want to keep.
- The gallery persists in `localStorage` under `fal-studio:gallery`; the storyboard under `fal-studio:storyboard`.
