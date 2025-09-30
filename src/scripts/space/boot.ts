import { SpaceManager } from "./manager";
import { initSmoother, destroySmoother } from "../scroll/smoother";

let lastPath = "";

function path() {
  return location.pathname.replace(/\/+/g, "/");
}

function sync(tag = "") {
  const p = path();
  if (p === lastPath) return;
  SpaceManager.loadForPath(p);
  lastPath = p;
}

export function boot() {
  // Init your canvas/space
    console.log("lol");
  SpaceManager.init({ canvasId: "webgl-canvas" });
  queueMicrotask(() => sync("microtask"));
  requestAnimationFrame(() => sync("raf"));


  // Init scroll smoother
  initSmoother();

  // Handlers
  const onAfterSwap = () => requestAnimationFrame(() => sync("after-swap"));
  const onPageLoad  = () => requestAnimationFrame(() => sync("page-load"));
  const onPopState   = () => requestAnimationFrame(() => sync("popstate"));
  const onHashChange = () => requestAnimationFrame(() => sync("hashchange"));

  // Attach
  document.addEventListener("astro:after-swap", onAfterSwap);
  document.addEventListener("astro:page-load", onPageLoad);
  window.addEventListener("popstate", onPopState);
  window.addEventListener("hashchange", onHashChange);

  const pollId = window.setInterval(() => sync("poll"), 500);

  // Cleanup on page leave
  const cleanup = () => {
    document.removeEventListener("astro:after-swap", onAfterSwap);
    document.removeEventListener("astro:page-load", onPageLoad);
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("hashchange", onHashChange);
    clearInterval(pollId);
    destroySmoother();
  };

  document.addEventListener("astro:before-swap", cleanup);

  console.log("[boot] attached");
}
