import { defineCanvasAnimation, setupCanvas, drawGradientBG } from "./canvas-core";

type Star = { x: number; y: number; vx: number; vy: number; r: number };

defineCanvasAnimation('canvas[data-canvas="constellation"]', (el) => {
  const { ctx, destroy } = setupCanvas(el);
  const speed = Number(el.dataset.speed ?? "1") || 1;

  const stars: Star[] = [];
  const DENSITY = 0.0001;   // stars per px^2
  const MAX_SPEED = 30;     // px/sec in our units

  // init based on current size
  const initStars = () => {
    stars.length = 0;
    const { width: w, height: h } = el.getBoundingClientRect();
    const count = Math.max(20, Math.floor(w * h * DENSITY));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speedPx = (0.3 + Math.random() * 1) * (MAX_SPEED / 60);
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(angle) * speedPx,
        vy: Math.sin(angle) * speedPx,
        r: 1 + Math.random() * 1.5,
      });
    }
  };
  initStars();

  let t = 0;

  function update(deltaRatio: number) {
    t += 0.01 * deltaRatio * speed;
    const { width: w, height: h } = el.getBoundingClientRect();

    ctx.clearRect(0, 0, w, h);
    drawGradientBG(ctx, w, h, t);

    // move + bounce
    for (const s of stars) {
      s.x += s.vx * deltaRatio * 60 * 0.016; // keep motion stable
      s.y += s.vy * deltaRatio * 60 * 0.016;
      if (s.x < 0 || s.x > w) s.vx *= -1, s.x = Math.max(0, Math.min(w, s.x));
      if (s.y < 0 || s.y > h) s.vy *= -1, s.y = Math.max(0, Math.min(h, s.y));
    }

    // links
    const LINK_DIST = 120;
    ctx.lineWidth = 1;
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const a = stars[i], b = stars[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < LINK_DIST * LINK_DIST) {
          const alpha = 1 - Math.sqrt(d2) / LINK_DIST;
          ctx.strokeStyle = `rgba(173, 216, 255, ${alpha * 0.5})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // stars
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (const s of stars) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Re-seed stars on big resizes (optional)
  const resizeReset = new ResizeObserver(() => initStars());
  resizeReset.observe(el);

  return {
    ctx,
    destroy() { resizeReset.disconnect(); destroy(); },
    update,
  };
});
