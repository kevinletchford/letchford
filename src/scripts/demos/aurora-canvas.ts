// src/scripts/aurora-canvas.ts
import { defineCanvasAnimation, setupCanvas, drawGradientBG } from "./canvas-core";

/**
 * <canvas data-canvas="aurora" ...>
 * Optional data-*:
 *  - data-speed="1"              // 0.2..3
 *  - data-ribbons="4"            // 1..8 curtains
 *  - data-amp="0.22"             // 0.05..0.6 vertical amplitude (of canvas height)
 *  - data-noise="1"              // 0.3..2 movement complexity multiplier
 *  - data-glow="0.8"             // 0..1 brightness/opacity multiplier
 *  - data-colors="#7ef9ff,#b794ff,#7cffb8"  // CSV; cycles if fewer than ribbons
 *  - data-blur="8"               // px; 0 disables blur (blur only affects ribbons)
 *  - data-softcore="1"           // 1 = no hard center stroke (softest look), 0 = include core stroke
 */

type RGB = { r: number; g: number; b: number };
const TAU = Math.PI * 2;
const clamp  = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

const hexToRGB = (hex: string): RGB => {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const n = parseInt(f, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const rgba = (c: RGB, a: number) => `rgba(${c.r},${c.g},${c.b},${a})`;

defineCanvasAnimation('canvas[data-canvas="aurora"]', (el) => {
  const { ctx, destroy } = setupCanvas(el);

  // ---- props ----
  const speed    = clamp(Number(el.dataset.speed ?? "1") || 1, 0.2, 3);
  const ribbonsN = clamp(Math.floor(Number(el.dataset.ribbons ?? "4") || 4), 1, 8);
  const ampFrac  = clamp(Number(el.dataset.amp ?? "0.22") || 0.22, 0.05, 0.6);
  const noiseMul = clamp(Number(el.dataset.noise ?? "1") || 1, 0.3, 2);
  const glow     = clamp01(Number(el.dataset.glow ?? "0.1") || 0.1);
  const blurPx   = Math.max(0, Number(el.dataset.blur ?? "10") || 10);
  const softcore = (el.dataset.softmax ?? el.dataset.softcore ?? "1") === "1"; // support either key

  const colorList = (el.dataset.colors ?? "#7ef9ff,#b794ff,#7cffb8")
    .split(",").map(s => s.trim()).filter(Boolean);
  const colors: RGB[] = (colorList.length ? colorList : ["#7ef9ff","#b794ff","#7cffb8"]).map(hexToRGB);

  // ---- per-ribbon params ----
  const ribs = Array.from({ length: ribbonsN }, (_, i) => {
    const color = colors[i % colors.length];
    const phase = Math.random() * TAU;
    return {
      color,
      baseY: 0.45 + (i / Math.max(1, ribbonsN - 1)) * 0.25, // horizon ratio 0.45..0.70
      w1: 1.2 + i * 0.15,     v1: 0.18 + i * 0.03,
      w2: 3.4 + i * 0.20,     v2: 0.10 + i * 0.02,
      w3: 7.0 + i * 0.25,     v3: 0.06 + i * 0.01,
      phase,
      thickness: 90 + i * 20, // px (base; glow strokes scale this)
      alpha: 0.35 + 0.12 * (1 - i / Math.max(1, ribbonsN - 1)), // nearer = brighter
      parallax: 0.85 + (i / Math.max(1, ribbonsN - 1)) * 0.3,   // farther = slower
    };
  });

  // ---- offscreen layer for blur (only ribbons are blurred) ----
  const layer = document.createElement("canvas");
  const lctx = layer.getContext("2d")!;

  let t = 0;

  function ribbonOffset(xNorm: number, time: number, r: (typeof ribs)[number], amp: number) {
    const n1 = Math.sin((xNorm * r.w1 * noiseMul + time * r.v1) * TAU + r.phase) * 0.55;
    const n2 = Math.sin((xNorm * r.w2 * noiseMul + time * r.v2) * TAU + r.phase * 1.7) * 0.3;
    const n3 = Math.sin((xNorm * r.w3 * noiseMul + time * r.v3) * TAU + r.phase * 2.3) * 0.15;
    return (n1 + n2 + n3) * amp;
  }

  function update(deltaRatio: number) {
    t += 0.01 * deltaRatio * speed;

    const { width: W, height: H } = el.getBoundingClientRect();
    const amp = H * ampFrac;

    // main background
    ctx.clearRect(0, 0, W, H);
    drawGradientBG(ctx, W, H, t * 0.6);

    // star dust (optional)
    ctx.save();
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 40; i++) {
      const x = (Math.sin(i * 12.9898 + t * 0.2) * 0.5 + 0.5) * W;
      const y = (Math.sin(i * 78.233  + t * 0.27) * 0.5 + 0.5) * H * 0.65;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();

    // ensure offscreen layer matches size & DPR
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const wantW = Math.max(1, Math.floor(W * dpr));
    const wantH = Math.max(1, Math.floor(H * dpr));
    if (layer.width !== wantW || layer.height !== wantH) {
      layer.width = wantW;
      layer.height = wantH;
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS px
    }

    // draw ribbons to offscreen (additive)
    lctx.clearRect(0, 0, W, H);
    lctx.save();
    lctx.translate(W / 2, H / 2);
    lctx.rotate(135 * Math.PI / 180);   // 45° in radians
    lctx.translate(-W / 2, -H / 2);
    lctx.globalCompositeOperation = "lighter";



    
    for (let i = 0; i < ribs.length; i++) {
      const r = ribs[i];
      const localT = t * r.parallax;

      lctx.beginPath();
      for (let xi = 0; xi <= W; xi += 4) {
        const xN = xi / W;
        const yMid = r.baseY * H;
        const y = yMid + ribbonOffset(xN, localT, r, amp);
        if (xi === 0) lctx.moveTo(xi, y);
        else lctx.lineTo(xi, y);
      }

      lctx.lineJoin = "round";
      lctx.lineCap = "round";

      // Optional core stroke (default OFF for softness)
      if (!softcore) {
        lctx.strokeStyle = rgba(r.color, clamp01(r.alpha * glow * 0.5));
        lctx.lineWidth = r.thickness * 2;
        lctx.shadowBlur = 0;
        lctx.stroke();
      }

      // Glow pass 1
      lctx.strokeStyle = rgba(r.color, clamp01(0.18 * glow));
      lctx.lineWidth = r.thickness * 1.2;
      lctx.shadowColor = rgba(r.color, clamp01(0.6 * glow));
      lctx.shadowBlur = 24;
      lctx.stroke();

      // Glow pass 2 (wider, fainter)
      lctx.strokeStyle = rgba(r.color, clamp01(0.08 * glow));
      lctx.lineWidth = r.thickness * 1.9;
      lctx.shadowColor = rgba(r.color, clamp01(0.35 * glow));
      lctx.shadowBlur = 36;
      lctx.stroke();
    }

    lctx.restore();

    // composite blurred ribbons onto main
    ctx.save();
    if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(layer, 0, 0, W, H);
    ctx.restore();
    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";

    // horizon haze
    const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
    g.addColorStop(0, "rgba(10,10,15,0)");
    g.addColorStop(1, "rgba(10,10,15,0.65)");
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
  }

  return { ctx, destroy, update };
});
