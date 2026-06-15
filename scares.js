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

/* ---------- deranged coffee mug (the "buy me a coffee" trap) ---------- */
function mugSVG() {
  return `
  <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cup" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f3ede0"/>
        <stop offset="100%" stop-color="#cdc1aa"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="#0a0805"/>
    <g stroke="#e8e0d0" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.85">
      <path d="M150 96 q-16 -22 4 -40 q18 -16 2 -38"/>
      <path d="M200 90 q-18 -24 4 -44 q20 -18 2 -40"/>
      <path d="M250 96 q-16 -22 4 -40 q18 -16 2 -38"/>
    </g>
    <ellipse cx="200" cy="346" rx="128" ry="22" fill="#241a12"/>
    <path d="M296 196 q70 6 70 70 q0 64 -70 64" fill="none" stroke="url(#cup)" stroke-width="26"/>
    <path d="M104 150 L296 150 L278 322 Q200 346 122 322 Z" fill="url(#cup)" stroke="#b7ab90" stroke-width="3"/>
    <ellipse cx="200" cy="150" rx="96" ry="22" fill="#36210f"/>
    <ellipse cx="200" cy="147" rx="94" ry="19" fill="#56371d"/>
    <path d="M138 196 L182 210" stroke="#3a2a16" stroke-width="10" stroke-linecap="round"/>
    <path d="M262 196 L218 210" stroke="#3a2a16" stroke-width="10" stroke-linecap="round"/>
    <circle cx="162" cy="224" r="24" fill="#fff"/>
    <circle cx="238" cy="224" r="24" fill="#fff"/>
    <circle cx="167" cy="230" r="10" fill="#b01818"/>
    <circle cx="233" cy="230" r="10" fill="#b01818"/>
    <circle cx="167" cy="230" r="3.5" fill="#fff"/>
    <circle cx="233" cy="230" r="3.5" fill="#fff"/>
    <path d="M150 270 Q200 260 250 270 Q236 322 200 326 Q164 322 150 270 Z" fill="#190f08"/>
    <path d="M162 274 l10 14 l12 -12 l12 14 l12 -12 l12 14 l10 -14" fill="none" stroke="#e8ddc8" stroke-width="5"/>
    <path d="M196 326 q4 24 -2 44" stroke="#3a2412" stroke-width="9" fill="none" stroke-linecap="round"/>
  </svg>`;
}

/* small helper to set layer html + show it */
function show(layer, html, bg = "#000") {
  layer.style.background = bg;
  layer.innerHTML = html;
  layer.classList.remove("hidden");
}

/* ---------- lighting helpers ---------- */
// a single blinding flash that fades out
function flash(layer, color = "#fff", dur = 0.16, z = 60) {
  const f = document.createElement("div");
  f.style.cssText =
    `position:absolute;inset:0;background:${color};pointer-events:none;z-index:${z};animation:flashOut ${dur}s ease forwards`;
  layer.appendChild(f);
  setTimeout(() => { if (f.parentNode) f.remove(); }, dur * 1000 + 80);
}

// strobing colored light, screen-blended so it lights the face on top
function lightStorm(layer, colors, speed = 65, z = 40) {
  const o = document.createElement("div");
  o.style.cssText =
    `position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;z-index:${z}`;
  layer.appendChild(o);
  let i = 0;
  return setInterval(() => { o.style.background = colors[i++ % colors.length]; }, speed);
}

// random sputtering flashes (lightning / paparazzi feel)
function flashStorm(layer, colors = ["#fff", "#ff0033"], every = 300) {
  return setInterval(() => {
    flash(layer, colors[Math.floor(Math.random() * colors.length)], 0.09, 55);
  }, every);
}

// the core jump: blinding flash -> face lunges at you -> strobe + convulse + scream
function faceSlam(layer, faceHtml, opts = {}) {
  const dur = opts.dur || 2900;
  const colors = opts.colors || ["#ffffff", "#ff0033", "transparent", "#2a00ff", "transparent"];
  show(layer, `<div class="scare-img slam">${faceHtml}</div>`, "#000");
  const face = layer.querySelector(".slam");

  flash(layer, "#ffffff", 0.22);
  AudioKit.boom(1.0);
  AudioKit.scream(opts.screamDur || 1.9, 1.0);

  const ivLight = lightStorm(layer, colors, opts.speed || 60);
  const ivFlash = flashStorm(layer, opts.flashColors || ["#fff", "#ff0033"], opts.flashEvery || 300);
  setTimeout(() => { if (face) face.classList.add("rage"); }, 210);

  setTimeout(() => { clearInterval(ivLight); clearInterval(ivFlash); }, dur);
  return dur;
}

/* ---------- hidden scare: tung tung tung sahur ---------- */
/* OPTIONAL: to use a real, properly-cropped audio clip instead of the
   synthesized wooden knocks, paste a URL or base64 data URI below.
   When set, it plays the clip and skips the synth. */
const TUNG_AUDIO_SRC = "";       // e.g. "tung.mp3" or "data:audio/mpeg;base64,...."

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
      return faceSlam(layer, faceSVG(), {
        colors: ["#ffffff", "#ff0033", "transparent", "#2a00ff", "transparent"],
        flashColors: ["#fff", "#ff0033"], flashEvery: 300, dur: 2900
      });
    }
  },
  {
    id: "strobe",
    emoji: "🚨",
    name: "rave from hell",
    desc: "blinding black-and-white strobe with a screaming siren. disorienting and brutal.",
    run(layer) {
      const dur = faceSlam(layer, faceSkull(), {
        colors: ["#ffffff", "#000000", "#00f6ff", "#ff00e1", "#ffffff", "#000000"],
        speed: 42, flashColors: ["#fff", "#00f6ff", "#ff00e1"], flashEvery: 150,
        dur: 3300, screamDur: 1.5
      });
      AudioKit.siren(3.1, 0.55);
      AudioKit.glitchNoise(3.1, 0.35);
      return dur;
    }
  },
  {
    id: "glitch",
    emoji: "📺",
    name: "signal lost",
    desc: "the screen tears apart into static and digital garbage, then a face flickers through.",
    run(layer) {
      const dur = 3200;
      const bars = Array.from({ length: 60 }, () => {
        const h = (Math.random() * 5 + 1).toFixed(1);
        const c = Math.random() > 0.5 ? "#fff" : "#111";
        const o = (Math.random() * 0.6 + 0.2).toFixed(2);
        return `<div style="height:${h}%;background:${c};opacity:${o}"></div>`;
      }).join("");
      show(layer, `
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;animation:flicker .1s infinite">${bars}</div>
        <div style="position:absolute;inset:0;font-family:'Roboto Mono',monospace;color:#0f0;font-size:13px;line-height:1.2;opacity:.5;overflow:hidden;padding:8px">
          ${"SIGNAL LOST ▒▓█ NO INPUT ░▒▓ ERR 0x00DEAD ".repeat(60)}
        </div>
        <div class="scare-img slam" style="z-index:10">${faceGlitch()}</div>`, "#000");
      flash(layer, "#fff", 0.2);
      AudioKit.boom(1.0);
      AudioKit.glitchNoise(3.0, 0.95);
      const face = layer.querySelector(".slam");
      setTimeout(() => { if (face) face.classList.add("rage"); }, 210);
      const ivLight = lightStorm(layer, ["#ff0040", "transparent", "#00f6ff", "transparent"], 50);
      const ivFlash = flashStorm(layer, ["#fff", "#ff0040", "#00f6ff"], 190);
      setTimeout(() => AudioKit.scream(1.1, 0.95), 1400);
      setTimeout(() => { clearInterval(ivLight); clearInterval(ivFlash); }, dur);
      return dur;
    }
  },
  {
    id: "watcher",
    emoji: "👁",
    name: "the watcher",
    desc: "no warning — the pale thing is already in your face, eyes wide, screaming.",
    run(layer) {
      return faceSlam(layer, faceWatcher(), {
        colors: ["#ffffff", "transparent", "#7b00ff", "transparent"],
        flashColors: ["#fff", "#b9b3ff"], flashEvery: 230, dur: 2900, screamDur: 1.9
      });
    }
  },
  {
    id: "redroom",
    emoji: "🩸",
    name: "red alert",
    desc: "the whole screen floods blood red and convulses while an alarm blares. visceral.",
    run(layer) {
      const dur = 3400;
      faceSlam(layer, faceDemon(), {
        colors: ["#ff0000", "#ffffff", "transparent", "#ff5500", "transparent"],
        flashColors: ["#ff0000", "#fff"], flashEvery: 170, dur, screamDur: 1.4
      });
      AudioKit.siren(3.2, 0.5);
      setTimeout(() => AudioKit.scream(1.2, 0.92), 1700);
      return dur;
    }
  },
  {
    id: "bsod",
    emoji: "💻",
    name: "fake crash",
    desc: "the screen 'crashes' to a blue error and the corpse erupts out of it instantly.",
    run(layer) {
      const dur = 2900;
      const bsod = `
        <div style="position:absolute;inset:0;background:#0078d7;color:#fff;font-family:'Lexend Deca',sans-serif;padding:8vh 10vw;display:flex;flex-direction:column;gap:22px">
          <div style="font-size:9vw;line-height:1">:(</div>
          <div style="font-size:1.5rem;max-width:680px;line-height:1.5">Your PC ran into a problem. Stop code: <b>HUMAN_PRESENCE_DETECTED</b></div>
        </div>`;
      show(layer, `${bsod}<div class="scare-img slam" style="z-index:10">${faceDead()}</div>`, "#0078d7");
      flash(layer, "#fff", 0.22);
      AudioKit.boom(1.0);
      AudioKit.scream(1.9, 1.0);
      const face = layer.querySelector(".slam");
      setTimeout(() => { if (face) face.classList.add("rage"); }, 210);
      const ivL = lightStorm(layer, ["#ffffff", "transparent", "#00ffd0", "transparent"], 60);
      const ivF = flashStorm(layer, ["#fff", "#00ffd0"], 270);
      setTimeout(() => { clearInterval(ivL); clearInterval(ivF); }, dur);
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
      // the signature wooden knocks fire as a fast loud burst RIGHT NOW,
      // layered into the scare — no slow accelerating buildup.
      if (TUNG_AUDIO_SRC) {
        try {
          const a = new Audio(TUNG_AUDIO_SRC);
          a.volume = 1.0;
          a.play().catch(() => {});
        } catch (e) {}
      } else {
        let t = ctx.currentTime;
        for (let i = 0; i < 10; i++) { woodHit(t, 210 - i * 6, 0.95); t += 0.07; }
      }
      return faceSlam(layer, tungSVG(), {
        colors: ["#ffffff", "transparent", "#ffae00", "transparent"],
        flashColors: ["#fff", "#ffae00"], flashEvery: 230, dur: 2900, screamDur: 1.6
      });
    }
  },

  /* ---- HIDDEN: the "buy me a coffee" button trap. fires instantly. ---- */
  {
    id: "coffee",
    hidden: true,
    emoji: "☕",
    name: "buy me a coffee",
    desc: "secret.",
    run(layer) {
      // quirky cartoon "boing" sting that drops into the scream
      const ctx = AudioKit.ensure();
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(950, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.32);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.42, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.37);

      return faceSlam(layer, mugSVG(), {
        colors: ["#ffffff", "#6f4a24", "transparent", "#c8983f", "transparent"],
        flashColors: ["#fff", "#c8983f"], flashEvery: 210, dur: 2800, screamDur: 1.7
      });
    }
  }
];
