/* ============================================================
   script.js — wires up the (fake) typing test + the prank.
   ============================================================ */
(function () {
  "use strict";

  // ---- elements ----
  const homeScreen = document.getElementById("home");
  const testScreen = document.getElementById("test");
  const promptInput = document.getElementById("promptInput");
  const randomBtn = document.getElementById("randomBtn");
  const wordCountEl = document.getElementById("wordCount");
  const presetNameEl = document.getElementById("presetName");
  const scarePicker = document.getElementById("scarePicker");
  const startBtn = document.getElementById("startBtn");
  const wordsEl = document.getElementById("words");
  const viewport = document.querySelector(".words-viewport");
  const testStats = document.querySelector(".test-stats");
  const liveTimer = document.getElementById("liveTimer");
  const liveWpm = document.getElementById("liveWpm");
  const liveProgress = document.getElementById("liveProgress");
  const restartBtn = document.getElementById("restartBtn");
  const scareLayer = document.getElementById("scareLayer");
  const introModal = document.getElementById("introModal");
  const introOk = document.getElementById("introOk");

  viewport.style.position = "relative";

  /* ===================== INTRO POPUP (first open only) ===================== */
  // shows on page load; once dismissed it never returns this session —
  // including after a scare drops you back to the settings page.
  introOk.addEventListener("click", () => {
    introModal.classList.add("closing");
    setTimeout(() => introModal.classList.add("hidden"), 300);
    AudioKit.warm(); // unlock audio on this first user gesture
  });

  // ---- state ----
  let selectedScare = SCARES[0].id;
  let forceScare = null;     // overrides selection for one run (konami unlock)
  let test = null;           // active test session
  let finished = false;

  /* ===================== SETUP: scare cards ===================== */
  SCARES.filter((s) => !s.hidden).forEach((s) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "scare-card" + (s.id === selectedScare ? " selected" : "");
    card.dataset.id = s.id;
    card.innerHTML = `
      <div class="sc-top"><span class="sc-emoji">${s.emoji}</span><span class="sc-name">${s.name}</span></div>
      <div class="sc-desc">${s.desc}</div>
      <div class="sc-check">▸ selected</div>`;
    card.addEventListener("click", () => {
      selectedScare = s.id;
      document.querySelectorAll(".scare-card").forEach((c) =>
        c.classList.toggle("selected", c.dataset.id === s.id));
      AudioKit.warm(); // unlock audio on interaction
    });
    scarePicker.appendChild(card);
  });

  /* ===================== SETUP: prompt ===================== */
  function cleanWords(str) {
    return str.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function updateWordCount() {
    const w = cleanWords(promptInput.value);
    const n = w ? w.split(" ").length : 0;
    wordCountEl.textContent = n + (n === 1 ? " word" : " words");
  }
  function loadPrompt(p) {
    promptInput.value = p.text;
    presetNameEl.textContent = "“" + p.name + "”";
    updateWordCount();
  }
  promptInput.addEventListener("input", () => {
    presetNameEl.textContent = "";
    updateWordCount();
  });
  randomBtn.addEventListener("click", () => {
    const p = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    loadPrompt(p);
  });

  // default starting prompt
  loadPrompt(PROMPTS[0]);

  /* ===================== TEST: build + run ===================== */
  function buildTest(text) {
    wordsEl.innerHTML = "";
    viewport.querySelectorAll(".caret").forEach((c) => c.remove()); // drop any stale caret
    const words = cleanWords(text).split(" ").filter(Boolean);
    if (words.length === 0) words.push("type", "something", "first");

    const wordObjs = words.map((w) => {
      const wEl = document.createElement("div");
      wEl.className = "word";
      const chars = [...w].map((ch) => {
        const cEl = document.createElement("span");
        cEl.className = "char";
        cEl.textContent = ch;
        wEl.appendChild(cEl);
        return { ch, el: cEl, state: "" };
      });
      wordsEl.appendChild(wEl);
      return { text: w, chars, el: wEl, extras: [] };
    });

    const caret = document.createElement("span");
    caret.className = "caret";
    viewport.appendChild(caret);

    // where the scare fires. short texts (<15 words) go all the way to the end;
    // longer ones get cut 2-6 words early, weighted so longer texts cut deeper.
    const total = wordObjs.length;
    let finishWi = total - 1;
    if (total >= 15) {
      const MIN = 2, MAX = 6;
      const lengthFactor = Math.min(1, (total - 15) / 30); // 0 at 15 words, 1 at 45+
      const center = MIN + lengthFactor * (MAX - MIN);
      let cut = Math.round(center + (Math.random() - 0.5) * 2.2);
      cut = Math.max(MIN, Math.min(MAX, cut));
      finishWi = total - 1 - cut;
    }

    return {
      words: wordObjs,
      wi: 0, ci: 0,
      finishWi,
      caret,
      startTime: 0,
      correct: 0,
      dispWpm: 0,
      timerIv: null,
    };
  }

  function positionCaret() {
    const w = test.words[test.wi];
    let rect, atRight = false;
    if (test.ci < w.chars.length) {
      rect = w.chars[test.ci].el.getBoundingClientRect();
    } else if (w.extras.length) {
      rect = w.extras[w.extras.length - 1].el.getBoundingClientRect();
      atRight = true;
    } else if (w.chars.length) {
      rect = w.chars[w.chars.length - 1].el.getBoundingClientRect();
      atRight = true;
    } else {
      rect = w.el.getBoundingClientRect();
    }
    const vp = viewport.getBoundingClientRect();
    test.caret.style.left = (rect.left - vp.left + (atRight ? rect.width : 0)) + "px";
    test.caret.style.top = (rect.top - vp.top) + "px";

    // scroll: keep caret near the second visible line
    const lineH = 38;
    const rel = rect.top - wordsEl.getBoundingClientRect().top;
    const shift = Math.max(0, Math.floor(rel / lineH) - 1) * lineH;
    wordsEl.style.transform = `translateY(${-shift}px)`;
  }

  // update a stat only when it changes, with a subtle classy tick
  function setStat(el, val) {
    val = String(val);
    if (el.textContent === val) return;
    el.textContent = val;
    if (el.animate) {
      el.animate(
        [{ opacity: 0.7, transform: "translateY(2px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 180, easing: "ease-out" }
      );
    }
  }

  function updateStats() {
    if (!test) return;
    const elapsed = test.startTime ? (Date.now() - test.startTime) / 1000 : 0;
    setStat(liveTimer, Math.floor(elapsed));
    // ease the displayed wpm toward the real value so it glides instead of
    // jittering on every keystroke
    let target = elapsed > 0.4 ? (test.correct / 5) / (elapsed / 60) : 0;
    target = Math.min(target, 240);
    test.dispWpm += (target - test.dispWpm) * 0.16;
    setStat(liveWpm, Math.round(test.dispWpm));
    const pct = Math.round((test.wi / test.words.length) * 100);
    setStat(liveProgress, pct + "%");
  }

  function onKey(e) {
    if (!test || finished) return;
    const k = e.key;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (k === "Backspace") {
      e.preventDefault();
      const w = test.words[test.wi];
      if (w.extras.length) {
        const x = w.extras.pop();
        x.el.remove();
      } else if (test.ci > 0) {
        test.ci--;
        const c = w.chars[test.ci];
        if (c.state === "correct") test.correct--;
        c.state = ""; c.el.className = "char";
      } else if (test.wi > 0) {
        test.wi--;
        const pw = test.words[test.wi];
        test.ci = pw.chars.length;
      }
      positionCaret();
      return;
    }

    if (k.length !== 1) return; // ignore non-printable
    e.preventDefault();

    if (!test.startTime) {
      test.startTime = Date.now();
      test.timerIv = setInterval(updateStats, 150);
    }

    const w = test.words[test.wi];

    if (k === " ") {
      // advance to next word (only if started typing it)
      if (test.ci === 0 && w.extras.length === 0) return;
      if (test.wi < test.words.length - 1) {
        test.wi++;
        test.ci = 0;
        positionCaret();
        updateStats();
        checkFinish();
      }
      return;
    }

    if (test.ci < w.chars.length) {
      const c = w.chars[test.ci];
      if (k === c.ch) { c.state = "correct"; c.el.className = "char correct"; test.correct++; }
      else { c.state = "incorrect"; c.el.className = "char incorrect"; }
      test.ci++;
    } else {
      // extra letters past the word
      if (w.extras.length < 12) {
        const ex = document.createElement("span");
        ex.className = "char extra";
        ex.textContent = k;
        w.el.appendChild(ex);
        w.extras.push({ el: ex });
      }
    }

    positionCaret();
    updateStats();
    checkFinish();
  }

  // fire the scare once the cutoff word is reached/filled
  function checkFinish() {
    if (!test || finished) return;
    const w = test.words[test.wi];
    if (test.wi > test.finishWi || (test.wi === test.finishWi && test.ci >= w.chars.length)) {
      finishTest();
    }
  }

  /* ===================== START / RESTART / FINISH ===================== */
  function startTest() {
    finished = false;
    AudioKit.warm();
    test = buildTest(promptInput.value);
    homeScreen.classList.add("hidden");
    testScreen.classList.remove("hidden");
    if (testStats.animate) {
      testStats.animate(
        [{ opacity: 0, transform: "translateY(-12px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 520, easing: "cubic-bezier(.22,.61,.36,1)" }
      );
    }
    updateStats();
    positionCaret();
    window.addEventListener("keydown", onKey);
    // focus trap so mobile keyboards / odd browsers still feed keys
    window.scrollTo(0, 0);
  }

  function teardownTest() {
    if (test && test.timerIv) clearInterval(test.timerIv);
    window.removeEventListener("keydown", onKey);
    test = null;
  }

  function returnHome() {
    teardownTest();
    testScreen.classList.add("hidden");
    homeScreen.classList.remove("hidden");
    // settings are untouched — same prompt, same scare selected
  }

  function finishTest() {
    if (finished) return;
    finished = true;
    if (test && test.timerIv) clearInterval(test.timerIv);
    window.removeEventListener("keydown", onKey);

    const scareId = forceScare || selectedScare;
    forceScare = null;
    const scare = SCARES.find((s) => s.id === scareId) || SCARES[0];
    let dur = 2600;
    try { dur = scare.run(scareLayer) || dur; } catch (e) { console.error(e); }

    setTimeout(() => {
      scareLayer.classList.add("hidden");
      scareLayer.innerHTML = "";
      scareLayer.style.background = "#000";
      returnHome();
    }, dur);
  }

  startBtn.addEventListener("click", startTest);
  restartBtn.addEventListener("click", () => {
    teardownTest();
    test = buildTest(promptInput.value);
    finished = false;
    window.addEventListener("keydown", onKey);
    updateStats();
    positionCaret();
  });

  // keep caret aligned on resize
  window.addEventListener("resize", () => { if (test) positionCaret(); });

  /* ===================== EASTER EGG: konami code ===================== */
  // on the config screen: ↑ ↑ ↓ ↓ ← → ← → b a  then Enter (= start)
  // arms the hidden "tung tung sahur" scare for that run. silent — no UI hint.
  const KONAMI = [
    "arrowup", "arrowup", "arrowdown", "arrowdown",
    "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"
  ];
  let konamiBuf = [];
  window.addEventListener("keydown", (e) => {
    // only while setting up (not during a running test / scare)
    if (homeScreen.classList.contains("hidden")) return;
    const key = (e.key || "").toLowerCase();

    if (key === "enter") {
      if (konamiBuf.join(",") === KONAMI.join(",")) {
        e.preventDefault();
        konamiBuf = [];
        forceScare = "tungtung";
        startTest();
      }
      return;
    }
    konamiBuf.push(key);
    if (konamiBuf.length > KONAMI.length) konamiBuf.shift();
  });
})();
