import { defineCanvasAnimation, setupCanvas, drawGradientBG } from "./canvas-core";

// data-canvas="sound-waves"
// data-mode="spectrum" | "oscilloscope" | "both"     (default: spectrum)
// Optional:
//   data-bands="64"                  // spectrum: 16..160
//   data-lines="3"                   // oscilloscope: 1..5
//   data-line-width="2"              // oscilloscope
//   data-reactivity="1"              // 0.3..2 (both)
//   data-color="#00e5ff"             // spectrum color
//   data-osc-color="#66ccff"         // oscilloscope color (falls back to data-color)
//   data-osc-alpha="0.7"             // 0.2..1 (line opacity)
//   data-glow="0.8"                  // 0..1 (spectrum glow & osc glow strength)
//   data-speed="1"
//   data-audio-id="myviz1"           // (optional) tie a <button data-audio-toggle data-target="myviz1">

// ---- shared, lazy single audio engine (singleton) ----
type AudioEngine = {
  ctx: AudioContext | null;
  analyser: AnalyserNode | null;
  source: MediaStreamAudioSourceNode | null;
  stream: MediaStream | null;
  timeData: Uint8Array | null;
  freqData: Uint8Array | null;
  active: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

declare global {
  interface Window { __audioViz?: AudioEngine; }
}

function ensureEngine(): AudioEngine {
  if (window.__audioViz) return window.__audioViz;
  const engine: AudioEngine = {
    ctx: null, analyser: null, source: null, stream: null,
    timeData: null, freqData: null, active: false,
    async start() {
      if (this.active) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;                 // 1024–4096 works; 2048 is a nice balance
      analyser.smoothingTimeConstant = 0.8;    // pleasant decay for bars/lines
      src.connect(analyser);

      this.ctx = ctx;
      this.source = src;
      this.analyser = analyser;
      this.stream = stream;
      this.timeData = new Uint8Array(analyser.fftSize);
      this.freqData = new Uint8Array(analyser.frequencyBinCount);
      this.active = true;
      try { await ctx.resume(); } catch {}
    },
    async stop() {
      if (!this.active) return;
      this.active = false;
      try { this.source?.disconnect(); } catch {}
      try { this.analyser?.disconnect(); } catch {}
      try { this.stream?.getTracks().forEach(t => t.stop()); } catch {}
      try { await this.ctx?.close(); } catch {}
      this.source = null; this.analyser = null; this.stream = null; this.ctx = null;
      this.timeData = null; this.freqData = null;
    }
  };
  window.__audioViz = engine;
  return engine;
}

// ---- visualizer ----
defineCanvasAnimation('canvas[data-canvas="sound-waves"]', (el) => {
  const { ctx, destroy } = setupCanvas(el);

  // props
  const speed       = Number(el.dataset.speed ?? "1") || 1;
  const mode        = (el.dataset.mode ?? "spectrum").toString() as "spectrum" | "oscilloscope" | "both";

  const colorHex    = (el.dataset.color ?? "#00e5ff").toString();
  const oscColorHex = (el.dataset.oscColor ?? colorHex).toString();

  const glow        = clamp01(Number(el.dataset.glow ?? "0.8"));
  const oscAlpha    = clamp(Number(el.dataset.oscAlpha ?? "0.7"), 0.2, 1);

  const reactivity  = clamp(Number(el.dataset.reactivity ?? "1"), 0.3, 2);

  const bands       = clampInt(Number(el.dataset.bands ?? "64"), 16, 160);
  const lineWidth   = clampInt(Number(el.dataset.lineWidth ?? "2"), 1, 6);
  const lines       = clampInt(Number(el.dataset.lines ?? "3"), 1, 5);

  // ID wiring (for the toggle button); auto-generate if missing
  if (!el.id) el.id = el.getAttribute("data-audio-id") || `sound-waves-${Math.random().toString(36).slice(2, 8)}`;
  const audioId = el.id;

  let t = 0;
  let deltaScale = 1; // for smoothing

  // utils
  const TAU = Math.PI * 2;
  function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }
  function clamp01(v: number) { return clamp(v, 0, 1); }
  function clampInt(v: number, a: number, b: number) { return Math.max(a, Math.min(b, Math.floor(v || a))); }
  const hexToRGB = (hex: string) => {
    const h = hex.replace("#",""); const f = h.length === 3 ? h.split("").map(c=>c+c).join("") : h;
    const n = parseInt(f,16); return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  };
  const rgb = hexToRGB(colorHex);
  const rgbOsc = hexToRGB(oscColorHex);
  const rgba = (c:{r:number,g:number,b:number}, a:number) => `rgba(${c.r},${c.g},${c.b},${a})`;

  // spectrum state
  const amps = new Float32Array(bands);
  const targets = new Float32Array(bands);
  const phase: number[] = Array.from({ length: bands }, (_, i) => Math.sin(i * 12.9898) * 43758.5453 % TAU);

  // oscilloscope state
  const phaseOffsets = Array.from({ length: lines }, (_, i) => i * 1.4);

  // audio support helpers
  const engine = ensureEngine();

  // Map mic FFT bins into visual bands (log scale)
  function micIntoBands(analyser: AnalyserNode, out: Float32Array) {
    const fdata = engine.freqData!;
    analyser.getByteFrequencyData(fdata); // 0..255
    const N = fdata.length;
    // log-scale band mapping
    for (let bi = 0; bi < out.length; bi++) {
      const lo = Math.floor(expRange(bi / out.length, 1, N * 0.08));
      const hi = Math.min(N - 1, Math.floor(expRange((bi + 1) / out.length, 1, N)));
      let sum = 0, cnt = 0;
      for (let i = lo; i <= hi; i++) { sum += fdata[i]; cnt++; }
      const avg = cnt ? sum / cnt : 0;
      out[bi] = clamp01((avg / 255) * reactivity);
    }
    function expRange(x: number, a: number, b: number) {
      // x in [0,1] → exponential index between a..b
      const k = 6; // curve
      return a + (Math.exp(k * x) - 1) / (Math.exp(k) - 1) * (b - a);
    }
  }

  // Mic time-domain sampler for oscilloscope
  function micWaveSample(analyser: AnalyserNode, xNorm: number) {
    const tdata = engine.timeData!;
    analyser.getByteTimeDomainData(tdata); // ~128..127 with 128 as mid
    const idx = clampInt(Math.floor(xNorm * (tdata.length - 1)), 0, tdata.length - 1);
    // center at 0, scale to [-1,1]
    return (tdata[idx] - 128) / 128;
  }

  // --- drawing ---
  function drawSpectrum(W: number, H: number, midY: number) {
    // compute targets from mic or synth
    if (engine.active && engine.analyser && engine.freqData) {
      micIntoBands(engine.analyser, targets);
    } else {
      for (let i = 0; i < bands; i++) {
        const x = i / (bands - 1 || 1);
        const base = 0.35
          + 0.35 * Math.sin((x * 3.1 + t * 0.9) * TAU + phase[i] * 0.3)
          + 0.15 * Math.sin((x * 7.7 + t * 0.6) * TAU + phase[i] * 0.7)
          + 0.05 * Math.sin((x * 19.0 + t * 0.3) * TAU + phase[i] * 1.3);
        targets[i] = clamp01(base * reactivity);
      }
    }

    // ease
    const k = 1 - Math.pow(1 - 0.16, deltaScale); // smoothing factor
    for (let i = 0; i < bands; i++) {
      amps[i] += (targets[i] - amps[i]) * k;
    }

    const maxBarH = (H * 0.42);
    const gap = Math.max(1, Math.floor(W / (bands * 10)));
    const barW = Math.max(2, Math.floor((W - (bands - 1) * gap) / bands));
    let x = (W - (barW * bands + gap * (bands - 1))) / 2;

    for (let i = 0; i < bands; i++) {
      const a = amps[i];
      const h = Math.max(1, Math.pow(a, 1.1) * maxBarH);

      // glow column (center glow)
      if (glow > 0.001) {
        const g = ctx.createLinearGradient(0, midY - h, 0, midY + h);
        g.addColorStop(0.0, rgba(rgb, glow * 0.0));
        g.addColorStop(0.48, rgba(rgb, glow * 0.9));
        g.addColorStop(0.52, rgba(rgb, glow * 0.9));
        g.addColorStop(1.0, rgba(rgb, glow * 0.0));
        ctx.fillStyle = g;
        ctx.fillRect(x - barW * 0.15, midY - h - 4, barW * 1.3, h * 2 + 8);
      }

      // bars (mirrored)
      ctx.fillStyle = rgba(rgb, 0.9);
      ctx.fillRect(x, midY - h, barW, h);
      ctx.fillRect(x, midY,      barW, h);

      x += barW + gap;
    }

    // center line
    ctx.fillStyle = rgba(rgb, 0.22);
    ctx.fillRect(0, Math.floor(midY) - 0.5, W, 1);
  }

  function drawOscilloscope(W: number, H: number) {
    const padX = 16, padY = 12;
    const useW = W - padX * 2;
    const useH = H - padY * 2;

    const env = 0.42 + 0.08 * Math.sin(t * 0.6 * TAU);
    const baseAmp = (useH / 2) * env;

    for (let li = 0; li < lines; li++) {
      const y0 = padY + useH / 2 + (li - (lines - 1) / 2) * (useH / (lines + 1)) * 0.55;
      const pOff = phaseOffsets[li];

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = rgba(rgbOsc, Math.max(0.15, oscAlpha - li * (0.2 / Math.max(1, lines - 1))));
      ctx.beginPath();

      const steps = Math.max(180, Math.floor(useW / 4));
      for (let i = 0; i <= steps; i++) {
        const xNorm = i / steps;
        const x = padX + xNorm * useW;

        let sample: number;
        if (engine.active && engine.analyser && engine.timeData) {
          sample = micWaveSample(engine.analyser, xNorm); // -1..1 from mic
        } else {
          const w1 = Math.sin((xNorm * 2.0 + t * 0.45 + pOff) * TAU);
          const w2 = Math.sin((xNorm * 5.3 + t * 0.9  + pOff * 0.7) * TAU);
          const w3 = Math.sin((xNorm * 11.7 + t * 1.7 + pOff * 1.3) * TAU);
          sample = (w1 * 0.55 + w2 * 0.3 + w3 * 0.15);
        }

        const y = y0 + sample * baseAmp * reactivity;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // glow pass
      if (glow > 0.001) {
        ctx.lineWidth = lineWidth * 3;
        ctx.strokeStyle = rgba(rgbOsc, glow * 0.25);
        ctx.stroke();
      }
    }
  }

  function update(deltaRatio: number) {
    deltaScale = deltaRatio; // used by spectrum smoother
    t += 0.01 * deltaRatio * speed;

    const { width: W, height: H } = el.getBoundingClientRect();
    const midY = H / 2;

    ctx.clearRect(0, 0, W, H);
    drawGradientBG(ctx, W, H, t);

    if (mode === "spectrum" || mode === "both") drawSpectrum(W, H, midY);
    if (mode === "oscilloscope" || mode === "both") drawOscilloscope(W, H);
  }

  // ---- button wiring (toggle mic) ----
function bindButton() {
  const btn = document.querySelector<HTMLButtonElement>(
    `button[data-audio-toggle][data-target="${audioId}"]`
  );
  if (!btn) return;

  const recordEl = btn.querySelector<HTMLElement>("[data-role=record]");
  const stopEl   = btn.querySelector<HTMLElement>("[data-role=stop]");
  const srText   = btn.querySelector<HTMLElement>("[data-role=sr]"); // optional screen-reader text

  const setUI = () => {
    const active = engine.active;
    btn.setAttribute("aria-pressed", active ? "true" : "false");
    if (recordEl) recordEl.style.display = active ? "none" : "";
    if (stopEl)   stopEl.style.display   = active ? "" : "none";
    if (srText)   srText.textContent     = active ? "Stop recording" : "Start recording";
    // optional: swap bg color
    btn.classList.toggle("bg-emerald-600/70", !active);
    btn.classList.toggle("hover:bg-emerald-600/90", !active);
    btn.classList.toggle("bg-rose-600/70", active);
    btn.classList.toggle("hover:bg-rose-600/90", active);
  };
  setUI();

  const onClick = async () => {
    try {
      if (!engine.active) await engine.start();
      else await engine.stop();
      setUI();
    } catch {
      btn.setAttribute("aria-label", "Microphone blocked");
    }
  };

  btn.addEventListener("click", onClick);
  addEventListener("astro:before-swap", () => btn.removeEventListener("click", onClick), { once: true });
  if (import.meta.hot) import.meta.hot.dispose(() => btn.removeEventListener("click", onClick));
}

  // bind once the DOM is ready
  if (document.readyState === "loading") {
    addEventListener("DOMContentLoaded", bindButton, { once: true });
  } else {
    bindButton();
  }

  return { ctx, destroy, update };
});
