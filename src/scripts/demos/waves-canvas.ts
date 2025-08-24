import { defineCanvasAnimation, setupCanvas, drawGradientBG } from "./canvas-core";

defineCanvasAnimation('canvas[data-canvas="waves"]', (el) => {
  const { ctx, destroy } = setupCanvas(el);
  const speed = Number(el.dataset.speed ?? "1") || 1;
  let t = 0;

const update = (deltaRatio: number) => {
  t += 0.01 * deltaRatio * speed; // stable, GSAP-sourced timing
    const { width: w, height: h } = el.getBoundingClientRect();

    ctx.clearRect(0, 0, w, h);
    drawGradientBG(ctx, w, h, t);

    ctx.strokeStyle = "#06d6a0";
    ctx.lineWidth = 3;

    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 5) {
        const y = h * 0.5
          + Math.sin(x * 0.01 + t + layer) * 30
          + Math.sin(x * 0.02 + t * 0.5) * 15;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.globalAlpha = 0.7 - layer * 0.2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  return { ctx, destroy, update };
});