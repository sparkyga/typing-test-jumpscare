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
  const coffeeBtn = document.getElementById("coffeeBtn");
  const shareBtn = document.getElementById("shareBtn");
  const resultsScreen = document.getElementById("results");
  const toastEl = document.getElementById("toast");

  viewport.style.position = "relative";

  /* ===================== THEME PICKER ===================== */
  const THEMES = ["serika", "dracula", "matrix", "coral"];
  function applyTheme(name) {
    if (!THEMES.includes(name)) name = "serika";
    if (name === "serika") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", name);
    try { localStorage.setItem("tt-theme", name); } catch (e) {}
    document.querySelectorAll(".theme-dot").forEach((d) =>
      d.classList.toggle("active", d.dataset.theme === name));
  }
  document.querySelectorAll(".theme-dot").forEach((d) => {
    d.addEventListener("click", () => applyTheme(d.dataset.theme));
  });
  let savedTheme = "serika";
  try { savedTheme = localStorage.getItem("tt-theme") || "serika"; } catch (e) {}
  applyTheme(savedTheme);

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
  let offset = 1;            // the player number that actually gets scared
  let currentPlayer = 1;     // whose turn it is right now (advances on "next")
  let test = null;           // active test session
  let finished = false;

  /* ===================== SETUP: offset stepper ===================== */
  const offsetVal = document.getElementById("offsetVal");
  const offsetSub = document.getElementById("offsetSub");
  function renderOffset() {
    offsetVal.textContent = offset;
    offsetSub.textContent = offset === 1 ? "first player" : "player #" + offset;
  }
  document.getElementById("offsetMinus").addEventListener("click", () => {
    offset = Math.max(1, offset - 1); renderOffset();
  });
  document.getElementById("offsetPlus").addEventListener("click", () => {
    offset = Math.min(50, offset + 1); renderOffset();
  });
  renderOffset();

  /* ===================== SETUP: scare cards ===================== */
  function setSelectedScare(id) {
    selectedScare = id;
    document.querySelectorAll(".scare-card").forEach((c) =>
      c.classList.toggle("selected", c.dataset.id === id));
  }
  // a "surprise me" meta-card up front, then the real scares
  const pickerCards = [
    { id: "random", emoji: "🎲", name: "surprise me",
      desc: "picks one of the scares at random when the test ends — even you won't know which." },
    ...SCARES.filter((s) => !s.hidden),
  ];
  pickerCards.forEach((s) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "scare-card" + (s.id === selectedScare ? " selected" : "");
    card.dataset.id = s.id;
    card.innerHTML = `
      <div class="sc-top"><span class="sc-emoji">${s.emoji}</span><span class="sc-name">${s.name}</span></div>
      <div class="sc-desc">${s.desc}</div>
      <div class="sc-check">▸ selected</div>`;
    card.addEventListener("click", () => {
      setSelectedScare(s.id);
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
      typed: 0,
      dispWpm: 0,
      samples: [],
      lastSec: -1,
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
    // one wpm sample per second for the results graph
    const sec = Math.floor(elapsed);
    if (test.startTime && sec > test.lastSec) {
      test.lastSec = sec;
      test.samples.push(Math.round(test.dispWpm));
    }
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
      AudioKit.warm(); // typing is a user gesture — unlock audio for the scare
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
      test.typed++;
    } else {
      // extra letters past the word (count as typed + a mistake)
      if (w.extras.length < 12) {
        const ex = document.createElement("span");
        ex.className = "char extra";
        ex.textContent = k;
        w.el.appendChild(ex);
        w.extras.push({ el: ex });
        test.typed++;
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
    resultsScreen.classList.add("hidden");
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
    resultsScreen.classList.add("hidden");
    homeScreen.classList.remove("hidden");
    currentPlayer = 1; // back at config = a fresh round
    // settings are untouched — same prompt, same scare selected
  }

  // run a scare overlay by id, then drop back to the config screen
  function playScare(scareId) {
    // "surprise me" resolves to a random visible scare at fire time
    if (scareId === "random") {
      const pool = SCARES.filter((s) => !s.hidden);
      scareId = pool[Math.floor(Math.random() * pool.length)].id;
    }
    const scare = SCARES.find((s) => s.id === scareId) || SCARES[0];
    let dur = 2600;
    try { dur = scare.run(scareLayer) || dur; } catch (e) { console.error(e); }
    setTimeout(() => {
      scareLayer.classList.add("hidden");
      scareLayer.innerHTML = "";
      scareLayer.style.background = "#000";
      returnHome();
      finished = false;
    }, dur);
  }

  function finishTest() {
    if (finished) return;
    finished = true;
    if (test && test.timerIv) clearInterval(test.timerIv);
    window.removeEventListener("keydown", onKey);

    // the konami unlock always fires; otherwise only the target player
    // (the offset-th) gets scared. everyone before just sees their results.
    const isTarget = !!forceScare || currentPlayer >= offset;
    const scareId = forceScare || selectedScare;
    forceScare = null;

    if (isTarget) {
      playScare(scareId); // after the scare, returnHome() resets the round
    } else {
      // not this player's turn — show a legit-looking results screen so the
      // "competition" holds up. "next" hands off to the next player.
      const stats = computeStats();
      teardownTest();
      finished = false;
      showResults(stats);
    }
  }

  /* ===================== FAKE RESULTS (skipped players) ===================== */
  function computeStats() {
    const elapsed = test.startTime ? Math.max(0.5, (Date.now() - test.startTime) / 1000) : 0.5;
    const wpm = Math.round((test.correct / 5) / (elapsed / 60));
    const raw = Math.round((test.typed / 5) / (elapsed / 60));
    const acc = test.typed ? Math.round((test.correct / test.typed) * 100) : 100;
    const cons = Math.max(62, Math.min(100, acc - Math.floor(Math.random() * 7)));
    return {
      wpm, raw, acc, cons,
      correct: test.correct, typed: test.typed,
      time: Math.round(elapsed),
      samples: test.samples.slice(),
    };
  }

  function drawGraph(samples) {
    if (samples.length < 2) samples = [0, ...samples, samples[samples.length - 1] || 0];
    const W = 600, H = 130, pad = 14;
    const max = Math.max(20, ...samples) * 1.12;
    const stepX = (W - pad * 2) / (samples.length - 1);
    const pts = samples.map((v, i) => {
      const x = pad + i * stepX;
      const y = H - pad - (v / max) * (H - pad * 2);
      return [x, y];
    });
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const area = line + ` L${pts[pts.length - 1][0].toFixed(1)} ${H - pad} L${pts[0][0].toFixed(1)} ${H - pad} Z`;
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <path d="${area}" fill="var(--main-soft)"/>
      <path d="${line}" fill="none" stroke="var(--main)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
  }

  function showResults(stats) {
    document.getElementById("resWpm").textContent = stats.wpm;
    document.getElementById("resAcc").textContent = stats.acc + "%";
    document.getElementById("resRaw").textContent = stats.raw;
    document.getElementById("resChars").textContent = stats.correct + "/" + stats.typed;
    document.getElementById("resCons").textContent = stats.cons + "%";
    document.getElementById("resTime").textContent = stats.time + "s";
    document.getElementById("resGraph").innerHTML = drawGraph(stats.samples);

    // personal best (fun, persisted)
    let pb = 0;
    try { pb = +(localStorage.getItem("tt-pb") || 0); } catch (e) {}
    const pbEl = document.getElementById("resPb");
    if (stats.wpm > pb) {
      try { localStorage.setItem("tt-pb", String(stats.wpm)); } catch (e) {}
      pbEl.classList.remove("hidden");
    } else {
      pbEl.classList.add("hidden");
    }

    homeScreen.classList.add("hidden");
    testScreen.classList.add("hidden");
    resultsScreen.classList.remove("hidden");
  }
  // "next" = hand the keyboard to the next player and run the test again,
  // staying inside the test loop so config (and the prank) never shows
  document.getElementById("resNext").addEventListener("click", () => {
    currentPlayer++;
    startTest();
  });

  // the "buy me a coffee" trap: instant scare, no typing required
  coffeeBtn.addEventListener("click", () => {
    AudioKit.warm();
    if (finished) return;
    finished = true;
    coffeeBtn.blur();
    teardownTest();
    playScare("coffee");
  });

  startBtn.addEventListener("click", startTest);

  /* ===================== TOAST + SHARE LINK ===================== */
  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    void toastEl.offsetWidth; // reflow so the transition replays
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
      setTimeout(() => toastEl.classList.add("hidden"), 220);
    }, 2600);
  }

  // build a link that re-creates the current setup (and auto-launches the test)
  function buildShareURL() {
    const u = new URL(location.origin + location.pathname);
    u.searchParams.set("w", promptInput.value.trim());
    u.searchParams.set("s", selectedScare);
    u.searchParams.set("o", String(offset));
    u.searchParams.set("play", "1");
    return u.toString();
  }
  shareBtn.addEventListener("click", async () => {
    const url = buildShareURL();
    try {
      await navigator.clipboard.writeText(url);
      showToast("game link copied — send it to your victim 😈");
    } catch (e) {
      // clipboard blocked (e.g. file://) — fall back to a prompt
      window.prompt("copy this game link:", url);
    }
  });

  // mode bar: "words" is the (fake) active mode; clicking any other option
  // is the secret exit straight back to the config screen.
  document.querySelectorAll(".mode-opt").forEach((opt) => {
    opt.addEventListener("click", () => {
      opt.blur(); // don't let the button steal keystrokes
      if (opt.dataset.mode === "words") return;
      if (finished) return; // a scare is already mid-run
      returnHome();
    });
  });
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

  /* ===================== SHARED LINK / QUICK LINK ===================== */
  // a shared link carries the setup in the query string:
  //   ?w=<words>&s=<scareId>&o=<offset>&play=1
  // also supports the quick link  ...domain/test  ( or  #test  /  ?test ).
  const params = new URLSearchParams(location.search);

  if (params.has("w")) {
    promptInput.value = params.get("w");
    presetNameEl.textContent = "";
    updateWordCount();
  }
  if (params.has("s")) {
    const sid = params.get("s");
    if (sid === "random" || SCARES.some((s) => s.id === sid && !s.hidden)) {
      setSelectedScare(sid);
    }
  }
  if (params.has("o")) {
    const o = parseInt(params.get("o"), 10);
    if (!isNaN(o)) { offset = Math.max(1, Math.min(50, o)); renderOffset(); }
  }

  function wantsQuickTest() {
    const path = location.pathname.replace(/\/+$/, "").toLowerCase();
    return params.get("play") === "1" ||
      /\/test$/.test(path) ||
      location.hash.toLowerCase() === "#test" ||
      params.has("test");
  }
  if (wantsQuickTest()) {
    introModal.classList.add("hidden");
    startTest();
  }
})();
