import { defineCanvasAnimation, setupCanvas, drawGradientBG } from "./canvas-core";

defineCanvasAnimation('canvas[data-canvas="pulse-grid"]', (el) => {
  const { ctx, destroy } = setupCanvas(el);
  const speed = Number(el.dataset.speed ?? "1") || 1;

  const STEP = 26;      // grid spacing
  const BASE = 1.2;     // base dot radius
  const AMP  = 2.0;     // pulse amplitude
  const FREQ = 0.06;    // radial frequency

  let t = 0;

  function update(deltaRatio: number) {
    t += 0.01 * deltaRatio * speed;

    const { width: w, height: h } = el.getBoundingClientRect();
    const cx = w / 2, cy = h / 2;

    ctx.clearRect(0, 0, w, h);
    drawGradientBG(ctx, w, h, t);

    for (let y = STEP / 2; y < h; y += STEP) {
      for (let x = STEP / 2; x < w; x += STEP) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.hypot(dx, dy);
        // radial wave propagating outward
        const pulse = Math.sin(dist * FREQ - t * 2);
        const r = Math.max(0.2, BASE + pulse * AMP);

        ctx.beginPath();
        ctx.fillStyle = `hsla(${200 + pulse * 60}, 80%, ${60 + pulse * 20}%, 0.9)`;
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return { ctx, destroy, update };
});
