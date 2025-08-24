import { defineCanvasAnimation, setupCanvas, drawGradientBG } from "./canvas-core";

defineCanvasAnimation('canvas[data-canvas="particle"]', (el) => {
  const { ctx, destroy } = setupCanvas(el);
  const speed = Number(el.dataset.speed ?? "1") || 1;
  let t = 0;

const update = (deltaRatio: number) => {
  t += 0.01 * deltaRatio * speed; // stable, GSAP-sourced timing
       const { width: w, height: h } = el.getBoundingClientRect();
    ctx.clearRect(0, 0, w, h);
    drawGradientBG(ctx, w, h, t);

    for (let i = 0; i < 50; i++) {
      const x = (Math.sin(t + i * 0.1) * 100) + w / 2;
      const y = (Math.cos(t + i * 0.15) * 80) + h / 2;
      const s = Math.sin(t + i * 0.2) * 2 + 3;

      ctx.fillStyle = `hsla(${240 + i * 5}, 80%, 70%, 0.8)`;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return { ctx, destroy, update };
});