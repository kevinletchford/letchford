// canvas-core.ts
import bus from "./ticker-bus";

export type CanvasSetup = {
  ctx: CanvasRenderingContext2D;
  destroy: () => void;                 // called on unmount
  update: (deltaRatio: number) => void; // per-frame; deltaRatio === gsap.ticker.deltaRatio(60)
};
export type CreateInstance = (el: HTMLCanvasElement) => CanvasSetup;

export function setupCanvas(el: HTMLCanvasElement) {
  const ctx = el.getContext("2d")!;
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  const size = () => {
    const { width, height } = el.getBoundingClientRect();
    el.width = Math.max(1, Math.floor(width * dpr));
    el.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
  };

  size();
  const ro = new ResizeObserver(size);
  ro.observe(el);

  return {
    ctx,
    destroy() { ro.disconnect(); },
  };
}

export function drawGradientBG(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${220 + Math.sin(t) * 30}, 40%, 15%)`);
  g.addColorStop(1, `hsl(${260 + Math.cos(t) * 30}, 40%, 8%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Mount a family of canvases by selector. Handles:
 *  - init guard via a real attribute (hyphen-safe)
 *  - subscribe/unsubscribe to a single global GSAP ticker (deltaRatio(60))
 *  - cleanup on Astro client routing + HMR
 */
export function defineCanvasAnimation(selector: string, create: CreateInstance) {
  // Make a stable attribute like: data-init-canvas-data-canvas-waves
  const ns = selector.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  const MARK_ATTR = `data-init-${ns}`;

  const mountAll = () => {
    document.querySelectorAll<HTMLCanvasElement>(selector).forEach((el) => {
      // guard: already initialized?
      if (el.hasAttribute(MARK_ATTR)) return;
      el.setAttribute(MARK_ATTR, "1");

      const { update, destroy } = create(el);

      // subscribe this element's updater to the ONE global ticker bus
      const wrapped = (deltaRatio: number) => update(deltaRatio);
      bus.subscribe(wrapped);

      // element-scoped teardown
      const teardown = () => {
        bus.unsubscribe(wrapped);
        destroy();
        el.removeAttribute(MARK_ATTR);
      };

      // Clean up on route change
      addEventListener("astro:before-swap", teardown, { once: true });

      // Optional: if you emit a per-element unmount event, hook it here.
      // el.addEventListener("astro:unmount" as any, teardown, { once: true });

      if (import.meta.hot) import.meta.hot.dispose(teardown);
    });
  };

  if (document.readyState === "loading") {
    addEventListener("DOMContentLoaded", mountAll, { once: true });
  } else {
    mountAll();
  }

  // After client navigation, mount canvases on the new page
  addEventListener("astro:after-swap", mountAll);
}
