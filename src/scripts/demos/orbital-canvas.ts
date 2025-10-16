import { defineCanvasAnimation, setupCanvas, drawGradientBG } from "./canvas-core";

defineCanvasAnimation('canvas[data-canvas="orbital"]', (el) => {
  const { ctx, destroy } = setupCanvas(el);
  const speed = Number(el.dataset.speed ?? "1") || 1;

  // ring params
  const rings = [
    { r: 40,  count: 8,  omega: 0.8 },
    { r: 80,  count: 12, omega: -0.6 },
    { r: 120, count: 18, omega: 0.4 },
  ];

  let t = 0;

  function update(deltaRatio: number) {
    t += 0.01 * deltaRatio * speed;
    const { width: w, height: h } = el.getBoundingClientRect();
    const cx = w / 2, cy = h / 2;

    ctx.clearRect(0, 0, w, h);
    drawGradientBG(ctx, w, h, t);

    // faint central nucleus
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();

    for (let ri = 0; ri < rings.length; ri++) {
      const { r, count, omega } = rings[ri];

      // ring path
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

      // orbiting dots
      for (let i = 0; i < count; i++) {
        const phase = (i / count) * Math.PI * 2 + t * omega * 2;
        const x = cx + Math.cos(phase) * r;
        const y = cy + Math.sin(phase) * r;

        // trailing line to center for a nice “orbit” feel
        ctx.strokeStyle = "rgba(139,92,246,0.25)";
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();

        ctx.fillStyle = "rgba(139,92,246,0.9)";
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  return { ctx, destroy, update };
});
