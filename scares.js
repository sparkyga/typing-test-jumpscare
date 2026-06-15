/* ============================================================
   scares.js — the payload.
   each scare builds its visuals into the #scareLayer and drives
   synthesized audio (Web Audio API, no asset files needed).
   scare.run(layer) returns the total duration in ms; script.js
   clears the layer and returns home after that.
   ============================================================ */

/* ---------- audio engine: everything synthesized live ---------- */
const AudioKit = {
  ctx: null,
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },
  // call once on a user gesture so audio is unlocked for later
  warm() { try { this.ensure(); } catch (e) {} },

  _noiseBuffer(dur) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },

  // harsh layered scream: noise sweep + detuned saws crashing downward
  scream(dur = 1.6, vol = 0.9) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    master.gain.setValueAtTime(vol, t + dur - 0.25);
    master.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    master.connect(ctx.destination);

    // noise through a sweeping bandpass = shriek texture
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(dur);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 6;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(3600, t + dur * 0.4);
    bp.frequency.exponentialRampToValueAtTime(400, t + dur);
    const ng = ctx.createGain();
    ng.gain.value = 0.6;
    noise.connect(bp).connect(ng).connect(master);
    noise.start(t); noise.stop(t + dur);

    // two detuned sawtooths wailing
    [0, 12].forEach((cents, i) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(680 + i * 30, t);
      o.frequency.exponentialRampToValueAtTime(1500, t + dur * 0.25);
      o.frequency.exponentialRampToValueAtTime(220, t + dur);
      o.detune.value = cents * (i ? 1 : -1) * 8;
      const g = ctx.createGain();
      g.gain.value = 0.22;
      // vibrato
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 16;
      const lg = ctx.createGain();
      lg.gain.value = 40;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t); lfo.stop(t + dur);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + dur);
    });
    return dur * 1000;
  },

  // deep gut-punch boom
  boom(vol = 0.95) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + 0.95);
  },

  // emergency siren wail
  siren(dur = 2.2, vol = 0.55) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
    g.gain.setValueAtTime(vol, t + dur - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 1.6;
    const lg = ctx.createGain();
    lg.gain.value = 360;
    o.frequency.value = 720;
    lfo.connect(lg).connect(o.frequency);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur);
    lfo.start(t); lfo.stop(t + dur);
    return dur * 1000;
  },

  // bursty digital static / glitch
  glitchNoise(dur = 1.4, vol = 0.8) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(dur);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1200;
    const g = ctx.createGain();
    // stutter the gain to make it crunch
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < dur * 28; i++) {
      const tt = t + i / 28;
      g.gain.setValueAtTime(Math.random() > 0.4 ? vol : 0.04, tt);
    }
    g.gain.setValueAtTime(0.0001, t + dur);
    noise.connect(hp).connect(g).connect(ctx.destination);
    noise.start(t); noise.stop(t + dur);
    return dur * 1000;
  },

  // single sharp beep (used for fake errors / buildup)
  beep(freq = 880, dur = 0.12, vol = 0.3) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  }
};

/* ---------- a reusable ghoulish face (SVG) ---------- */
function faceSVG() {
  return `
  <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="skin" cx="50%" cy="42%" r="60%">
        <stop offset="0%" stop-color="#cfc7b8"/>
        <stop offset="70%" stop-color="#9a917f"/>
        <stop offset="100%" stop-color="#3c382f"/>
      </radialGradient>
      <radialGradient id="socket" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#000"/>
        <stop offset="75%" stop-color="#000"/>
        <stop offset="100%" stop-color="#160707"/>
      </radialGradient>
    </defs>
    <rect width="400" height="400" fill="#000"/>
    <path d="M200 36 C300 36 340 130 336 210 C332 300 280 372 200 372 C120 372 68 300 64 210 C60 130 100 36 200 36 Z" fill="url(#skin)"/>
    <!-- cheek hollows -->
    <path d="M96 230 C120 270 130 300 150 320 C120 312 92 280 86 240 Z" fill="#2a2720" opacity="0.7"/>
    <path d="M304 230 C280 270 270 300 250 320 C280 312 308 280 314 240 Z" fill="#2a2720" opacity="0.7"/>
    <!-- eyes -->
    <ellipse cx="138" cy="172" rx="44" ry="52" fill="url(#socket)"/>
    <ellipse cx="262" cy="172" rx="44" ry="52" fill="url(#socket)"/>
    <circle cx="146" cy="182" r="9" fill="#d81f2a"/>
    <circle cx="254" cy="182" r="9" fill="#d81f2a"/>
    <circle cx="146" cy="182" r="3" fill="#fff"/>
    <circle cx="254" cy="182" r="3" fill="#fff"/>
    <!-- brow shadows -->
    <path d="M96 132 L188 158 L184 172 L98 150 Z" fill="#1c1a15"/>
    <path d="M304 132 L212 158 L216 172 L302 150 Z" fill="#1c1a15"/>
    <!-- nose -->
    <path d="M200 196 L184 256 L200 268 L216 256 Z" fill="#241f18"/>
    <!-- gaping mouth with jagged teeth -->
    <path d="M132 286 C160 276 240 276 268 286 C256 340 232 360 200 360 C168 360 144 340 132 286 Z" fill="#0a0505"/>
    <path d="M138 290 L150 312 L162 290 L174 314 L186 290 L198 316 L210 290 L222 314 L234 290 L246 312 L258 290
             L250 300 L246 300 L240 314 L228 300 L222 300 L214 318 L204 300 L196 300 L188 318 L178 300 L172 300 L162 314 L156 300 L150 300 Z"
          fill="#d8cfb8"/>
    <!-- streaks -->
    <path d="M146 224 q-6 60 -2 120" stroke="#5a0b0b" stroke-width="4" fill="none" opacity="0.8"/>
    <path d="M254 224 q6 50 3 96" stroke="#5a0b0b" stroke-width="3" fill="none" opacity="0.7"/>
  </svg>`;
}

/* ---------- screaming skull (rave from hell) ---------- */
function faceSkull() {
  return `
  <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bone" cx="50%" cy="40%" r="65%">
        <stop offset="0%" stop-color="#f4efe2"/>
        <stop offset="68%" stop-color="#cfc6b0"/>
        <stop offset="100%" stop-color="#6e6450"/>
      </radialGradient>
    </defs>
    <rect width="400" height="400" fill="#000"/>
    <path d="M200 40 C290 40 330 120 326 196 C324 240 306 268 280 286 L284 318 C284 340 268 348 248 348 L152 348 C132 348 116 340 116 318 L120 286 C94 268 76 240 74 196 C70 120 110 40 200 40 Z" fill="url(#bone)"/>
    <path d="M118 172 C118 140 162 138 170 170 C175 202 150 218 130 208 C120 202 118 188 118 172 Z" fill="#0a0805"/>
    <path d="M282 172 C282 140 238 138 230 170 C225 202 250 218 270 208 C280 202 282 188 282 172 Z" fill="#0a0805"/>
    <circle cx="148" cy="182" r="6" fill="#b01818"/>
    <circle cx="252" cy="182" r="6" fill="#b01818"/>
    <path d="M200 208 L182 252 L200 264 L218 252 Z" fill="#0a0805"/>
    <rect x="150" y="298" width="100" height="48" rx="7" fill="#0a0805"/>
    <g stroke="#cfc6b0" stroke-width="4">
      <line x1="166" y1="298" x2="166" y2="346"/>
      <line x1="183" y1="298" x2="183" y2="346"/>
      <line x1="200" y1="298" x2="200" y2="346"/>
      <line x1="217" y1="298" x2="217" y2="346"/>
      <line x1="234" y1="298" x2="234" y2="346"/>
    </g>
  </svg>`;
}

/* ---------- corrupted glitch face (signal lost) ---------- */
function faceGlitch() {
  const head = "M200 50 C285 50 320 130 314 210 C308 300 260 360 200 360 C140 360 92 300 86 210 C80 130 115 50 200 50 Z";
  return `
  <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="400" fill="#000"/>
    <path d="${head}" fill="none" stroke="#ff0040" stroke-width="7" transform="translate(-7,0)" opacity="0.9"/>
    <path d="${head}" fill="none" stroke="#00f6ff" stroke-width="7" transform="translate(7,3)" opacity="0.9"/>
    <path d="${head}" fill="#cfcfcf"/>
    <rect x="118" y="150" width="64" height="30" fill="#ff0040" opacity="0.55" transform="translate(-6,0)"/>
    <rect x="118" y="150" width="64" height="30" fill="#000"/>
    <rect x="218" y="150" width="64" height="30" fill="#00f6ff" opacity="0.55" transform="translate(6,0)"/>
    <rect x="218" y="150" width="64" height="30" fill="#000"/>
    <path d="M130 268 l22 20 l18 -16 l20 20 l18 -18 l22 20 l20 -18 L300 272 L286 302 L130 302 Z" fill="#000"/>
    <g opacity="0.8">
      <rect x="0" y="118" width="400" height="6" fill="#fff"/>
      <rect x="0" y="232" width="400" height="4" fill="#ff0040"/>
      <rect x="0" y="300" width="400" height="5" fill="#00f6ff"/>
    </g>
  </svg>`;
}

/* ---------- pale hollow watcher (the watcher) ---------- */
function faceWatcher() {
  return `
  <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="pale" cx="50%" cy="38%" r="62%">
        <stop offset="0%" stop-color="#e0dccf"/>
        <stop offset="70%" stop-color="#a39d8c"/>
        <stop offset="100%" stop-color="#3b382f"/>
      </radialGradient>
    </defs>
    <rect width="400" height="400" fill="#000"/>
    <path d="M200 24 C264 24 290 88 286 172 C282 264 246 372 200 372 C154 372 118 264 114 172 C110 88 136 24 200 24 Z" fill="url(#pale)"/>
    <ellipse cx="160" cy="158" rx="27" ry="41" fill="#040404"/>
    <ellipse cx="240" cy="158" rx="27" ry="41" fill="#040404"/>
    <path d="M160 196 q-5 78 -2 132" stroke="#050505" stroke-width="11" fill="none" stroke-linecap="round"/>
    <path d="M240 196 q5 66 2 120" stroke="#050505" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M168 286 q32 18 64 0" stroke="#26221b" stroke-width="6" fill="none" stroke-linecap="round"/>
  </svg>`;
}

/* ---------- horned demon (red alert) ---------- */
function faceDemon() {
  return `
  <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="dskin" cx="50%" cy="42%" r="62%">
        <stop offset="0%" stop-color="#c4241f"/>
        <stop offset="70%" stop-color="#7e1311"/>
        <stop offset="100%" stop-color="#2a0606"/>
      </radialGradient>
    </defs>
    <rect width="400" height="400" fill="#1a0000"/>
    <path d="M126 96 C100 44 72 32 58 24 C96 40 122 60 146 100 Z" fill="#2a0a0a"/>
    <path d="M274 96 C300 44 328 32 342 24 C304 40 278 60 254 100 Z" fill="#2a0a0a"/>
    <path d="M200 70 C292 70 320 150 312 220 C304 300 260 360 200 360 C140 360 96 300 88 220 C80 150 108 70 200 70 Z" fill="url(#dskin)"/>
    <path d="M116 176 L188 150 L182 184 L120 196 Z" fill="#ffd21a"/>
    <path d="M284 176 L212 150 L218 184 L280 196 Z" fill="#ffd21a"/>
    <path d="M150 172 l16 -4 l-2 18 l-14 4 Z" fill="#160000"/>
    <path d="M250 172 l-16 -4 l2 18 l14 4 Z" fill="#160000"/>
    <path d="M120 246 Q200 236 280 246 Q250 332 200 338 Q150 332 120 246 Z" fill="#180404"/>
    <path d="M132 252 l16 30 l14 -26 l16 30 l16 -28 l16 30 l16 -26 l16 26 L268 252 Z" fill="#efe6cf"/>
    <path d="M150 280 l-8 40 l16 -22 Z" fill="#efe6cf"/>
    <path d="M250 280 l8 40 l-16 -22 Z" fill="#efe6cf"/>
  </svg>`;
}

/* ---------- stitched corpse (fake crash) ---------- */
function faceDead() {
  return `
  <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="corpse" cx="50%" cy="40%" r="64%">
        <stop offset="0%" stop-color="#b9c0ac"/>
        <stop offset="70%" stop-color="#7c8270"/>
        <stop offset="100%" stop-color="#2f342a"/>
      </radialGradient>
    </defs>
    <rect width="400" height="400" fill="#000"/>
    <path d="M200 44 C292 44 330 124 324 206 C318 300 264 360 200 360 C136 360 82 300 76 206 C70 124 108 44 200 44 Z" fill="url(#corpse)"/>
    <g stroke="#161009" stroke-width="11" stroke-linecap="round">
      <line x1="120" y1="150" x2="172" y2="202"/>
      <line x1="172" y1="150" x2="120" y2="202"/>
      <line x1="228" y1="150" x2="280" y2="202"/>
      <line x1="280" y1="150" x2="228" y2="202"/>
    </g>
    <line x1="138" y1="288" x2="262" y2="288" stroke="#161009" stroke-width="9" stroke-linecap="round"/>
    <g stroke="#161009" stroke-width="5">
      <line x1="158" y1="272" x2="158" y2="304"/>
      <line x1="183" y1="272" x2="183" y2="304"/>
      <line x1="208" y1="272" x2="208" y2="304"/>
      <line x1="233" y1="272" x2="233" y2="304"/>
    </g>
  </svg>`;
}

/* small helper to set layer html + show it */
function show(layer, html, bg = "#000") {
  layer.style.background = bg;
  layer.innerHTML = html;
  layer.classList.remove("hidden");
}

/* ---------- hidden scare: tung tung tung sahur ---------- */
/* OPTIONAL: to use a real, properly-cropped audio clip instead of the
   synthesized wooden knocks, paste a URL or base64 data URI below.
   When set, it plays the clip and skips the synth. */
const TUNG_AUDIO_SRC = "";       // e.g. "tung.mp3" or "data:audio/mpeg;base64,...."
const TUNG_AUDIO_HIT_MS = 1500;  // when the lunge fires if using a real clip

// a single wooden "tung" — pitched knock with a sharp transient
function woodHit(time, freq = 200, vol = 0.7) {
  const ctx = AudioKit.ensure();
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(freq, time);
  o.frequency.exponentialRampToValueAtTime(freq * 0.5, time + 0.09);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
  o.connect(g).connect(ctx.destination);
  o.start(time); o.stop(time + 0.15);
  // knock transient
  const n = ctx.createBufferSource();
  n.buffer = AudioKit._noiseBuffer(0.035);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = freq * 4; bp.Q.value = 1.8;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(vol * 0.7, time);
  ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
  n.connect(bp).connect(ng).connect(ctx.destination);
  n.start(time); n.stop(time + 0.04);
}

// the wooden bat-wielding log creature
function tungSVG() {
  return `
  <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#7a4a22"/>
        <stop offset="45%" stop-color="#9c6630"/>
        <stop offset="100%" stop-color="#5e3517"/>
      </linearGradient>
      <linearGradient id="bat" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#caa15e"/>
        <stop offset="100%" stop-color="#8a6a32"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="#0a0805"/>
    <!-- left arm + raised bat -->
    <path d="M150 150 L96 96" stroke="#5e3517" stroke-width="12" stroke-linecap="round"/>
    <g transform="rotate(-38 96 96)">
      <rect x="78" y="18" width="34" height="88" rx="16" fill="url(#bat)"/>
      <rect x="86" y="98" width="18" height="22" rx="6" fill="#6b4a22"/>
    </g>
    <!-- right arm -->
    <path d="M250 150 L300 196" stroke="#5e3517" stroke-width="12" stroke-linecap="round"/>
    <!-- legs + shoes -->
    <path d="M176 312 L168 372" stroke="#5e3517" stroke-width="13" stroke-linecap="round"/>
    <path d="M224 312 L232 372" stroke="#5e3517" stroke-width="13" stroke-linecap="round"/>
    <ellipse cx="160" cy="378" rx="26" ry="12" fill="#111"/>
    <ellipse cx="240" cy="378" rx="26" ry="12" fill="#111"/>
    <!-- log body -->
    <rect x="146" y="64" width="108" height="252" rx="52" fill="url(#wood)" stroke="#3c220f" stroke-width="4"/>
    <!-- grain + cracks -->
    <path d="M176 80 q-8 80 2 220" stroke="#4d2c14" stroke-width="3" fill="none" opacity="0.6"/>
    <path d="M224 86 q8 70 -2 210" stroke="#4d2c14" stroke-width="2.5" fill="none" opacity="0.5"/>
    <path d="M200 70 l-10 26 l12 18 l-8 22" stroke="#3a2010" stroke-width="3" fill="none" opacity="0.7"/>
    <!-- angry brows -->
    <path d="M158 150 L196 166" stroke="#2a1708" stroke-width="11" stroke-linecap="round"/>
    <path d="M242 150 L204 166" stroke="#2a1708" stroke-width="11" stroke-linecap="round"/>
    <!-- eyes -->
    <ellipse cx="178" cy="184" rx="20" ry="24" fill="#fff"/>
    <ellipse cx="222" cy="184" rx="20" ry="24" fill="#fff"/>
    <circle cx="182" cy="190" r="9" fill="#161616"/>
    <circle cx="218" cy="190" r="9" fill="#161616"/>
    <!-- shouting mouth -->
    <path d="M170 232 Q200 224 230 232 Q224 282 200 286 Q176 282 170 232 Z" fill="#1a0a06"/>
    <path d="M182 236 l8 14 l10 -12 l10 12 l8 -14" fill="#e8d8b0" opacity="0.9"/>
    <path d="M186 276 q14 10 28 0" fill="#5a1410"/>
  </svg>`;
}

/* ============================================================
   THE SCARES
   ============================================================ */
window.SCARES = [
  {
    id: "classic",
    emoji: "😱",
    name: "the classic",
    desc: "screen snaps to a screaming face that lunges at you. loud. simple. effective.",
    run(layer) {
      const dur = 2600;
      show(layer, `<div class="scare-img" style="animation:zoomIn .35s ease-out forwards">${faceSVG()}</div>`);
      AudioKit.boom();
      AudioKit.scream(2.0, 0.95);
      // little aftershake
      const node = layer.firstElementChild;
      setTimeout(() => { node.style.animation = "shake .35s infinite"; }, 360);
      return dur;
    }
  },
  {
    id: "strobe",
    emoji: "🚨",
    name: "rave from hell",
    desc: "blinding black-and-white strobe with a screaming siren. disorienting and brutal.",
    run(layer) {
      const dur = 3000;
      show(layer, `<div class="scare-img" style="animation:strobe .07s steps(1) infinite"></div>
        <div class="scare-img" style="opacity:.85;animation:flicker .9s infinite">${faceSkull()}</div>`);
      AudioKit.siren(2.8, 0.6);
      AudioKit.glitchNoise(2.8, 0.4);
      return dur;
    }
  },
  {
    id: "glitch",
    emoji: "📺",
    name: "signal lost",
    desc: "the screen tears apart into static and digital garbage, then a face flickers through.",
    run(layer) {
      const dur = 3000;
      const bars = Array.from({ length: 60 }, () => {
        const h = (Math.random() * 5 + 1).toFixed(1);
        const c = Math.random() > 0.5 ? "#fff" : "#111";
        const o = (Math.random() * 0.6 + 0.2).toFixed(2);
        return `<div style="height:${h}%;background:${c};opacity:${o}"></div>`;
      }).join("");
      show(layer, `
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;animation:flicker .12s infinite">${bars}</div>
        <div class="scare-img" style="animation:flicker .18s infinite">${faceGlitch()}</div>
        <div style="position:absolute;inset:0;font-family:'Roboto Mono',monospace;color:#0f0;font-size:13px;line-height:1.2;opacity:.5;overflow:hidden;padding:8px">
          ${"SIGNAL LOST ▒▓█ NO INPUT ░▒▓ ERR 0x00DEAD ".repeat(60)}
        </div>`);
      AudioKit.glitchNoise(2.6, 0.85);
      setTimeout(() => { AudioKit.scream(1.0, 0.9); }, 1700);
      return dur;
    }
  },
  {
    id: "watcher",
    emoji: "👁",
    name: "the watcher",
    desc: "the lights die, two eyes open in the dark and drift closer... then it strikes.",
    run(layer) {
      const dur = 5200;
      // stage 1: darkness + distant eyes, low hum
      show(layer, `
        <div id="watchEyes" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:60px;transform:scale(.25);transition:transform 3.4s ease-in;filter:drop-shadow(0 0 12px #500)">
          <div style="width:90px;height:50px;border-radius:50%;background:radial-gradient(circle,#ff2020 0%,#600 60%,#000 100%)"></div>
          <div style="width:90px;height:50px;border-radius:50%;background:radial-gradient(circle,#ff2020 0%,#600 60%,#000 100%)"></div>
        </div>`, "#000");
      // creeping hum
      const ctx = AudioKit.ensure();
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = 52;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 3.2);
      o.connect(g).connect(ctx.destination); o.start();
      // whisper-ish beeps building
      [600, 1200, 2000, 2700].forEach((ms, i) => setTimeout(() => AudioKit.beep(300 + i * 60, 0.08, 0.12), ms));
      requestAnimationFrame(() => {
        const eyes = layer.querySelector("#watchEyes");
        if (eyes) eyes.style.transform = "scale(1.1)";
      });
      // stage 2: the strike
      setTimeout(() => {
        o.stop();
        show(layer, `<div class="scare-img" style="animation:zoomIn .25s ease-out forwards">${faceWatcher()}</div>`);
        AudioKit.boom();
        AudioKit.scream(1.8, 0.97);
        const node = layer.firstElementChild;
        setTimeout(() => { node.style.animation = "shake .3s infinite"; }, 250);
      }, 3400);
      return dur;
    }
  },
  {
    id: "redroom",
    emoji: "🩸",
    name: "red alert",
    desc: "the whole screen floods blood red and convulses while an alarm blares. visceral.",
    run(layer) {
      const dur = 3200;
      show(layer, `<div class="scare-img" style="animation:shake .25s infinite;filter:saturate(1.3)">${faceDemon()}</div>`, "#7e0000");
      // pulse the red
      let on = true;
      const iv = setInterval(() => {
        layer.style.background = on ? "#b00000" : "#3a0000";
        on = !on;
      }, 120);
      AudioKit.siren(3.0, 0.5);
      AudioKit.boom();
      setTimeout(() => AudioKit.scream(1.2, 0.85), 1600);
      setTimeout(() => clearInterval(iv), dur);
      return dur;
    }
  },
  {
    id: "bsod",
    emoji: "💻",
    name: "fake crash",
    desc: "looks like a real system crash... they lean in to read it, and that's when it hits.",
    run(layer) {
      const dur = 5200;
      // stage 1: convincing fake blue screen
      show(layer, `
        <div style="position:absolute;inset:0;background:#0078d7;color:#fff;font-family:'Lexend Deca',sans-serif;padding:8vh 10vw;display:flex;flex-direction:column;gap:22px">
          <div style="font-size:9vw;line-height:1">:(</div>
          <div style="font-size:1.5rem;max-width:680px;line-height:1.5">Your PC ran into a problem and needs to restart. We're just collecting some error info, and then we'll restart for you.</div>
          <div id="bsodPct" style="font-size:1.5rem">0% complete</div>
          <div style="display:flex;gap:18px;align-items:center;margin-top:18px">
            <div style="width:84px;height:84px;background:#fff;padding:5px">
              <div style="width:100%;height:100%;background:repeating-conic-gradient(#0078d7 0 25%,#fff 0 50%) 0/16px 16px"></div>
            </div>
            <div style="font-size:.95rem;max-width:420px;opacity:.92">For more information about this issue and possible fixes, do not visit anyone for help because no one is coming. Stop code: <b>HUMAN_PRESENCE_DETECTED</b></div>
          </div>
        </div>`, "#0078d7");
      // tick the percentage up to bait them into reading
      let pct = 0;
      const pctEl = layer.querySelector("#bsodPct");
      const iv = setInterval(() => {
        pct += Math.floor(Math.random() * 9) + 2;
        if (pct > 99) pct = 99;
        if (pctEl) pctEl.textContent = pct + "% complete";
      }, 360);
      // stage 2: gotcha
      setTimeout(() => {
        clearInterval(iv);
        show(layer, `<div class="scare-img" style="animation:zoomIn .22s ease-out forwards">${faceDead()}</div>`);
        AudioKit.boom();
        AudioKit.scream(1.9, 0.97);
        const node = layer.firstElementChild;
        setTimeout(() => { node.style.animation = "shake .3s infinite"; }, 240);
      }, 3600);
      return dur;
    }
  },

  /* ---- HIDDEN: unlocked only via the konami code (see README) ---- */
  {
    id: "tungtung",
    hidden: true,
    emoji: "🪵",
    name: "tung tung sahur",
    desc: "secret.",
    run(layer) {
      const ctx = AudioKit.ensure();
      show(layer, `<div class="scare-img" id="tungGuy" style="transform:scale(.4);transition:transform 1.9s cubic-bezier(.4,0,.85,1);filter:drop-shadow(0 0 22px #000)">${tungSVG()}</div>`, "#0a0805");
      requestAnimationFrame(() => {
        const g = layer.querySelector("#tungGuy");
        if (g) g.style.transform = "scale(.95)";
      });

      const lunge = () => {
        const g = layer.querySelector("#tungGuy");
        if (g) {
          g.style.transition = "transform .16s";
          g.style.transform = "scale(1.3)";
          g.style.animation = "shake .28s infinite";
        }
        AudioKit.boom();
        woodHit(AudioKit.ctx.currentTime, 150, 1.0);
        AudioKit.scream(1.4, 0.92);
      };

      // real clip provided? play it, lunge on the configured beat
      if (TUNG_AUDIO_SRC) {
        try {
          const a = new Audio(TUNG_AUDIO_SRC);
          a.volume = 1.0;
          a.play().catch(() => {});
        } catch (e) {}
        setTimeout(lunge, TUNG_AUDIO_HIT_MS);
        return TUNG_AUDIO_HIT_MS + 2200;
      }

      // otherwise: synthesized accelerating wooden knocks -> climax
      const t0 = ctx.currentTime;
      let t = t0 + 0.12, gap = 0.21;
      for (let i = 0; i < 13; i++) {
        woodHit(t, 200, Math.min(0.95, 0.55 + i * 0.03));
        t += gap;
        gap *= 0.93; // speed up
      }
      const climaxMs = (t - t0) * 1000;
      setTimeout(lunge, climaxMs);
      return climaxMs + 1900;
    }
  }
];
