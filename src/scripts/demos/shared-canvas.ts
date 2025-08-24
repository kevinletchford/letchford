export function setupCanvas(el: HTMLCanvasElement) {
  const ctx = el.getContext("2d")!;
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  const size = () => {
    const { width, height } = el.getBoundingClientRect();
    el.width = Math.max(1, Math.floor(width * dpr));
    el.height = Math.max(1, Math.floor(height * dpr));
    // Draw in CSS pixels (so we can use getBoundingClientRect() sizes directly)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  size();
  const ro = new ResizeObserver(size);
  ro.observe(el);

  const destroy = () => ro.disconnect();
  return { ctx, destroy, size };
}

export function drawGradientBG(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${220 + Math.sin(t) * 30}, 40%, 15%)`);
  g.addColorStop(1, `hsl(${260 + Math.cos(t) * 30}, 40%, 8%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
