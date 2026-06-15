# ⌨️ typetest — the typing test that bites back

A pixel-faithful clone of a sleek, modern typing test (think [Monkeytype](https://monkeytype.com))… except it's a **prank**. Your friend sits down, breezes through a calm little typing test, and the moment they finish the last word — **jumpscare**. Then it quietly drops them back to the setup screen, settings untouched, ready for the next victim.

It's honest about it too: the setup page tells *you* it's a prank up front. The deception is for whoever you hand the keyboard to.

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
  | 👁 | **the watcher** | the lights die, two eyes open and drift closer… then it strikes |
  | 🩸 | **red alert** | the screen floods blood-red and convulses while an alarm blares |
  | 💻 | **fake crash** | a convincing fake "blue screen" — they lean in to read it, and *that's* when it hits |

- **Resets itself** — after the scare it returns to the setup screen with the same prompt and scare still selected, so you can run it again instantly.
- **Zero dependencies, zero build step** — just plain HTML, CSS, and JavaScript. All sound is generated live with the Web Audio API and the scary face is inline SVG, so there are **no image or audio files to download.**

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
3. **Pick a scare** from the six cards.
4. Click **start test** and hand over the keyboard.
5. Your victim types the test like normal… and gets got on the final word.
6. The page returns to setup automatically. Line up the next one.

> 🔊 **Sound note:** browsers block audio until the user interacts with the page. The site unlocks audio on the first click (picking a scare or pressing start), so as long as someone has clicked, the scares will be loud. Do a quick test run yourself first.

---

## 🥚 Easter egg (spoiler)

There's a **secret seventh scare** that never appears in the picker and is never hinted at on the site. To unlock it, enter the **Konami code** on the setup screen — at any point, just type:

```
↑ ↑ ↓ ↓ ← → ← → B A  then  Enter
```

That final **Enter** doubles as "start," launching the test with the hidden **🪵 tung tung tung sahur** scare armed. Your victim types like normal and gets the accelerating wooden-knock buildup before the log creature lunges. It only stays armed for that one run.

> **About the audio:** by default the "tung tung tung" knocks are generated live with the Web Audio API (so there are still no asset files). If you'd rather use a real, properly-cropped clip, open `scares.js` and set `TUNG_AUDIO_SRC` to a URL or base64 data URI — it'll play that instead and skip the synth. Adjust `TUNG_AUDIO_HIT_MS` to line the lunge up with your clip.

---

## 📁 Project structure

```
typing-test-jumpscare/
├── index.html    # markup: setup screen, test screen, scare layer
├── style.css     # monkeytype-style theme, animations, scare keyframes
├── prompts.js    # the randomizable word lists
├── scares.js     # the Web Audio engine, SVG face, and 6 scares
├── script.js     # test logic, live stats, caret, and the prank handoff
└── README.md
```

**Adding your own scare?** Append an object to the `SCARES` array in `scares.js` with an `id`, `emoji`, `name`, `desc`, and a `run(layer)` method that builds the visuals and returns the duration in milliseconds. It'll show up as a selectable card automatically.

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
