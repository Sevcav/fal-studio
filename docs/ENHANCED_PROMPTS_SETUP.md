# Setting Up Claude-Enhanced Prompts — Step by Step

This guide is for someone who has **never used a terminal**. It walks you through
everything, slowly. Take it one step at a time.

## What this does (in plain English)

Fal Studio has a panel called **✨ Enhanced prompts**. Instead of typing a long,
detailed prompt yourself, you ask **Claude Code** (an AI assistant that runs on
your computer) to write a great one for you. Claude writes it into a small file,
and the app reads that file so you can click the prompt to use it — no copying
and pasting.

Think of it like having a writing assistant prepare your prompts in advance.

> **Important:** This uses **Claude Code**, which comes with a **Claude Pro or
> Max subscription** (the same one you'd use at claude.ai). It does **not** need
> a separate paid API key, and it does **not** cost extra per prompt. The free
> Claude.ai plan does **not** include Claude Code.

---

## What you need before starting

1. A **Claude Pro or Max subscription** (from claude.ai).
2. About **15 minutes** the first time. After that, asking for a new prompt
   takes seconds.

You'll install two free things below. Each is quick.

---

## Step 1 — Install Node.js (so the app can run)

Node.js is free software that lets Fal Studio run on your computer.

1. Go to **https://nodejs.org**
2. Click the big green button labeled **"LTS"** (it means "stable version").
3. Open the downloaded file and click **Next → Next → Install**, accepting the
   defaults, like any normal program.
4. Done. You won't see a new app icon — Node.js works behind the scenes.

---

## Step 2 — Open a terminal

The "terminal" is a window where you type commands. Don't be intimidated — you'll
only type a few short lines.

- **Windows:** Click **Start**, type **PowerShell**, press **Enter**. A window
  opens with a prompt like `PS C:\Users\YourName>`.
- **Mac:** Press **Cmd + Space**, type **Terminal**, press **Enter**.

Keep this window open for the next steps.

---

## Step 3 — Install Claude Code (your AI assistant)

In the terminal window, **copy and paste the matching line**, then press Enter.

- **Windows (PowerShell):**
  ```powershell
  irm https://claude.ai/install.ps1 | iex
  ```

- **Mac:**
  ```bash
  curl -fsSL https://claude.ai/install.sh | bash
  ```

It prints some text and takes a minute. When it's done, **close the terminal
window and open a new one** (this lets your computer "find" the new `claude`
command).

> Prefer not to type commands at all? There's also a **Claude Desktop app** with
> a graphical interface — download it from **https://claude.com/download**. You'll
> still use the terminal steps below to point it at the app folder, but it's an
> option if you'd rather click than type.

---

## Step 4 — Go to the Fal Studio folder and start Claude

Claude needs to be "inside" the app's folder so it can write the prompts file.

1. In the terminal, type `cd ` (the letters **c**, **d**, and a **space**).
2. Then **drag the `fal-studio` folder from your file explorer onto the terminal
   window** — it pastes the folder's location for you. Press **Enter**.

   It should look like this (your path may differ):
   ```
   cd F:\Fal.ai\fal-studio
   ```
3. Now start Claude by typing:
   ```
   claude
   ```
4. **First time only:** it opens your web browser to sign in. Log in with the
   **same account as your Claude Pro/Max subscription** and click to authorize.

You'll now see a prompt where you can type to Claude.

---

## Step 5 — Ask Claude to write a prompt

Just **describe what you want in plain words**. Always include the word **image**
or **video** so it lands under the right model in the app. Examples:

```
enhance: a cute robot watering plants on a windowsill, cinematic, for an image
```

```
enhance: a slow drone shot over a snowy mountain village at sunrise, for video
```

Claude writes a polished, detailed prompt into the app's file and tells you when
it's done.

---

## Step 6 — Use it in the app

1. Start the app. **Open a second terminal window**, go to the `fal-studio`
   folder again (`cd ` then drag the folder, Enter), and type:
   ```
   npm run dev
   ```
   Then open **http://localhost:3000** in your browser.
2. In the app, find the **✨ Enhanced prompts** panel (under the prompt box).
3. Click **↻ Refresh from Claude Code** to load what Claude just wrote.
4. Click the prompt → it fills the box → press **Generate**.

Done! No copying, no pasting.

---

## Doing it again later (the fast version)

Once everything's installed, the routine is short:

1. Terminal → `cd` into the `fal-studio` folder → type `claude`.
2. Type `enhance: <your idea>` (say image or video).
3. In the app, click **↻ Refresh from Claude Code**, then click your new prompt.

---

## Common problems

| Problem | Fix |
|---|---|
| `'npm' is not recognized` | Node.js isn't installed, or the terminal was open before you installed it. Close the terminal, open a new one, try again. If it persists, reinstall Node.js (Step 1). |
| `'claude' is not recognized` / `command not found` | You need a **fresh** terminal after installing Claude Code. Close the window and open a new one. If it still fails, re-run Step 3. |
| `The token '&&' is not a valid statement separator` | You pasted a Mac command into Windows PowerShell (or vice-versa). Use the line that matches your computer in Step 3. |
| Prompt doesn't appear in the app | Click **↻ Refresh from Claude Code**. Make sure your request started with `enhance:` and said image or video. |
| The Enhanced prompts panel isn't showing | It only appears when there's a prompt matching the current model type. Switch the model (image vs video) to match, or ask Claude for one of that type. |
| Claude says you need a subscription | Claude Code requires **Pro or Max**. The free claude.ai plan doesn't include it. |

---

## What's actually happening (optional, for the curious)

The prompts live in a plain text file at `public/prompts.json` inside the app.
Each entry has a label, the prompt text, and whether it's for `image` or `video`.
Claude Code just edits this file; the app reads it. You could even open and edit
that file by hand — but letting Claude write them is the whole point.
