# ⌨️ typetest — the typing test that bites back

A pixel-faithful clone of a sleek, modern typing test (think [Monkeytype](https://monkeytype.com))… except it's a **prank**. Your friend sits down, breezes through a calm little typing test, and just as they near the finish — **jumpscare**. Then it quietly drops them back to the setup screen, settings untouched, ready for the next victim.

It's honest about it too: an intro popup tells *you* it's a prank up front. The deception is for whoever you hand the keyboard to.

---

## ✨ Features

- **Authentic typing-test UI** — serika-dark color palette, monospaced word grid, live caret, WPM / timer / progress stats. It looks and feels like the real thing.
- **Bouncy, satisfying typing** — letters pop as you hit them and the caret glides between characters with a soft glow. Just enough motion to keep eyes glued to the screen.
- **Fully customizable text** — type your own words or hit **randomize** to pull from 14 hand-written prompts. Some are innocent (office jargon, a grocery list); some get *quietly* unsettling as the victim types, building dread before the payoff. All lowercase, no punctuation — pure typing-test style.
- **6 jumpscares to choose from**, each with live-synthesized audio and full-screen visuals:

  | | scare | what it does |
  |---|---|---|
  | 😱 | **the classic** | screen snaps to a screaming face that lunges at you |
  | 🚨 | **rave from hell** | blinding black-and-white strobe with a screaming siren |
  | 📺 | **signal lost** | the screen tears into static and a face flickers through |
  | 👁 | **the watcher** | a pale hollow-eyed thing is instantly in your face, screaming |
  | 🩸 | **red alert** | the screen floods blood-red and convulses while an alarm blares |
  | 💻 | **fake crash** | the screen "crashes" to a blue error and a corpse erupts out of it instantly |

- **🎲 Surprise me** — a "random" scare card that picks one of the scares at fire time, so even *you* don't know which one lands.
- **🎨 Theme switcher** — four monkeytype-style palettes (serika, dracula, matrix, coral) via the dots in the top-right. Your choice is remembered across visits.
- **📊 Fake results screen** — when you use the trigger offset (below), the players who *aren't* the target get a fully convincing monkeytype-style results card — wpm, accuracy, raw, consistency, a wpm graph, even a persisted "new personal best." Sells the "real competition" framing so no one suspects a thing.
- **🔗 Shareable game links** — the **copy game link** button bundles your exact setup (words, scare, offset) into a URL that opens straight into the test. Text it to someone and they walk right into it. See below.
- **Resets itself** — after the scare it returns to the setup screen with the same prompt and scare still selected, so you can run it again instantly.
- **Zero dependencies, zero build step** — just plain HTML, CSS, and JavaScript. All sound is generated live with the Web Audio API and every creature is inline SVG, so there are **no image or audio files to download.**

---

## 🚀 Getting started

No install, no build, no server required.

```bash
git clone https://github.com/<your-username>/typing-test-jumpscare.git
cd typing-test-jumpscare
open index.html      # macOS — or just double-click the file
```

> Want to host it? Drop the folder on **GitHub Pages**, **Netlify**, or any static host. It's all static files.

---

## 🎮 How to use it

1. Open the page. It greets **you** (the prankster) with a heads-up that it's a prank.
2. **Set the words** — type your own or hit **randomize** for a ready-made prompt.
3. **Pick a scare** from the cards (or **🎲 surprise me** for a random one). Optionally **🎨 switch theme** with the dots up top.
4. **(Optional) Set a trigger offset** — see below.
5. Click **start test** and hand over the keyboard.
6. Your victim types the test like normal… and gets got near the end.
7. The page returns to setup automatically. Line up the next one.

### 🎯 Trigger offset

Setting up a "typing competition" with a group? The **trigger offset** stepper (with an ℹ️ tooltip that explains it inline) lets you choose *which player* gets scared:

- **1** (default) → the **first** player gets scared.
- **N** → players 1 … N−1 each take the test and get a normal **results screen**, then hit **next** to pass the keyboard along. The scare fires only on **player #N**. So to prank the 3rd friend while the first two compete for real, set it to **3**.

Crucially, everyone before the target stays inside the test loop — results → **next** → next player's test — so you **never** drop back to the setup screen mid-competition and the prank stays hidden. The round resets after the scare fires (or any time you return to setup). The Konami unlock and the coffee-button trap ignore the offset and always fire.

**🎲 Random (secret) offset:** hit the **random** button by the stepper to roll a hidden target (1–5). The readout masks to `??` / `player #??` so even *you* don't know who gets it. Hover the readout and click **reveal** if you want to spoil the surprise — and hitting **+** or **−** reveals and adjusts it too.

### 🔗 Shareable game links

Hit **copy game link** on the setup screen and the site bundles your current setup into a URL and copies it to your clipboard:

```
yoursite.com/?w=<words>&s=<scareId>&o=<offset>&play=1
```

- `w` — the words for the test
- `s` — the chosen scare id (e.g. `classic`, `watcher`, `random`)
- `o` — the trigger offset
- `play=1` — opens **straight into the test**, skipping the intro popup

Text it to a friend and they walk right into a pre-armed prank. Opening the same params **without** `play=1` just pre-fills the setup screen instead (handy for sharing a config with another prankster).

### ⚡ Quick link: `/test`

Append **`/test`** to the site's URL (e.g. `yoursite.com/test`) to jump straight into the default test, skipping the intro popup — great for a quick demo. `#test` and `?test` work too.

> `/test` as a real path needs your host to serve `index.html` for unknown routes (SPA fallback — e.g. a Netlify `_redirects` rule, or GitHub Pages' 404 fallback). If you're opening the file directly (`file://`) or your host doesn't do that, use **`index.html#test`**, which works everywhere. Shared `?w=...&play=1` links work everywhere since they don't rely on a custom path.

> 🔊 **Sound note:** browsers block audio until the user interacts with the page. The site unlocks audio on the first interaction — dismissing the intro, picking a scare, pressing start, or even the first keystroke of the test — so by the time a scare fires it'll be loud (this is why an auto-started `/test` or shared link still works). Do a quick test run yourself first.

### 🚪 Secret exit

During the test there's a monkeytype-style **mode bar** at the top (`punctuation · numbers · time · words · quote · zen · custom`). It's mostly for show — **words** is the fake active mode and clicking it does nothing. But clicking **any other option** instantly bails out of the test and returns to the config screen, no scare triggered. It looks like an innocent settings bar, so it's a discreet way to abort if you need to back out before the payoff. The bar only appears on the test page — never on config or during the scare.

---

## 🥚 Easter egg (spoiler)

There's a **secret seventh scare** that never appears in the picker and is never hinted at on the site. To unlock it, enter the **Konami code** on the setup screen — at any point, just type:

```
↑ ↑ ↓ ↓ ← → ← → B A  then  Enter
```

That final **Enter** doubles as "start," launching the test with the hidden **🪵 tung tung tung sahur** scare armed. Your victim types like normal and, on finishing, the log creature slams in instantly with a loud burst of its signature wooden knocks. It only stays armed for that one run.

> **About the audio:** by default the "tung tung tung" knocks are generated live with the Web Audio API (so there are still no asset files). If you'd rather use a real, properly-cropped clip, open `scares.js` and set `TUNG_AUDIO_SRC` to a URL or base64 data URI — it'll play that instead and skip the synth.

### ☕ The "buy me a coffee" trap (double prank)

In the footer credit there's a faint, low-opacity **☕ buy me a coffee** button — styled to be easy to miss and only lighting up on hover. It is *not* a donation link. Clicking it fires an **instant** scare with no typing required: a quirky cartoon "boing" drops straight into a deranged screaming coffee mug (the **☕ coffee** hidden scare) that lunges at you with cream-and-amber strobe lights. It's the trap for the curious friend who pokes around the page instead of taking the test — or for the one who tries to "support" you.

---

## 📁 Project structure

```
typing-test-jumpscare/
├── index.html    # markup: intro popup, setup, test, results, scare layer, footer
├── style.css     # monkeytype-style UI, the four themes, animations, scare keyframes
├── prompts.js    # the randomizable word lists
├── scares.js     # the Web Audio engine, the SVG creatures, and all 8 scares
├── script.js     # test logic, live stats, caret, themes, sharing, the prank handoff
└── README.md
```

**Adding your own scare?** Append an object to the `SCARES` array in `scares.js` with an `id`, `emoji`, `name`, `desc`, and a `run(layer)` method that builds the visuals and returns the duration in milliseconds. It shows up as a selectable card automatically — unless you give it `hidden: true` (like the Konami and coffee scares), which keeps it out of the picker.

**Adding your own prompt?** Append `{ name, text }` to the `PROMPTS` array in `prompts.js` — lowercase, no punctuation.

---

## ⚠️ Use responsibly

This thing is loud and uses flashing visuals. Please:

- Don't use it on anyone with a **heart condition, epilepsy / photosensitivity**, or anxiety issues.
- Keep it to **friends who'll laugh about it afterward**. Harmless chaos only.

---

## 👤 Credit

Built by **[Grayson Anderson](https://www.linkedin.com/in/grayson-anderson-95781226a/)**.

If you get someone good with it, that one's for me. 😄
