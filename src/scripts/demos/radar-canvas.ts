// src/scripts/radar-canvas.ts
import { defineCanvasAnimation, setupCanvas, drawGradientBG } from "./canvas-core";

const TAU = Math.PI * 2;
const norm = (a: number) => (a % TAU + TAU) % TAU;

/** smallest signed angular distance a-b in [-π, π] */
const angDiff = (a: number, b: number) => {
  let d = norm(a) - norm(b);
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

/**
 * True iff the sweep head advanced CCW from `prev` to `cur` and
 * actually passed over `target` during this frame (line test).
 * `tol` is tiny slack for low-FPS skips (default ~0.75°).
 */
const passedHeadCCW = (prev: number, cur: number, target: number, tol = 0.013) => {
  prev = norm(prev); cur = norm(cur); target = norm(target);
  if (prev === cur) return Math.abs(angDiff(target, cur)) <= tol; // paused frame
  if (cur > prev)   return target >= prev - tol && target <= cur + tol; // no wrap
  return target >= prev - tol || target <= cur + tol; // wrapped across 0
};

type State = "hidden" | "fadein" | "hold" | "fadeout";
type Blip = {
  // position is only valid when visible (fadein/hold/fadeout)
  x: number | null;
  y: number | null;
  r: number;
  state: State;
  phaseT: number;    // 0..1 progress inside fadein/fadeout
  ping: number;      // -1 inactive, else 0..1 ring progress
  lastHitT: number;  // time guard for cooldown
  spawnAngle: number; // angle at which this blip will next appear
};

defineCanvasAnimation('canvas[data-canvas="radar"]', (el) => {
  const { ctx, destroy } = setupCanvas(el);

  // Config from data-* with sane defaults
  const speed        = Number(el.dataset.speed ?? "1") || 1;
  const color        = (el.dataset.color ?? "#00ffb4").toString();
  const blipCount    = Math.max(6, Math.min(64, Number(el.dataset.blips ?? "16") || 16));
  const lifeSpeed    = Number(el.dataset.lifeSpeed ?? "0.01");     // fadein/out speed
  const fadePortion  = Math.min(0.45, Math.max(0.05, Number(el.dataset.fadePortion ?? "0.18")));
  const fadeOnHit    = Math.min(1, Math.max(0, Number(el.dataset.fadeOnHit ?? "0.35")));
  const hitCooldown  = Math.max(0, Number(el.dataset.hitCooldown ?? "0.2")); // seconds
  const pingSpeed    = Number(el.dataset.pingSpeed ?? "0.035");

  let t = 0;               // anim time in arbitrary units (for bg, cooldowns)
  let sweep = 0;           // leading edge angle (0..TAU)
  let radius = 0;

  const blips: Blip[] = [];

  const hexToRGBA = (hex: string, a: number) => {
    const h = hex.startsWith("#") ? hex.slice(1) : hex;
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const i = parseInt(full, 16);
    const r = (i >> 16) & 255, g = (i >> 8) & 255, b = i & 255;
    return `rgba(${r},${g},${b},${a})`;
  };

  // Spawning helpers
  const newSpawnAngle = () => Math.random() * TAU;
  function placeAtAngle(b: Blip, angle: number, cx: number, cy: number) {
    // slight jitter so multiple don’t stack on the exact line
    const a = angle + (Math.random() - 0.5) * (TAU * 0.01); // ~±1.8°
    const rr = Math.sqrt(Math.random()) * radius * (0.85 + Math.random() * 0.15);
    b.x = cx + Math.cos(a) * rr;
    b.y = cy + Math.sin(a) * rr;
    b.r = 1.8 + Math.random() * 2.4;
  }

  function seedHidden() {
    blips.length = 0;
    const { width: w, height: h } = el.getBoundingClientRect();
    radius = Math.min(w, h) * 0.4;
    for (let i = 0; i < blipCount; i++) {
      blips.push({
        x: null, y: null, r: 2,
        state: "hidden",
        phaseT: 0,
        ping: -1,
        lastHitT: -999,
        spawnAngle: newSpawnAngle(),
      });
    }
  }
  seedHidden();

  // Keep radius fresh on resize (positions are recomputed on reveal)
  const ro = new ResizeObserver(() => {
    const { width: w, height: h } = el.getBoundingClientRect();
    radius = Math.min(w, h) * 0.4;
  });
  ro.observe(el);

  function alphaFor(b: Blip) {
    if (b.state === "fadein")  return Math.min(1, b.phaseT / fadePortion);
    if (b.state === "hold")    return 1;
    if (b.state === "fadeout") return Math.max(0, 1 - b.phaseT / fadePortion);
    return 0;
  }

  function update(deltaRatio: number) {
    // Progress time & sweep (≈1 rotation / 6s @ speed=1)
    const prevHead = sweep;
    const dAngle   = deltaRatio * speed * (TAU / (6 * 60));
    t     += 0.01 * deltaRatio * speed;
    sweep  = norm(sweep + dAngle);

    const { width: w, height: h } = el.getBoundingClientRect();
    const cx = w / 2, cy = h / 2;

    // Background
    ctx.clearRect(0, 0, w, h);
    drawGradientBG(ctx, w, h, t);

    // Grid
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) { ctx.beginPath(); ctx.arc(cx, cy, (radius * i)/5, 0, TAU); ctx.stroke(); }
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius);
    ctx.stroke();
    ctx.restore();

    // Sweep wedge + crisp leading edge
    const beamWidth = TAU * 0.05; // visual beam width (not used for hit test)
    const start     = sweep - beamWidth;
    const grad      = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, hexToRGBA(color, 0));
    grad.addColorStop(0.7, hexToRGBA(color, 0.06));
    grad.addColorStop(1, hexToRGBA(color, 0.18));
    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, sweep); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = hexToRGBA(color, 0.9); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, radius, sweep - 0.002, sweep + 0.002); ctx.stroke();
    ctx.restore();

    // Blips
    for (const b of blips) {
      if (b.state === "hidden") {
        // Reveal ONLY when sweep head truly passes its scheduled angle
        if (passedHeadCCW(prevHead, sweep, b.spawnAngle)) {
          b.lastHitT = t;
          placeAtAngle(b, b.spawnAngle, cx, cy);
          b.state  = "fadein";
          b.phaseT = 0;
          b.ping   = 0;
        }
        continue; // still hidden otherwise
      }

      // Visible states (fadein/hold/fadeout)
      const a = Math.atan2((b.y as number) - cy, (b.x as number) - cx);
      const headPass = passedHeadCCW(prevHead, sweep, a) && (t - b.lastHitT >= hitCooldown);

      if (headPass && (b.state === "fadein" || b.state === "hold")) {
        b.lastHitT = t;
        if (Math.random() < fadeOnHit) {
          // begin fadeout, optionally ping as it fades
          b.state  = "fadeout";
          b.phaseT = 0;
          b.ping   = 0;
        } else {
          // re-ping while staying visible
          b.ping = 0;
        }
      }

      // Advance fade phases
      if (b.state === "fadein" || b.state === "fadeout") {
        b.phaseT += deltaRatio * lifeSpeed * speed;
        if (b.state === "fadein" && b.phaseT >= fadePortion) {
          b.state  = "hold";
          b.phaseT = 0;
        }
        if (b.state === "fadeout" && b.phaseT >= fadePortion) {
          // Fully faded → hide & wait for the next scheduled head pass
          b.state       = "hidden";
          b.phaseT      = 0;
          b.ping        = -1;
          b.spawnAngle  = newSpawnAngle();
          b.x = b.y     = null; // not drawn while hidden
          continue;
        }
      }

      // Ping ring (allows multiple pings over life)
      if (b.ping >= 0 && b.ping <= 1) {
        const pr = (b.r) + b.ping * 18;
        const pa = (1 - b.ping) * 0.4 * (0.25 + 0.75 * alphaFor(b));
        ctx.strokeStyle = hexToRGBA(color, pa);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x as number, b.y as number, pr, 0, TAU); ctx.stroke();
        b.ping += deltaRatio * pingSpeed * speed;
      }

      // Dot
      const alpha = alphaFor(b);
      if (alpha > 0) {
        ctx.fillStyle = hexToRGBA(color, 0.9 * (0.25 + 0.75 * alpha));
        ctx.beginPath(); ctx.arc(b.x as number, b.y as number, b.r, 0, TAU); ctx.fill();
      }
    }

    // Center glow
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24);
    cg.addColorStop(0, hexToRGBA(color, 0.15));
    cg.addColorStop(1, hexToRGBA(color, 0));
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx, cy, 24, 0, TAU); ctx.fill();
  }

  return { ctx, destroy() { ro.disconnect(); destroy(); }, update };
});
