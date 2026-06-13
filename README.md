# fal-studio

Used to create Images and Videos with Fal.ai with API keys.

A personal image & video generation studio for [fal.ai](https://fal.ai), built with Next.js. Runs entirely in your own browser — your API key is never sent to anyone but fal.ai.

## Layout

Three-panel "Director's Desk" workspace:

- **Left rail** — model selector (grouped by task), plain-English "which to pick" hints, clickable example prompts, per-model options, a reference-image input for edit/animate modes, and the bring-your-own-key utility.
- **Center** — the gallery contact sheet. Every result gets `+ Story`, `Use →` (send an image into edit/animate), download, and delete.
- **Right** — the **Story** panel. Drag images/videos in from the gallery and drag shots up/down to sequence them.

## Models

| Model | Task | Endpoint |
|---|---|---|
| Nano Banana Pro | Text → Image | `fal-ai/nano-banana-pro` |
| Imagen 4 | Text → Image | `fal-ai/imagen4/preview` |
| FLUX 1.1 Pro | Text → Image | `fal-ai/flux-pro/v1.1` |
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
