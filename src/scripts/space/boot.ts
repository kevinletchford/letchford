// src/scripts/space/boot.ts  (or src/space/boot.ts, just keep paths consistent)
import { SpaceManager } from "./manager";

let lastPath = "";
let booted = false;
let pollId: number | undefined;

function path() {
  // Include hash/search if they matter for your scene selection:
  return (location.pathname + location.search + location.hash).replace(/\/+/g, "/");
}

function sync(tag = "") {
  const p = path();
  if (p === lastPath) return;
  console.log("[boot] sync", tag, p);
  SpaceManager.loadForPath(p);
  lastPath = p;
}

export function boot() {
  if (booted) return;           // idempotent
  booted = true;

  SpaceManager.init({ canvasId: "webgl-canvas" });

  // Initial sync (now + next frame)
  queueMicrotask(() => sync("microtask"));
  requestAnimationFrame(() => sync("raf"));

  // Astro lifecycle
  document.addEventListener("astro:after-swap", () => requestAnimationFrame(() => sync("after-swap")));
  document.addEventListener("astro:page-load",  () => requestAnimationFrame(() => sync("page-load")));

  // History / hash fallbacks
  addEventListener("popstate",   () => requestAnimationFrame(() => sync("popstate")));
  addEventListener("hashchange", () => requestAnimationFrame(() => sync("hashchange")));

  // Safety poll
  pollId = window.setInterval(() => sync("poll"), 500);

  console.log("[boot] attached");
}

// Auto-run when loaded via <script src={...}>.
// Safe in browser only; won’t run during SSR.
if (typeof window !== "undefined") {
  (window as any).__spaceBooted ??= false;
  if (!(window as any).__spaceBooted) {
    (window as any).__spaceBooted = true;
    boot();
  }
}
