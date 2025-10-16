import { defineCanvasAnimation, setupCanvas, drawGradientBG } from "./canvas-core";


defineCanvasAnimation('canvas[data-canvas="morphing"]', (el) => {
  const { ctx, destroy } = setupCanvas(el);
  const speed = Number(el.dataset.speed ?? "1") || 1;
  let t = 0;

  const update = (deltaRatio: number) => {
    t += 0.01 * deltaRatio * speed; // stable, GSAP-sourced timing
      const { width: w, height: h } = el.getBoundingClientRect();
          ctx.clearRect(0, 0, w, h);
          drawGradientBG(ctx, w, h, t);

          // ---- morph-to-circle logic ----
          const base = 60;          // base radius
          const amp0 = 20;          // starting wobble amplitude
          const rot = t * 2;        // rotation phase (was `t * 2` in your code)
          const rev = (rot % (Math.PI * 2)) / (Math.PI * 2); // 0..1 across one revolution
          const amp = amp0 * (1 - Math.abs(2*rev - 1));

          ctx.strokeStyle = "#8b5cf6";
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i <= 100; i++) {
              const angle = (i / 100) * Math.PI * 2;
              // use `rot` for rotation, `amp` for morphing
              const radius = base + Math.sin(angle * 5 + rot) * amp;
              const x = Math.cos(angle) * radius + w / 2;
              const y = Math.sin(angle) * radius + h / 2;
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
    }

  return { ctx, destroy, update };
});