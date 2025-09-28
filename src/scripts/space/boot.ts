// src/space/boot.ts
import { SpaceManager } from "./manager";

let lastPath = "";

function path() {
  return location.pathname.replace(/\/+/g, "/");
}

function sync(tag = "") {
  const p = path();
  if (p === lastPath) return;
  console.log("[boot] sync", tag, p);
  SpaceManager.loadForPath(p);
  lastPath = p;
}

export function boot() {
  // Init renderer/loop once (safe to call multiple times)
  SpaceManager.init({ canvasId: "webgl-canvas" });

  // Initial sync (now + next frame for safety)
  queueMicrotask(() => sync("microtask"));
  requestAnimationFrame(() => sync("raf"));

  // Astro lifecycle — bind to *document*
  document.addEventListener("astro:after-swap",  () => requestAnimationFrame(() => sync("after-swap")));
  document.addEventListener("astro:page-load",   () => requestAnimationFrame(() => sync("page-load")));

  // History / hash fallbacks
  addEventListener("popstate",  () => requestAnimationFrame(() => sync("popstate")));
  addEventListener("hashchange",() => requestAnimationFrame(() => sync("hashchange")));

  // Small guard: poll occasionally in case a custom nav bypasses events
  setInterval(() => sync("poll"), 500);

  console.log("[boot] attached");
}
